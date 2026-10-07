package com.palpeer.ledger.domain;

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

/**
 * Immutable financial ledger entry. Balance changes MUST go through ledger postings only.
 */
@Getter
@Setter
@Entity
@Table(
        name = "ledger_entries",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_ledger_entries_idempotency",
                columnNames = "idempotency_key"
        )
)
public class LedgerEntry extends BaseEntity {

    @Column(name = "wallet_id", nullable = false)
    private UUID walletId;

    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false, length = 20)
    private LedgerEntryType entryType;

    @Column(name = "amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal amount;

    @Column(name = "currency_code", nullable = false, length = 10)
    private String currencyCode;

    @Column(name = "available_balance_after", nullable = false, precision = 28, scale = 12)
    private BigDecimal availableBalanceAfter;

    @Column(name = "pending_balance_after", nullable = false, precision = 28, scale = 12)
    private BigDecimal pendingBalanceAfter;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;

    @Column(name = "reference_type", length = 60)
    private String referenceType;

    @Column(name = "reference_id", length = 100)
    private String referenceId;

    @Column(name = "description", length = 500)
    private String description;
}
