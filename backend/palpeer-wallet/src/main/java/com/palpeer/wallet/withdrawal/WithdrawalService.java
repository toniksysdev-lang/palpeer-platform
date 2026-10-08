package com.palpeer.wallet.withdrawal;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.service.LedgerPostingRequest;
import com.palpeer.ledger.service.LedgerService;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.funding.MoneyMovementStatus;
import com.palpeer.wallet.provider.PaymentRailProvider;
import com.palpeer.wallet.provider.PaymentRailRouter;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.wallet.withdrawal.dto.CreateWithdrawalRequest;
import com.palpeer.wallet.withdrawal.dto.WithdrawalTransactionResponse;
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Withdrawal lifecycle.
 *
 * CONTRACT_PENDING (P6-02): payout destination / provider.
 * CONTRACT_PENDING (P6-03): exact state transition matrix.
 * CONTRACT_PENDING (P6-04): hold vs direct-debit withdrawal model.
 *
 * Provisional:
 * - initiate: HOLD funds (available → pending)
 * - process SUCCESS: RELEASE then DEBIT (removes funds using existing ledger types)
 * - fail: RELEASE hold back to available
 * - reverse SUCCESS: CREDIT back
 */
@Service
@RequiredArgsConstructor
public class WithdrawalService {

    private static final Set<MoneyMovementStatus> PROCESSABLE =
            EnumSet.of(MoneyMovementStatus.INITIATED, MoneyMovementStatus.PENDING, MoneyMovementStatus.PROCESSING);
    private static final Set<MoneyMovementStatus> FAILABLE =
            EnumSet.of(MoneyMovementStatus.INITIATED, MoneyMovementStatus.PENDING, MoneyMovementStatus.PROCESSING);

    private final WithdrawalTransactionRepository withdrawalTransactionRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final LedgerService ledgerService;
    private final AuditRecorder auditRecorder;
    private final PaymentRailRouter paymentRailRouter;

    @Transactional
    public WithdrawalTransactionResponse initiate(UUID userId, String idempotencyKey, CreateWithdrawalRequest request) {
        requireIdempotencyKey(idempotencyKey);

        return withdrawalTransactionRepository.findByIdempotencyKey(idempotencyKey)
                .map(existing -> assertWithdrawalReplay(existing, userId, request))
                .orElseGet(() -> createWithdrawal(userId, idempotencyKey, request));
    }

