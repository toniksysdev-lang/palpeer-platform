package com.palpeer.wallet.domain;

import com.palpeer.common.domain.BaseEntity;
import com.palpeer.ledger.balance.WalletBalanceAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * User wallet. {@code availableBalance} and {@code pendingBalance} are projections
 * maintained exclusively by ledger postings — never mutate outside {@code LedgerService}.
 */
@Getter
@Setter
@Entity
@Table(
        name = "wallets",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_wallets_user_currency",
                columnNames = {"user_id", "currency_code"}
        )
)
public class Wallet extends BaseEntity implements WalletBalanceAccount {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "currency_code", nullable = false, length = 10)
    private String currencyCode;

    @Column(name = "available_balance", nullable = false, precision = 28, scale = 12)
    private BigDecimal availableBalance = BigDecimal.ZERO;

    @Column(name = "pending_balance", nullable = false, precision = 28, scale = 12)
    private BigDecimal pendingBalance = BigDecimal.ZERO;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Override
    public UUID getWalletId() {
        return getId();
    }
}
