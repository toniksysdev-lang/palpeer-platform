package com.palpeer.negotiation.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Negotiation thread between requester and counterparty on a P2P request.
 * CONTRACT_PENDING (P9-02): whether negotiation starts before or after accept.
 * Provisional: linked to an OPEN p2p request; parties = request owner + initiator.
 */
@Getter
@Setter
@Entity
@Table(name = "negotiations")
public class Negotiation extends BaseEntity {

    @Column(name = "p2p_request_id", nullable = false)
    private UUID p2pRequestId;

    @Column(name = "requester_id", nullable = false)
    private UUID requesterId;

    @Column(name = "counterparty_id", nullable = false)
    private UUID counterpartyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private NegotiationStatus status;

    @Column(name = "current_offer_id")
    private UUID currentOfferId;

    /** Order created when the negotiation was accepted. */
    @Column(name = "p2p_order_id")
    private UUID p2pOrderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "closed_reason", length = 20)
    private NegotiationCloseReason closedReason;

    /** Participant who rejected or cancelled; null when closed by the request. */
    @Column(name = "closed_by")
    private UUID closedBy;
}
