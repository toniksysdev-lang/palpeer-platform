package com.palpeer.wallet.ledger;

import com.palpeer.ledger.balance.WalletBalanceAccount;
import com.palpeer.ledger.balance.WalletBalanceStore;
import com.palpeer.wallet.repository.WalletRepository;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class JpaWalletBalanceStore implements WalletBalanceStore {

    private final WalletRepository walletRepository;

    @Override
    public Optional<WalletBalanceAccount> lockById(UUID walletId) {
        return walletRepository.findByIdForUpdate(walletId).map(w -> w);
    }

    @Override
    public void save(WalletBalanceAccount account) {
        walletRepository.save((com.palpeer.wallet.domain.Wallet) account);
    }
}
