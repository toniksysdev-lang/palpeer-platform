package com.palpeer.ledger.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.ledger.balance.WalletBalanceAccount;
import com.palpeer.ledger.balance.WalletBalanceStore;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.repository.LedgerEntryRepository;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LedgerServiceTest {

    @Mock private LedgerEntryRepository ledgerEntryRepository;
    @Mock private WalletBalanceStore walletBalanceStore;
    @Mock private com.palpeer.common.audit.AuditRecorder auditRecorder;

    @InjectMocks private LedgerService ledgerService;

    @Test
    void post_idempotentReplay_rejectsPayloadMismatch() {
        UUID walletId = UUID.randomUUID();
        LedgerEntry existing = new LedgerEntry();
        existing.setWalletId(walletId);
        existing.setEntryType(LedgerEntryType.CREDIT);
        existing.setAmount(new BigDecimal("10.00"));
        existing.setIdempotencyKey("k1");

        when(ledgerEntryRepository.findByIdempotencyKey("k1")).thenReturn(Optional.of(existing));

        LedgerPostingRequest request = new LedgerPostingRequest(
                walletId, LedgerEntryType.CREDIT, new BigDecimal("20.00"), "k1", null, null, null);

        assertThatThrownBy(() -> ledgerService.post(request))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("LEDGER_IDEMPOTENCY_CONFLICT");
        verify(walletBalanceStore, never()).lockById(any());
    }

    @Test
    void post_credit_increasesAvailable() {
        UUID walletId = UUID.randomUUID();
        TestAccount account = new TestAccount(walletId, "USD", BigDecimal.ZERO, BigDecimal.ZERO);

        when(ledgerEntryRepository.findByIdempotencyKey("k2")).thenReturn(Optional.empty());
        when(walletBalanceStore.lockById(walletId)).thenReturn(Optional.of(account));
        when(ledgerEntryRepository.save(any(LedgerEntry.class))).thenAnswer(inv -> {
            LedgerEntry e = inv.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        LedgerEntry entry = ledgerService.post(new LedgerPostingRequest(
                walletId, LedgerEntryType.CREDIT, new BigDecimal("50.00"), "k2", "FUNDING", "1", "test"));

        assertThat(account.getAvailableBalance()).isEqualByComparingTo("50.00");
        assertThat(entry.getAvailableBalanceAfter()).isEqualByComparingTo("50.00");
        verify(walletBalanceStore).save(account);
        verify(auditRecorder).record(any());
    }

    private static final class TestAccount implements WalletBalanceAccount {
        private final UUID walletId;
        private final String currencyCode;
        private BigDecimal available;
        private BigDecimal pending;

        private TestAccount(UUID walletId, String currencyCode, BigDecimal available, BigDecimal pending) {
            this.walletId = walletId;
            this.currencyCode = currencyCode;
            this.available = available;
            this.pending = pending;
        }

        @Override public UUID getWalletId() { return walletId; }
        @Override public String getCurrencyCode() { return currencyCode; }
        @Override public BigDecimal getAvailableBalance() { return available; }
        @Override public BigDecimal getPendingBalance() { return pending; }
        @Override public void setAvailableBalance(BigDecimal availableBalance) { this.available = availableBalance; }
        @Override public void setPendingBalance(BigDecimal pendingBalance) { this.pending = pendingBalance; }
    }
}
