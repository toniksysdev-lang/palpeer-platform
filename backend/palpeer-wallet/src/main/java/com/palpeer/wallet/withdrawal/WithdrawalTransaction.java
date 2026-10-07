package com.palpeer.wallet.withdrawal;

import com.palpeer.common.domain.BaseEntity;
import com.palpeer.wallet.funding.MoneyMovementStatus;
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
        name = "withdrawal_transactions",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_withdrawal_transactions_idempotency",
                columnNames = "idempotency_key"
        )
)
public class WithdrawalTransaction extends BaseEntity {

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

    @Column(name = "hold_ledger_entry_id")
    private UUID holdLedgerEntryId;

    @Column(name = "debit_ledger_entry_id")
    private UUID debitLedgerEntryId;

    @Column(name = "release_ledger_entry_id")
    private UUID releaseLedgerEntryId;

    @Column(name = "reversal_ledger_entry_id")
    private UUID reversalLedgerEntryId;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    /**
     * CAD: Interac email/phone or institution:transit:account for EFT.
     * NGN: bankCode:accountNumber for Kuda SINGLE_FUND_TRANSFER.
     */
    @Column(name = "destination_reference", length = 120)
    private String destinationReference;

    @Column(name = "provider_name", length = 40)
    private String providerName;

    @Column(name = "provider_reference", length = 120)
    private String providerReference;
}
