package com.palpeer.card.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Provider card transaction record.
 * CONTRACT_PENDING (P13-05): ledger posting on settle — {@code ledgerEntryId} reserved; not auto-posted in Phase 13.
 */
@Getter
@Setter
@Entity
@Table(
        name = "card_transactions",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_card_tx_provider",
                columnNames = {"card_id", "provider_transaction_id"}
        )
)
public class CardTransaction extends BaseEntity {

    @Column(name = "card_id", nullable = false)
    private UUID cardId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "provider_transaction_id", nullable = false, length = 120)
    private String providerTransactionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false, length = 20)
    private CardTransactionType entryType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CardTransactionStatus status;

    @Column(name = "amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal amount;

    @Column(name = "currency_code", nullable = false, length = 10)
    private String currencyCode;

    @Column(name = "merchant_name", length = 200)
    private String merchantName;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    /** Populated only when ledger settlement is wired (P13-05). */
    @Column(name = "ledger_entry_id")
    private UUID ledgerEntryId;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;
}
