package com.palpeer.p2p.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * P2P listing/request created by a user.
 *
 * CONTRACT_PENDING (P8-02): full attribute catalog (limits, payment methods, etc.).
 * Fields below are the minimum required to support create/update/delete/accept.
 */
@Getter
@Setter
@Entity
@Table(name = "p2p_requests")
public class P2PRequest extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "side", nullable = false, length = 10)
    private P2PSide side;

    @Column(name = "base_currency_code", nullable = false, length = 10)
    private String baseCurrencyCode;

    @Column(name = "quote_currency_code", nullable = false, length = 10)
    private String quoteCurrencyCode;

    @Column(name = "amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal amount;

    @Column(name = "rate", nullable = false, precision = 28, scale = 12)
    private BigDecimal rate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private P2PStatus status;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "notes", length = 500)
    private String notes;

    /** Wallet that received the temporary SELL hold (base currency). */
    @Column(name = "hold_wallet_id")
    private UUID holdWalletId;

    /** Ledger HOLD entry for an open SELL listing; released or captured on terminal status. */
    @Column(name = "hold_ledger_entry_id")
    private UUID holdLedgerEntryId;

    /** When set, the owner has removed this request from their history. */
    @Column(name = "archived_at")
    private Instant archivedAt;
}
