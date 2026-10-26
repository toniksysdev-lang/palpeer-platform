package com.palpeer.wallet.funding;

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
        name = "funding_transactions",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_funding_transactions_idempotency",
                columnNames = "idempotency_key"
        )
)
public class FundingTransaction extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "wallet_id", nullable = false)
    private UUID walletId;

    @Column(name = "amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal amount;

    @Column(name = "currency_code", nullable = false, length = 10)
    private String currencyCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private MoneyMovementStatus status;

    @Column(name = "idempotency_key", nullable = false, length = 100)
    private String idempotencyKey;

    @Column(name = "ledger_entry_id")
    private UUID ledgerEntryId;

    @Column(name = "reversal_ledger_entry_id")
    private UUID reversalLedgerEntryId;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    /**
     * CONTRACT_PENDING (P6-01): payment provider reference model.
     */
    @Column(name = "provider_reference", length = 120)
    private String providerReference;

    @Column(name = "provider_name", length = 40)
    private String providerName;

    @Column(name = "funding_instructions", columnDefinition = "TEXT")
    private String fundingInstructions;

    /**
     * Kuda dynamic collection (or static VA) account shown to the payer for this funding.
     * Webhook credits match on {@code collection_account_number} + amount when set.
     */
    @Column(name = "collection_account_number", length = 40)
    private String collectionAccountNumber;

    @Column(name = "collection_account_name", length = 160)
    private String collectionAccountName;

    @Column(name = "collection_bank_name", length = 120)
    private String collectionBankName;

    @Column(name = "collection_bank_code", length = 20)
    private String collectionBankCode;

    @Column(name = "collection_tracking_ref", length = 120)
    private String collectionTrackingRef;
}
