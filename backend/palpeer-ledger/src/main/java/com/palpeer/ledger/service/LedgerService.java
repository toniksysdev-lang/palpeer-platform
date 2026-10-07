package com.palpeer.ledger.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.ledger.balance.WalletBalanceAccount;
import com.palpeer.ledger.balance.WalletBalanceStore;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.repository.LedgerEntryRepository;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sole write-path for wallet balance mutations. All financial balance changes must post here.
 */
@Service
@RequiredArgsConstructor
public class LedgerService {

    private final LedgerEntryRepository ledgerEntryRepository;
    private final WalletBalanceStore walletBalanceStore;
    private final AuditRecorder auditRecorder;

    @Transactional
    public LedgerEntry post(LedgerPostingRequest request) {
        validateRequest(request);

        return ledgerEntryRepository.findByIdempotencyKey(request.idempotencyKey())
                .map(existing -> assertIdempotentReplay(existing, request))
                .orElseGet(() -> createPostingSafely(request));
    }

    private LedgerEntry createPostingSafely(LedgerPostingRequest request) {
        try {
            return createPosting(request);
        } catch (DataIntegrityViolationException ex) {
            // Concurrent insert with same idempotency key — return matching existing row
            return ledgerEntryRepository.findByIdempotencyKey(request.idempotencyKey())
                    .map(existing -> assertIdempotentReplay(existing, request))
                    .orElseThrow(() -> ex);
        }
    }

    private LedgerEntry assertIdempotentReplay(LedgerEntry existing, LedgerPostingRequest request) {
        if (!existing.getWalletId().equals(request.walletId())
                || existing.getEntryType() != request.entryType()
                || existing.getAmount().compareTo(request.amount()) != 0) {
            throw new BusinessException(
                    "LEDGER_IDEMPOTENCY_CONFLICT",
                    "Idempotency key already used with different posting payload",
                    HttpStatus.CONFLICT);
        }
        return existing;
    }

    private LedgerEntry createPosting(LedgerPostingRequest request) {
        WalletBalanceAccount account = walletBalanceStore.lockById(request.walletId())
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found: " + request.walletId()));

        BigDecimal amount = request.amount();
        BigDecimal available = nullToZero(account.getAvailableBalance());
        BigDecimal pending = nullToZero(account.getPendingBalance());
        String oldValue = "available=" + available + ";pending=" + pending;

        switch (request.entryType()) {
            case CREDIT -> available = available.add(amount);
            case DEBIT -> {
                assertSufficient(available, amount, "available");
                available = available.subtract(amount);
            }
            case HOLD -> {
                assertSufficient(available, amount, "available");
                available = available.subtract(amount);
                pending = pending.add(amount);
            }
            case RELEASE -> {
                assertSufficient(pending, amount, "pending");
                pending = pending.subtract(amount);
                available = available.add(amount);
            }
        }

        if (available.compareTo(BigDecimal.ZERO) < 0 || pending.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException("LEDGER_NEGATIVE_BALANCE", "Balance cannot be negative", HttpStatus.UNPROCESSABLE_ENTITY);
        }

        account.setAvailableBalance(available);
        account.setPendingBalance(pending);
        walletBalanceStore.save(account);

        LedgerEntry entry = new LedgerEntry();
        entry.setWalletId(account.getWalletId());
        entry.setEntryType(request.entryType());
        entry.setAmount(amount);
        entry.setCurrencyCode(account.getCurrencyCode());
        entry.setAvailableBalanceAfter(available);
        entry.setPendingBalanceAfter(pending);
        entry.setIdempotencyKey(request.idempotencyKey());
        entry.setReferenceType(trimToNull(request.referenceType()));
        entry.setReferenceId(trimToNull(request.referenceId()));
        entry.setDescription(trimToNull(request.description()));
        LedgerEntry saved = ledgerEntryRepository.save(entry);
        auditRecorder.record(AuditRecord.builder("LEDGER_POST")
                .entity("LedgerEntry:" + saved.getId())
                .oldValue(oldValue)
                .newValue("walletId=" + saved.getWalletId()
                        + ";type=" + saved.getEntryType()
                        + ";amount=" + saved.getAmount()
                        + ";currency=" + saved.getCurrencyCode()
                        + ";availableAfter=" + saved.getAvailableBalanceAfter()
                        + ";pendingAfter=" + saved.getPendingBalanceAfter()
                        + ";refType=" + saved.getReferenceType()
                        + ";refId=" + saved.getReferenceId())
                .build());
        return saved;
    }

    private void validateRequest(LedgerPostingRequest request) {
        if (request.walletId() == null) {
            throw new BusinessException("LEDGER_WALLET_REQUIRED", "walletId is required", HttpStatus.BAD_REQUEST);
        }
        if (request.entryType() == null) {
            throw new BusinessException("LEDGER_TYPE_REQUIRED", "entryType is required", HttpStatus.BAD_REQUEST);
        }
        if (request.idempotencyKey() == null || request.idempotencyKey().isBlank()) {
            throw new BusinessException("LEDGER_IDEMPOTENCY_REQUIRED", "idempotencyKey is required", HttpStatus.BAD_REQUEST);
        }
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("LEDGER_AMOUNT_INVALID", "amount must be positive", HttpStatus.BAD_REQUEST);
        }
    }

    private static void assertSufficient(BigDecimal balance, BigDecimal amount, String bucket) {
        if (balance.compareTo(amount) < 0) {
            throw new BusinessException(
                    "INSUFFICIENT_" + bucket.toUpperCase() + "_BALANCE",
                    "Insufficient " + bucket + " balance",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
    }

    private static BigDecimal nullToZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
