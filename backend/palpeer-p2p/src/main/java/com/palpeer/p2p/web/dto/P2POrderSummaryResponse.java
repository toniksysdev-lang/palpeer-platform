package com.palpeer.p2p.web.dto;

import com.palpeer.p2p.domain.P2PSide;
import com.palpeer.p2p.domain.P2PStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Participant order list item: order fields plus the originating request's side and currency pair. */
public record P2POrderSummaryResponse(
        UUID id,
        UUID requestId,
        UUID requesterId,
        UUID acceptorId,
        P2PSide side,
        String baseCurrencyCode,
        String quoteCurrencyCode,
        BigDecimal amount,
        BigDecimal rate,
        P2PStatus status,
        Instant createdAt,
        /** From the originating request; useful for open-listing countdown before/around accept. */
        Instant expiresAt
) {
}
