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
 * P2P order created when a request is accepted.
 * CONTRACT_PENDING (P8-03): settlement / ledger wiring (not in Phase 8 scope).
 */
@Getter
@Setter
@Entity
@Table(name = "p2p_orders")
public class P2POrder extends BaseEntity {

    @Column(name = "request_id", nullable = false)
    private UUID requestId;

    @Column(name = "requester_id", nullable = false)
    private UUID requesterId;

    @Column(name = "acceptor_id", nullable = false)
    private UUID acceptorId;

    @Column(name = "amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal amount;

    @Column(name = "rate", nullable = false, precision = 28, scale = 12)
    private BigDecimal rate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private P2PStatus status;

    /** Assessed platform fee at settlement (base currency); null when no tier matched. */
    @Column(name = "fee_amount", precision = 28, scale = 12)
    private BigDecimal feeAmount;

    @Column(name = "fee_currency_code", length = 10)
    private String feeCurrencyCode;

    /** Requester removed this cancelled order from their history. */
    @Column(name = "requester_archived_at")
    private Instant requesterArchivedAt;

    /** Acceptor removed this cancelled order from their history. */
    @Column(name = "acceptor_archived_at")
    private Instant acceptorArchivedAt;
}
