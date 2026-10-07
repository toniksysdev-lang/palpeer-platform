package com.palpeer.negotiation.web.dto;

import com.palpeer.negotiation.domain.NegotiationCloseReason;
import com.palpeer.negotiation.domain.NegotiationOfferStatus;
import com.palpeer.negotiation.domain.NegotiationOfferType;
import com.palpeer.negotiation.domain.NegotiationStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record NegotiationResponse(
        UUID id,
        UUID p2pRequestId,
        UUID requesterId,
        UUID counterpartyId,
        NegotiationStatus status,
        UUID currentOfferId,
        List<OfferResponse> offers,
        Instant createdAt,
        UUID p2pOrderId,
        NegotiationCloseReason closedReason,
        UUID closedBy
) {
    public record OfferResponse(
            UUID id,
            UUID offeredBy,
            NegotiationOfferType offerType,
            BigDecimal amount,
            BigDecimal rate,
            NegotiationOfferStatus status,
            Instant createdAt
    ) {
    }
}
