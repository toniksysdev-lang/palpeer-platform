package com.palpeer.wallet.transfer;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.notify.UserNotifyEvent;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.service.LedgerPostingRequest;
import com.palpeer.ledger.service.LedgerService;
import com.palpeer.profile.domain.Profile;
import com.palpeer.profile.repository.ProfileRepository;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.wallet.transfer.dto.CreateWalletTransferRequest;
import com.palpeer.wallet.transfer.dto.TransferRecipientResponse;
import com.palpeer.wallet.transfer.dto.WalletTransferResponse;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WalletTransferService {

    private final WalletTransferRepository walletTransferRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final LedgerService ledgerService;
    private final AuditRecorder auditRecorder;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public WalletTransferResponse transfer(UUID senderUserId, String idempotencyKey, CreateWalletTransferRequest request) {
        requireIdempotencyKey(idempotencyKey);

        return walletTransferRepository
                .findByIdempotencyKey(idempotencyKey)
                .map(existing -> assertReplay(existing, senderUserId, request))
                .orElseGet(() -> createTransfer(senderUserId, idempotencyKey, request));
    }

    @Transactional(readOnly = true)
    public WalletTransferResponse get(UUID userId, UUID transferId) {
        WalletTransfer transfer = walletTransferRepository
                .findById(transferId)
                .orElseThrow(() -> new ResourceNotFoundException("Transfer not found"));
        if (!transfer.getSenderUserId().equals(userId) && !transfer.getRecipientUserId().equals(userId)) {
            throw new ResourceNotFoundException("Transfer not found");
        }
        return toResponse(transfer);
    }

    /**
     * Confirms a recipient email/phone exists and returns their profile full name for the
     * transfer review step. Optional {@code currencyCode} reports whether they have that wallet.
     */
    @Transactional(readOnly = true)
    public TransferRecipientResponse lookupRecipient(UUID senderUserId, String q, String currencyCode) {
        ResolvedRecipient resolved = resolveRecipientDetailed(q);
        User user = resolved.user();
        if (user.getId().equals(senderUserId)) {
            throw new BusinessException(
                    "TRANSFER_TO_SELF", "You cannot transfer to yourself", HttpStatus.BAD_REQUEST);
        }

        String displayName = profileRepository
                .findByUserId(user.getId())
                .map(WalletTransferService::fullName)
                .filter(name -> !name.isBlank())
                .orElseGet(() -> fallbackDisplayName(user));

        Boolean hasWallet = null;
        if (currencyCode != null && !currencyCode.isBlank()) {
            hasWallet = walletRepository
                    .findByUserIdAndCurrencyCodeIgnoreCase(user.getId(), currencyCode.trim())
                    .isPresent();
        }

        return new TransferRecipientResponse(
                user.getId(), displayName, resolved.normalized(), resolved.matchedBy(), hasWallet);
    }

    private WalletTransferResponse createTransfer(
            UUID senderUserId, String idempotencyKey, CreateWalletTransferRequest request) {
        Wallet source = walletRepository
                .findByIdAndUserId(request.sourceWalletId(), senderUserId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found"));

        User recipient = resolveRecipient(request.recipient());
        if (recipient.getId().equals(senderUserId)) {
            throw new BusinessException(
                    "TRANSFER_TO_SELF",
                    "You cannot transfer to yourself",
                    HttpStatus.BAD_REQUEST);
        }

        Wallet destination = walletRepository
                .findByUserIdAndCurrencyCodeIgnoreCase(recipient.getId(), source.getCurrencyCode())
                .orElseThrow(() -> new BusinessException(
                        "RECIPIENT_WALLET_MISSING",
                        "Recipient has no " + source.getCurrencyCode() + " wallet",
                        HttpStatus.BAD_REQUEST));

        BigDecimal amount = request.amount();
        if (amount == null || amount.signum() <= 0) {
            throw new BusinessException("INVALID_AMOUNT", "Amount must be positive", HttpStatus.BAD_REQUEST);
        }
        if (source.getAvailableBalance().compareTo(amount) < 0) {
            throw new BusinessException(
                    "INSUFFICIENT_FUNDS",
                    "Insufficient available balance",
                    HttpStatus.BAD_REQUEST);
        }

        WalletTransfer transfer = new WalletTransfer();
        transfer.setSenderUserId(senderUserId);
        transfer.setRecipientUserId(recipient.getId());
        transfer.setSourceWalletId(source.getId());
        transfer.setDestinationWalletId(destination.getId());
        transfer.setCurrencyCode(source.getCurrencyCode());
        transfer.setAmount(amount);
        transfer.setIdempotencyKey(idempotencyKey);
        transfer.setNote(trimToNull(request.note()));

        try {
            walletTransferRepository.saveAndFlush(transfer);
        } catch (DataIntegrityViolationException ex) {
            return walletTransferRepository
                    .findByIdempotencyKey(idempotencyKey)
                    .map(existing -> assertReplay(existing, senderUserId, request))
                    .orElseThrow(() -> ex);
        }

        String transferId = transfer.getId().toString();
        ledgerService.post(new LedgerPostingRequest(
                source.getId(),
                LedgerEntryType.DEBIT,
                amount,
                idempotencyKey + ":debit",
                "TRANSFER",
                transferId,
                "Transfer to " + recipient.getEmail()));
        ledgerService.post(new LedgerPostingRequest(
                destination.getId(),
                LedgerEntryType.CREDIT,
                amount,
                idempotencyKey + ":credit",
                "TRANSFER",
                transferId,
                "Transfer from " + senderUserId));

        auditRecorder.record(AuditRecord.builder("WALLET_TRANSFER")
                .entity("WalletTransfer:" + transfer.getId())
                .userRef(senderUserId)
                .newValue("to=" + recipient.getId() + ";amount=" + amount + ";currency=" + source.getCurrencyCode())
                .build());

        String money = formatMoney(amount, source.getCurrencyCode());
        eventPublisher.publishEvent(new UserNotifyEvent(
                senderUserId,
                "Transfer sent",
                "You sent " + money + " to " + recipient.getEmail() + ".",
                "TRANSACTION",
                "TRANSFER",
                transfer.getId(),
                true,
                true));
        eventPublisher.publishEvent(new UserNotifyEvent(
                recipient.getId(),
                "Transfer received",
                "You received " + money + " from another Palpeer user.",
                "TRANSACTION",
                "TRANSFER",
                transfer.getId(),
                true,
                true));

        return toResponse(transfer);
    }

    private User resolveRecipient(String raw) {
        return resolveRecipientDetailed(raw).user();
    }

    private ResolvedRecipient resolveRecipientDetailed(String raw) {
        String recipient = raw == null ? "" : raw.trim();
        if (recipient.isEmpty()) {
            throw new BusinessException("RECIPIENT_REQUIRED", "Recipient is required", HttpStatus.BAD_REQUEST);
        }
        if (recipient.contains("@")) {
            String email = recipient.toLowerCase(Locale.ROOT);
            User user = userRepository
                    .findByEmailIgnoreCase(email)
                    .orElseThrow(() -> new BusinessException(
                            "RECIPIENT_NOT_FOUND",
                            "No user found for that email",
                            HttpStatus.NOT_FOUND));
            return new ResolvedRecipient(user, email, "EMAIL");
        }
        String phone = recipient.startsWith("+") ? recipient : "+" + recipient.replaceAll("\\D", "");
        User user = userRepository
                .findByPhone(phone)
                .orElseThrow(() -> new BusinessException(
                        "RECIPIENT_NOT_FOUND",
                        "No user found for that phone number",
                        HttpStatus.NOT_FOUND));
        return new ResolvedRecipient(user, phone, "PHONE");
    }

    private static String fullName(Profile profile) {
        String first = profile.getFirstName() == null ? "" : profile.getFirstName().trim();
        String last = profile.getLastName() == null ? "" : profile.getLastName().trim();
        return (first + " " + last).trim();
    }

    private static String fallbackDisplayName(User user) {
        if (user.getEmail() != null && user.getEmail().contains("@")) {
            return user.getEmail().substring(0, user.getEmail().indexOf('@'));
        }
        return "Palpeer user";
    }

    private record ResolvedRecipient(User user, String normalized, String matchedBy) {}

    private WalletTransferResponse assertReplay(
            WalletTransfer existing, UUID senderUserId, CreateWalletTransferRequest request) {
        if (!existing.getSenderUserId().equals(senderUserId)
                || !existing.getSourceWalletId().equals(request.sourceWalletId())
                || existing.getAmount().compareTo(request.amount()) != 0) {
            throw new BusinessException(
                    "TRANSFER_IDEMPOTENCY_CONFLICT",
                    "Idempotency key already used with a different transfer",
                    HttpStatus.CONFLICT);
        }
        return toResponse(existing);
    }

    private static void requireIdempotencyKey(String key) {
        if (key == null || key.isBlank()) {
            throw new BusinessException(
                    "IDEMPOTENCY_KEY_REQUIRED",
                    "Idempotency-Key header is required",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String formatMoney(BigDecimal amount, String currency) {
        String value = amount == null ? "0" : amount.stripTrailingZeros().toPlainString();
        return value + " " + (currency == null ? "" : currency);
    }

    private WalletTransferResponse toResponse(WalletTransfer transfer) {
        return new WalletTransferResponse(
                transfer.getId(),
                transfer.getSenderUserId(),
                transfer.getRecipientUserId(),
                transfer.getSourceWalletId(),
                transfer.getDestinationWalletId(),
                transfer.getCurrencyCode(),
                transfer.getAmount(),
                transfer.getNote(),
                transfer.getCreatedAt());
    }
}
