package com.palpeer.wallet.funding;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.notify.UserNotifyEvent;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.service.LedgerPostingRequest;
import com.palpeer.ledger.service.LedgerService;
import com.palpeer.profile.domain.Profile;
import com.palpeer.profile.repository.ProfileRepository;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.domain.PaymentVirtualAccount;
import com.palpeer.wallet.funding.dto.CreateFundingRequest;
import com.palpeer.wallet.funding.dto.FundingPaymentDetails;
import com.palpeer.wallet.funding.dto.FundingTransactionResponse;
import com.palpeer.wallet.provider.PaymentRailProvider;
import com.palpeer.wallet.provider.PaymentRailRouter;
import com.palpeer.wallet.provider.apaylo.ApayloPaymentRail;
import com.palpeer.wallet.provider.apaylo.ApayloProperties;
import com.palpeer.wallet.provider.kuda.KudaPaymentRail;
import com.palpeer.wallet.repository.PaymentVirtualAccountRepository;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.wallet.service.FundingUnverifiedLimitService;
import java.math.BigDecimal;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Funding lifecycle. Ledger CREDIT is posted only on SUCCESS.
 *
 * CONTRACT_PENDING (P6-01): payment provider / webhook completion — Apaylo (CAD) + Kuda (NGN) wired.
 * CONTRACT_PENDING (P6-03): exact state transition matrix.
 * Provisional process(): INITIATED|PENDING → PROCESSING → SUCCESS (+ CREDIT).
 */
@Service
@RequiredArgsConstructor
public class FundingService {

    private static final Set<MoneyMovementStatus> PROCESSABLE =
            EnumSet.of(MoneyMovementStatus.INITIATED, MoneyMovementStatus.PENDING);
    private static final Set<MoneyMovementStatus> FAILABLE =
            EnumSet.of(MoneyMovementStatus.INITIATED, MoneyMovementStatus.PENDING, MoneyMovementStatus.PROCESSING);

    private final FundingTransactionRepository fundingTransactionRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final LedgerService ledgerService;
    private final AuditRecorder auditRecorder;
    private final PaymentRailRouter paymentRailRouter;
    private final ApayloProperties apayloProperties;
    private final PaymentVirtualAccountRepository paymentVirtualAccountRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final FundingUnverifiedLimitService fundingUnverifiedLimitService;

    @Transactional
    public FundingTransactionResponse initiate(UUID userId, String idempotencyKey, CreateFundingRequest request) {
        requireIdempotencyKey(idempotencyKey);

        return fundingTransactionRepository.findByIdempotencyKey(idempotencyKey)
                .map(existing -> assertFundingReplay(existing, userId, request))
                .orElseGet(() -> createFunding(userId, idempotencyKey, request));
    }

