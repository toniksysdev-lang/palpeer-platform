package com.palpeer.ledger.balance;

import java.util.Optional;
import java.util.UUID;

/**
 * Port used by the ledger to lock and persist wallet balance projections.
 * Implemented by the wallet module — prevents direct balance writes outside ledger posting.
 */
public interface WalletBalanceStore {

    Optional<WalletBalanceAccount> lockById(UUID walletId);

    void save(WalletBalanceAccount account);
}
