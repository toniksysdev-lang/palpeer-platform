package com.palpeer.exchange.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "exchange_transactions",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_exchange_transactions_idempotency",
                columnNames = "idempotency_key"
        )
)
public class ExchangeTransaction extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "quote_id", nullable = false)
    private UUID quoteId;

    @Column(name = "source_wallet_id", nullable = false)
    private UUID sourceWalletId;

    @Column(name = "target_wallet_id", nullable = false)
    private UUID targetWalletId;

    @Column(name = "source_amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal sourceAmount;

    @Column(name = "target_amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal targetAmount;

    @Column(name = "applied_rate", nullable = false, precision = 28, scale = 12)
    private BigDecimal appliedRate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ExchangeTransactionStatus status;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;

    @Column(name = "debit_ledger_entry_id")
    private UUID debitLedgerEntryId;

    @Column(name = "credit_ledger_entry_id")
    private UUID creditLedgerEntryId;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;
}