    /**
     * Admin creates funding for a wallet owner. Uses the wallet's userId (not the operator id)
     * so ledger ownership stays correct.
     */
    @Transactional
    public FundingTransactionResponse operatorInitiate(
            UUID operatorId, UUID walletId, String idempotencyKey, BigDecimal amount, String providerReference) {
        requireIdempotencyKey(idempotencyKey);
        Wallet wallet = walletRepository
                .findById(walletId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found"));
        CreateFundingRequest request = new CreateFundingRequest(walletId, amount, providerReference);
        FundingTransactionResponse response = fundingTransactionRepository
                .findByIdempotencyKey(idempotencyKey)
                .map(existing -> assertFundingReplay(existing, wallet.getUserId(), request))
                .orElseGet(() -> createFunding(wallet.getUserId(), idempotencyKey, request));
        auditRecorder.record(AuditRecord.builder("FUNDING_ADMIN_INITIATE")
                .entity("FundingTransaction:" + response.id())
                .userRef(operatorId)
                .newValue("walletId=" + walletId
                        + ";owner=" + wallet.getUserId()
                        + ";amount=" + amount
                        + ";status=" + response.status())
                .build());
        return response;
    }

    @Transactional(readOnly = true)
    public FundingTransactionResponse get(UUID userId, UUID fundingId) {
        // Never auto-settle on poll. Mobile polls this while the customer pays (Instant Interac /
        // Kuda VA). Crediting here skipped the payment step whenever APAYLO_/KUDA_AUTO_SANDBOX_SETTLE
        // was true. Settlement is webhook or operator process only.
        return toResponse(requireOwned(userId, fundingId));
    }

    /** Manual operator completion. Callers must be authorised operators, never the funding owner. */
    @Transactional
    public FundingTransactionResponse operatorProcess(UUID operatorId, UUID fundingId) {
        FundingTransaction tx = requireForUpdate(fundingId);
        FundingTransactionResponse response = processInternal(tx);
        auditOperator(tx, operatorId, "FUNDING_OPERATOR_PROCESS");
        return response;
    }

    /** Provider webhook / system completion path. */
    @Transactional
    public FundingTransactionResponse completeFromProvider(
            String providerName, String providerReference, boolean success, String reason) {
        FundingTransaction tx = fundingTransactionRepository
                .findByProviderNameAndProviderReference(providerName, providerReference)
                .orElseThrow(() -> new ResourceNotFoundException("Funding transaction not found for provider reference"));
        FundingTransaction locked = fundingTransactionRepository.findByIdForUpdate(tx.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Funding transaction not found"));
        if (success) {
            return processInternal(locked);
        }
        return failInternal(locked, reason);
    }

    @Transactional
    public FundingTransactionResponse completeById(UUID fundingId, boolean success, String reason) {
        FundingTransaction locked = fundingTransactionRepository.findByIdForUpdate(fundingId)
                .orElseThrow(() -> new ResourceNotFoundException("Funding transaction not found"));
        if (success) {
            return processInternal(locked);
        }
        return failInternal(locked, reason);
    }

    /**
     * Completes the newest pending Kuda funding for a virtual-account credit webhook.
     * Matches wallet via VA account number and amount (naira).
     */
    @Transactional
    public FundingTransactionResponse completePendingVirtualAccountCredit(
            String providerName,
            String accountNumber,
            BigDecimal amountNaira,
            String kudaTransactionReference,
            boolean success,
            String reason) {
        var account = paymentVirtualAccountRepository
                .findByProviderNameAndAccountNumber(providerName, accountNumber)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Virtual account not found for " + providerName + " account " + accountNumber));
        List<FundingTransaction> candidates = fundingTransactionRepository.findPendingByWalletProviderAmount(
                account.getWalletId(), providerName, MoneyMovementStatus.PENDING, amountNaira);
        if (candidates.isEmpty()) {
            throw new ResourceNotFoundException(
                    "No pending " + providerName + " funding for wallet " + account.getWalletId()
                            + " amount " + amountNaira);
        }
        FundingTransaction locked = fundingTransactionRepository
                .findByIdForUpdate(candidates.get(0).getId())
                .orElseThrow(() -> new ResourceNotFoundException("Funding transaction not found"));
        if (kudaTransactionReference != null && !kudaTransactionReference.isBlank()) {
            locked.setProviderReference(kudaTransactionReference.trim());
            fundingTransactionRepository.save(locked);
        }
        if (success) {
            return processInternal(locked);
        }
        return failInternal(locked, reason);
    }

    private FundingTransactionResponse processInternal(FundingTransaction tx) {
        if (tx.getStatus() == MoneyMovementStatus.SUCCESS) {
            return toResponse(tx);
        }
        if (!PROCESSABLE.contains(tx.getStatus())) {
            throw new BusinessException(
                    "FUNDING_INVALID_STATE",
                    "Cannot process funding in status " + tx.getStatus(),
                    HttpStatus.CONFLICT);
        }

        tx.setStatus(MoneyMovementStatus.PROCESSING);
        fundingTransactionRepository.save(tx);

        LedgerEntry credit = ledgerService.post(new LedgerPostingRequest(
                tx.getWalletId(),
                LedgerEntryType.CREDIT,
                tx.getAmount(),
                "funding:" + tx.getId() + ":credit",
                "FUNDING",
                tx.getId().toString(),
                "Funding credit"
        ));

        tx.setLedgerEntryId(credit.getId());
        tx.setStatus(MoneyMovementStatus.SUCCESS);
        tx.setFailureReason(null);
        fundingTransactionRepository.save(tx);
        auditStatus(tx, "FUNDING_PROCESS", "SUCCESS");
        notifyFunding(
                tx,
                "Funding successful",
                "Your funding of "
                        + formatMoney(tx.getAmount(), tx.getCurrencyCode())
                        + " has been credited to your wallet and is available to use.");
        return toResponse(tx);
    }

    private FundingTransactionResponse failInternal(FundingTransaction tx, String reason) {
        if (tx.getStatus() == MoneyMovementStatus.FAILED) {
            return toResponse(tx);
        }
        if (!FAILABLE.contains(tx.getStatus())) {
            throw new BusinessException(
                    "FUNDING_INVALID_STATE",
                    "Cannot fail funding in status " + tx.getStatus(),
                    HttpStatus.CONFLICT);
        }
        String old = String.valueOf(tx.getStatus());
        tx.setStatus(MoneyMovementStatus.FAILED);
        tx.setFailureReason(trimToNull(reason));
        fundingTransactionRepository.save(tx);
        auditRecorder.record(AuditRecord.builder("FUNDING_FAIL")
                .entity("FundingTransaction:" + tx.getId())
                .userRef(tx.getUserId())
                .oldValue("status=" + old)
                .newValue("status=FAILED;reason=" + tx.getFailureReason())
                .build());
        String detail = tx.getFailureReason() == null ? "" : " Reason: " + tx.getFailureReason();
        notifyFunding(
                tx,
                "Funding failed",
                "Your funding of "
                        + formatMoney(tx.getAmount(), tx.getCurrencyCode())
                        + " could not be completed. Nothing was added to your wallet."
                        + detail);
        return toResponse(tx);
    }

    @Transactional
    public FundingTransactionResponse operatorFail(UUID operatorId, UUID fundingId, String reason) {
        FundingTransaction tx = requireForUpdate(fundingId);
        FundingTransactionResponse response = failInternal(tx, reason);
        auditOperator(tx, operatorId, "FUNDING_OPERATOR_FAIL");
        return response;
    }

    @Transactional
    public FundingTransactionResponse operatorReverse(UUID operatorId, UUID fundingId) {
        FundingTransaction tx = requireForUpdate(fundingId);
        FundingTransactionResponse response = reverseInternal(tx);
        auditOperator(tx, operatorId, "FUNDING_OPERATOR_REVERSE");
        return response;
    }

    private FundingTransactionResponse reverseInternal(FundingTransaction tx) {
        if (tx.getStatus() == MoneyMovementStatus.REVERSED) {
            return toResponse(tx);
        }
        if (tx.getStatus() != MoneyMovementStatus.SUCCESS) {
            throw new BusinessException(
                    "FUNDING_INVALID_STATE",
                    "Only SUCCESS funding can be reversed",
                    HttpStatus.CONFLICT);
        }

        LedgerEntry debit = ledgerService.post(new LedgerPostingRequest(
                tx.getWalletId(),
                LedgerEntryType.DEBIT,
                tx.getAmount(),
                "funding:" + tx.getId() + ":reversal",
                "FUNDING_REVERSAL",
                tx.getId().toString(),
                "Funding reversal"
        ));

        tx.setReversalLedgerEntryId(debit.getId());
        tx.setStatus(MoneyMovementStatus.REVERSED);
        fundingTransactionRepository.save(tx);
        auditStatus(tx, "FUNDING_REVERSE", "REVERSED");
        notifyFunding(
                tx,
                "Funding reversed",
                "Your funding of "
                        + formatMoney(tx.getAmount(), tx.getCurrencyCode())
                        + " was reversed and removed from your wallet balance.");
        return toResponse(tx);
    }

    private FundingTransactionResponse createFunding(UUID userId, String idempotencyKey, CreateFundingRequest request) {
        Wallet wallet = walletRepository.findByIdAndUserId(request.walletId(), userId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found"));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        fundingUnverifiedLimitService.assertWithinUnverifiedLimit(
                userId, wallet.getCurrencyCode(), request.amount());

        FundingTransaction tx = new FundingTransaction();
        tx.setUserId(userId);
        tx.setWalletId(wallet.getId());
        tx.setAmount(request.amount());
        tx.setCurrencyCode(wallet.getCurrencyCode());
        tx.setStatus(MoneyMovementStatus.INITIATED);
        tx.setIdempotencyKey(idempotencyKey);
        tx.setProviderReference(trimToNull(request.providerReference()));

        try {
            fundingTransactionRepository.saveAndFlush(tx);

            if (paymentRailRouter.hasEnabledRail(wallet.getCurrencyCode())) {
                PaymentRailProvider rail = paymentRailRouter.requireForCurrency(wallet.getCurrencyCode());
                Profile profile = profileRepository.findByUserId(userId).orElse(null);
                PaymentRailProvider.FundingInitiation initiation = rail.initiateFunding(
                        new PaymentRailProvider.FundingInitiationRequest(
                                userId,
                                wallet.getId(),
                                tx.getId(),
                                wallet.getCurrencyCode(),
                                tx.getAmount(),
                                user.getEmail(),
                                user.getPhone(),
                                idempotencyKey,
                                profile == null ? null : profile.getFirstName(),
                                profile == null ? null : profile.getLastName(),
                                request.interacEmail(),
                                request.interacFirstName(),
                                request.interacLastName()
                        ));
                tx.setProviderName(rail.providerName());
                tx.setProviderReference(initiation.providerReference());
                tx.setFundingInstructions(initiation.instructions());
                if (initiation.pendingExternalSettlement()) {
                    tx.setStatus(MoneyMovementStatus.PENDING);
                    fundingTransactionRepository.save(tx);
                } else {
                    // Rail already settled (e.g. Korapay sandbox credit) — CREDIT the wallet now.
                    fundingTransactionRepository.save(tx);
                    auditRecorder.record(AuditRecord.builder("FUNDING_INITIATE")
                            .entity("FundingTransaction:" + tx.getId())
                            .userRef(userId)
                            .newValue("walletId=" + tx.getWalletId()
                                    + ";amount=" + tx.getAmount()
                                    + ";currency=" + tx.getCurrencyCode()
                                    + ";status=SETTLING"
                                    + ";provider=" + tx.getProviderName())
                            .build());
                    return processInternal(tx);
                }
            }

            auditRecorder.record(AuditRecord.builder("FUNDING_INITIATE")
                    .entity("FundingTransaction:" + tx.getId())
                    .userRef(userId)
                    .newValue("walletId=" + tx.getWalletId()
                            + ";amount=" + tx.getAmount()
                            + ";currency=" + tx.getCurrencyCode()
                            + ";status=" + tx.getStatus()
                            + ";provider=" + tx.getProviderName())
                    .build());
            notifyFunding(
                    tx,
                    fundingInitiatedTitle(tx),
                    fundingInitiatedBody(tx));
            return toResponse(tx);
        } catch (DataIntegrityViolationException ex) {
            return fundingTransactionRepository.findByIdempotencyKey(idempotencyKey)
                    .map(existing -> assertFundingReplay(existing, userId, request))
                    .orElseThrow(() -> ex);
        }
    }

    private FundingTransactionResponse assertFundingReplay(
            FundingTransaction existing, UUID userId, CreateFundingRequest request) {
        if (!existing.getUserId().equals(userId)
                || !existing.getWalletId().equals(request.walletId())
                || existing.getAmount().compareTo(request.amount()) != 0) {
            throw new BusinessException(
                    "FUNDING_IDEMPOTENCY_CONFLICT",
                    "Idempotency key already used with different funding payload",
                    HttpStatus.CONFLICT);
        }
        return toResponse(existing);
    }

    private FundingTransaction requireOwned(UUID userId, UUID fundingId) {
        return fundingTransactionRepository.findByIdAndUserId(fundingId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Funding transaction not found"));
    }

    private FundingTransaction requireForUpdate(UUID fundingId) {
        return fundingTransactionRepository.findByIdForUpdate(fundingId)
                .orElseThrow(() -> new ResourceNotFoundException("Funding transaction not found"));
    }

    private void auditOperator(FundingTransaction tx, UUID operatorId, String action) {
        auditRecorder.record(AuditRecord.builder(action)
                .entity("FundingTransaction:" + tx.getId())
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

    private FundingTransactionResponse toResponse(FundingTransaction tx) {
        return new FundingTransactionResponse(
                tx.getId(),
                tx.getWalletId(),
                tx.getAmount(),
                tx.getCurrencyCode(),
                tx.getStatus(),
                tx.getIdempotencyKey(),
                tx.getLedgerEntryId(),
                tx.getReversalLedgerEntryId(),
                tx.getFailureReason(),
                tx.getProviderName(),
                tx.getProviderReference(),
                tx.getFundingInstructions(),
                paymentDetailsFor(tx),
                tx.getCreatedAt()
        );
    }

    /**
     * Structured payment step while funding awaits the customer's transfer (Kuda VA or Apaylo
     * Instant Interac). Cleared once the movement leaves in-progress states.
     */
    private FundingPaymentDetails paymentDetailsFor(FundingTransaction tx) {
        if (tx.getStatus() != MoneyMovementStatus.INITIATED
                && tx.getStatus() != MoneyMovementStatus.PENDING
                && tx.getStatus() != MoneyMovementStatus.PROCESSING) {
            return null;
        }
        if (KudaPaymentRail.NAME.equals(tx.getProviderName())) {
            return paymentVirtualAccountRepository
                    .findByWalletIdAndProviderName(tx.getWalletId(), KudaPaymentRail.NAME)
                    .filter(PaymentVirtualAccount::isActive)
                    .filter(va -> va.getAccountNumber() != null && !va.getAccountNumber().isBlank())
                    .map(va -> new FundingPaymentDetails(
                            va.getAccountNumber(),
                            va.getAccountName(),
                            va.getBankName(),
                            va.getBankCode(),
                            va.getTrackingReference(),
                            tx.getAmount(),
                            tx.getCurrencyCode(),
                            FundingPaymentDetails.METHOD_BANK_TRANSFER,
                            null,
                            null))
                    .orElse(null);
        }
        if (ApayloPaymentRail.NAME.equals(tx.getProviderName())) {
            String payee = blankToNull(apayloProperties.getAccountId());
            if (payee == null) {
                payee = "Palpeer Global Holding Inc";
            }
            return new FundingPaymentDetails(
                    null,
                    payee,
                    "Interac",
                    null,
                    tx.getProviderReference(),
                    tx.getAmount(),
                    tx.getCurrencyCode(),
                    FundingPaymentDetails.METHOD_INTERAC_INSTANT,
                    extractInteracEmail(tx.getFundingInstructions()),
                    blankToNull(apayloProperties.getAplReference()));
        }
        return null;
    }

    private static String extractInteracEmail(String instructions) {
        if (instructions == null || instructions.isBlank()) {
            return null;
        }
        String marker = "Your Interac email:";
        int start = instructions.indexOf(marker);
        if (start < 0) {
            return null;
        }
        String rest = instructions.substring(start + marker.length()).trim();
        int end = rest.indexOf('.');
        String email = (end >= 0 ? rest.substring(0, end) : rest).trim();
        return email.contains("@") ? email : null;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private void auditStatus(FundingTransaction tx, String action, String newStatus) {
        auditRecorder.record(AuditRecord.builder(action)
                .entity("FundingTransaction:" + tx.getId())
                .userRef(tx.getUserId())
                .newValue("status=" + newStatus + ";amount=" + tx.getAmount())
                .build());
    }

    private static String fundingInitiatedTitle(FundingTransaction tx) {
        if (tx.getStatus() == MoneyMovementStatus.PENDING) {
            return "Complete your funding payment";
        }
        return "Funding initiated";
    }

    private static String fundingInitiatedBody(FundingTransaction tx) {
        String money = formatMoney(tx.getAmount(), tx.getCurrencyCode());
        if (tx.getStatus() == MoneyMovementStatus.PENDING) {
            if ("APAYLO".equals(tx.getProviderName())) {
                return "Your CAD funding of "
                        + money
                        + " is waiting for Instant Interac. Open the app for payee details, then send"
                        + " from your banking app. Your wallet updates when payment is confirmed.";
            }
            if ("KUDA".equals(tx.getProviderName())) {
                return "Your NGN funding of "
                        + money
                        + " is waiting for a bank transfer to your Palpeer virtual account. Open the"
                        + " app for account details. Your wallet updates when payment is confirmed.";
            }
            return "Your funding of "
                    + money
                    + " is pending. Complete the payment instructions in the app to finish.";
        }
        return "Your funding of "
                + money
                + " was started (status "
                + tx.getStatus().name().toLowerCase()
                + "). Open the app for details.";
    }

    /** In-app + push + email after commit ({@link UserNotifyEvent}). */
    private void notifyFunding(FundingTransaction tx, String title, String body) {
        eventPublisher.publishEvent(new UserNotifyEvent(
                tx.getUserId(),
                title,
                body,
                "TRANSACTION",
                "FUNDING",
                tx.getId(),
                true,
                true));
    }

    private static String formatMoney(BigDecimal amount, String currency) {
        String value = amount == null ? "0" : amount.stripTrailingZeros().toPlainString();
        return value + " " + (currency == null ? "" : currency);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
