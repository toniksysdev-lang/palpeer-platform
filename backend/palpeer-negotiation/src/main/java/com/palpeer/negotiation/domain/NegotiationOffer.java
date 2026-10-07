package com.palpeer.negotiation.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Offer / counter-offer line. Required to support offer + counter without losing history.
 * CONTRACT_PENDING (P9-03): confirm offer history model vs single overwrite.
 */
@Getter
@Setter
@Entity
@Table(name = "negotiation_offers")
public class NegotiationOffer extends BaseEntity {

    @Column(name = "negotiation_id", nullable = false)
    private UUID negotiationId;

    @Column(name = "offered_by", nullable = false)
    private UUID offeredBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "offer_type", nullable = false, length = 20)
    private NegotiationOfferType offerType;

    @Column(name = "amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal amount;

    @Column(name = "rate", nullable = false, precision = 28, scale = 12)
    private BigDecimal rate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private NegotiationOfferStatus status;
}
