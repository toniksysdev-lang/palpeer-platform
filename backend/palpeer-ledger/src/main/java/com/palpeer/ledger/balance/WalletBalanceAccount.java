package com.palpeer.ledger.balance;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Mutable wallet balance projection updated exclusively by {@link com.palpeer.ledger.service.LedgerService}.
 */
public interface WalletBalanceAccount {

    UUID getWalletId();

    String getCurrencyCode();

    BigDecimal getAvailableBalance();

    BigDecimal getPendingBalance();

    void setAvailableBalance(BigDecimal availableBalance);

    void setPendingBalance(BigDecimal pendingBalance);
}