    /**
     * Admin creates a withdrawal (HOLD) for a wallet owner. Owner is taken from the wallet,
     * not the operator principal.
     */
    @Transactional
    public WithdrawalTransactionResponse operatorInitiate(
            UUID operatorId,
            UUID walletId,
            String idempotencyKey,
            BigDecimal amount,
            String destinationReference) {
        requireIdempotencyKey(idempotencyKey);
        Wallet wallet = walletRepository
                .findById(walletId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found"));
        CreateWithdrawalRequest request = new CreateWithdrawalRequest(walletId, amount, destinationReference);
        WithdrawalTransactionResponse response = withdrawalTransactionRepository
                .findByIdempotencyKey(idempotencyKey)
                .map(existing -> assertWithdrawalReplay(existing, wallet.getUserId(), request))
                .orElseGet(() -> createWithdrawal(wallet.getUserId(), idempotencyKey, request));
        auditRecorder.record(AuditRecord.builder("WITHDRAWAL_ADMIN_INITIATE")
                .entity("WithdrawalTransaction:" + response.id())
                .userRef(operatorId)
                .newValue("walletId=" + walletId
                        + ";owner=" + wallet.getUserId()
                        + ";amount=" + amount
                        + ";status=" + response.status())
                .build());
        return response;
    }

    @Transactional(readOnly = true)
    public WithdrawalTransactionResponse get(UUID userId, UUID withdrawalId) {
        return toResponse(requireOwned(userId, withdrawalId));
    }

    /** Manual operator completion. Callers must be authorised operators, never the withdrawal owner. */
    @Transactional
    public WithdrawalTransactionResponse operatorProcess(UUID operatorId, UUID withdrawalId) {
        WithdrawalTransaction tx = requireForUpdate(withdrawalId);
        WithdrawalTransactionResponse response = settleSuccess(tx);
        auditOperator(tx, operatorId, "WITHDRAWAL_OPERATOR_PROCESS");
        return response;
    }

    @Transactional
    public WithdrawalTransactionResponse completeFromProvider(
            String providerName, String providerReference, boolean success, String reason) {
        WithdrawalTransaction found = withdrawalTransactionRepository
                .findByProviderNameAndProviderReference(providerName, providerReference)
                .orElseThrow(() -> new ResourceNotFoundException("Withdrawal not found for provider reference"));
        WithdrawalTransaction locked = requireForUpdate(found.getId());
        if (success) {
            return settleSuccess(locked);
        }
        return failInternal(locked, reason);
    }

    private WithdrawalTransactionResponse settleSuccess(WithdrawalTransaction tx) {
        if (tx.getStatus() == MoneyMovementStatus.SUCCESS) {
            return toResponse(tx);
        }
        if (!PROCESSABLE.contains(tx.getStatus()) || tx.getHoldLedgerEntryId() == null) {
            throw new BusinessException(
                    "WITHDRAWAL_INVALID_STATE",
                    "Cannot process withdrawal in status " + tx.getStatus(),
                    HttpStatus.CONFLICT);
        }

        tx.setStatus(MoneyMovementStatus.PROCESSING);
        withdrawalTransactionRepository.save(tx);

        // RELEASE hold back to available, then DEBIT available (no invented CAPTURE type)
        LedgerEntry release = ledgerService.post(new LedgerPostingRequest(
                tx.getWalletId(),
                LedgerEntryType.RELEASE,
                tx.getAmount(),
                "withdrawal:" + tx.getId() + ":release",
                "WITHDRAWAL",
                tx.getId().toString(),
                "Withdrawal hold release before debit"
        ));
        LedgerEntry debit = ledgerService.post(new LedgerPostingRequest(
                tx.getWalletId(),
                LedgerEntryType.DEBIT,
                tx.getAmount(),
                "withdrawal:" + tx.getId() + ":debit",
                "WITHDRAWAL",
                tx.getId().toString(),
                "Withdrawal debit"
        ));

        tx.setReleaseLedgerEntryId(release.getId());
        tx.setDebitLedgerEntryId(debit.getId());
        tx.setStatus(MoneyMovementStatus.SUCCESS);
        tx.setFailureReason(null);
        withdrawalTransactionRepository.save(tx);
        auditWithdrawal(tx, "WITHDRAWAL_PROCESS");
        return toResponse(tx);
    }

    @Transactional
    public WithdrawalTransactionResponse operatorFail(UUID operatorId, UUID withdrawalId, String reason) {
        WithdrawalTransaction tx = requireForUpdate(withdrawalId);
        WithdrawalTransactionResponse response = failInternal(tx, reason);
        auditOperator(tx, operatorId, "WITHDRAWAL_OPERATOR_FAIL");
        return response;
    }

    private WithdrawalTransactionResponse failInternal(WithdrawalTransaction tx, String reason) {
        if (tx.getStatus() == MoneyMovementStatus.FAILED) {
            return toResponse(tx);
        }
        if (!FAILABLE.contains(tx.getStatus())) {
            throw new BusinessException(
                    "WITHDRAWAL_INVALID_STATE",
                    "Cannot fail withdrawal in status " + tx.getStatus(),
                    HttpStatus.CONFLICT);
        }

        if (tx.getHoldLedgerEntryId() != null && tx.getReleaseLedgerEntryId() == null) {
            LedgerEntry release = ledgerService.post(new LedgerPostingRequest(
                    tx.getWalletId(),
                    LedgerEntryType.RELEASE,
                    tx.getAmount(),
                    "withdrawal:" + tx.getId() + ":fail-release",
                    "WITHDRAWAL",
                    tx.getId().toString(),
                    "Withdrawal fail — release hold"
            ));
            tx.setReleaseLedgerEntryId(release.getId());
        }

        String old = String.valueOf(tx.getStatus());
        tx.setStatus(MoneyMovementStatus.FAILED);
        tx.setFailureReason(trimToNull(reason));
        withdrawalTransactionRepository.save(tx);
        auditRecorder.record(AuditRecord.builder("WITHDRAWAL_FAIL")
                .entity("WithdrawalTransaction:" + tx.getId())
                .userRef(tx.getUserId())
                .oldValue("status=" + old)
                .newValue("status=FAILED;reason=" + tx.getFailureReason())
                .build());
        return toResponse(tx);
    }

    @Transactional
    public WithdrawalTransactionResponse operatorReverse(UUID operatorId, UUID withdrawalId) {
        WithdrawalTransaction tx = requireForUpdate(withdrawalId);
        WithdrawalTransactionResponse response = reverseInternal(tx);
        auditOperator(tx, operatorId, "WITHDRAWAL_OPERATOR_REVERSE");
        return response;
    }

    private WithdrawalTransactionResponse reverseInternal(WithdrawalTransaction tx) {
        if (tx.getStatus() == MoneyMovementStatus.REVERSED) {
            return toResponse(tx);
        }
        if (tx.getStatus() != MoneyMovementStatus.SUCCESS) {
            throw new BusinessException(
                    "WITHDRAWAL_INVALID_STATE",
                    "Only SUCCESS withdrawal can be reversed",
                    HttpStatus.CONFLICT);
        }

        LedgerEntry credit = ledgerService.post(new LedgerPostingRequest(
                tx.getWalletId(),
                LedgerEntryType.CREDIT,
                tx.getAmount(),
                "withdrawal:" + tx.getId() + ":reversal",
                "WITHDRAWAL_REVERSAL",
                tx.getId().toString(),
                "Withdrawal reversal"
        ));

        tx.setReversalLedgerEntryId(credit.getId());
        tx.setStatus(MoneyMovementStatus.REVERSED);
        withdrawalTransactionRepository.save(tx);
        auditWithdrawal(tx, "WITHDRAWAL_REVERSE");
        return toResponse(tx);
    }

    private WithdrawalTransactionResponse createWithdrawal(
            UUID userId, String idempotencyKey, CreateWithdrawalRequest request) {
        Wallet wallet = walletRepository.findByIdAndUserId(request.walletId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        WithdrawalTransaction tx = new WithdrawalTransaction();
        tx.setUserId(userId);
        tx.setWalletId(wallet.getId());
        tx.setAmount(request.amount());
        tx.setCurrencyCode(wallet.getCurrencyCode());
        tx.setStatus(MoneyMovementStatus.INITIATED);
        tx.setIdempotencyKey(idempotencyKey);
        tx.setDestinationReference(trimToNull(request.destinationReference()));

        try {
            withdrawalTransactionRepository.saveAndFlush(tx);
        } catch (DataIntegrityViolationException ex) {
            return withdrawalTransactionRepository.findByIdempotencyKey(idempotencyKey)
                    .map(existing -> assertWithdrawalReplay(existing, userId, request))
                    .orElseThrow(() -> ex);
        }

        LedgerEntry hold = ledgerService.post(new LedgerPostingRequest(
                wallet.getId(),
                LedgerEntryType.HOLD,
                request.amount(),
                "withdrawal:" + tx.getId() + ":hold",
                "WITHDRAWAL",
                tx.getId().toString(),
                "Withdrawal hold"
        ));
        tx.setHoldLedgerEntryId(hold.getId());
        tx.setStatus(MoneyMovementStatus.PENDING);

        if (paymentRailRouter.hasEnabledRail(wallet.getCurrencyCode())) {
            PaymentRailProvider rail = paymentRailRouter.requireForCurrency(wallet.getCurrencyCode());
            PaymentRailProvider.WithdrawalInitiation initiation = rail.initiateWithdrawal(
                    new PaymentRailProvider.WithdrawalInitiationRequest(
                            userId,
                            wallet.getId(),
                            tx.getId(),
                            wallet.getCurrencyCode(),
                            tx.getAmount(),
                            tx.getDestinationReference(),
                            user.getEmail(),
                            idempotencyKey
                    ));
            tx.setProviderName(rail.providerName());
            tx.setProviderReference(initiation.providerReference());
            if (!initiation.pendingExternalSettlement()) {
                // Immediate confirmation from rail — settle ledger now
                withdrawalTransactionRepository.save(tx);
                return settleSuccess(tx);
            }
        }

        withdrawalTransactionRepository.save(tx);
        auditWithdrawal(tx, "WITHDRAWAL_INITIATE");
        return toResponse(tx);
    }

    private WithdrawalTransactionResponse assertWithdrawalReplay(
            WithdrawalTransaction existing, UUID userId, CreateWithdrawalRequest request) {
        if (!existing.getUserId().equals(userId)
                || !existing.getWalletId().equals(request.walletId())
                || existing.getAmount().compareTo(request.amount()) != 0) {
            throw new BusinessException(
                    "WITHDRAWAL_IDEMPOTENCY_CONFLICT",
                    "Idempotency key already used with different withdrawal payload",
                    HttpStatus.CONFLICT);
        }
        return toResponse(existing);
    }

    private WithdrawalTransaction requireOwned(UUID userId, UUID withdrawalId) {
        return withdrawalTransactionRepository.findByIdAndUserId(withdrawalId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Withdrawal transaction not found"));
    }

    private WithdrawalTransaction requireForUpdate(UUID withdrawalId) {
        return withdrawalTransactionRepository.findByIdForUpdate(withdrawalId)
                .orElseThrow(() -> new ResourceNotFoundException("Withdrawal transaction not found"));
    }

    private void auditOperator(WithdrawalTransaction tx, UUID operatorId, String action) {
        auditRecorder.record(AuditRecord.builder(action)
                .entity("WithdrawalTransaction:" + tx.getId())
                .userRef(operatorId)
                .newValue("owner=" + tx.getUserId() + ";status=" + tx.getStatus() + ";amount=" + tx.getAmount())
                .build());
    }

    private static void requireIdempotencyKey(String key) {
        if (key == null || key.isBlank()) {
            throw new BusinessException(
                    "IDEMPOTENCY_KEY_REQUIRED",
                    "Idempotency-Key header is required",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private WithdrawalTransactionResponse toResponse(WithdrawalTransaction tx) {
        return new WithdrawalTransactionResponse(
                tx.getId(),
                tx.getWalletId(),
                tx.getAmount(),
                tx.getCurrencyCode(),
                tx.getStatus(),
                tx.getIdempotencyKey(),
                tx.getHoldLedgerEntryId(),
                tx.getDebitLedgerEntryId(),
                tx.getReleaseLedgerEntryId(),
                tx.getReversalLedgerEntryId(),
                tx.getFailureReason(),
                tx.getDestinationReference(),
                tx.getProviderName(),
                tx.getProviderReference(),
                tx.getCreatedAt()
        );
    }

    private void auditWithdrawal(WithdrawalTransaction tx, String action) {
        auditRecorder.record(AuditRecord.builder(action)
                .entity("WithdrawalTransaction:" + tx.getId())
                .userRef(tx.getUserId())
                .newValue("status=" + tx.getStatus() + ";amount=" + tx.getAmount())
                .build());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
