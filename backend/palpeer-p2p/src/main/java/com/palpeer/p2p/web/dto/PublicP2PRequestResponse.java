package com.palpeer.p2p.web.dto;

import com.palpeer.p2p.domain.P2PSide;
import com.palpeer.p2p.domain.P2PStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Public share card for an open P2P request — no owner id or private notes. */
public record PublicP2PRequestResponse(
        UUID id,
        P2PSide side,
        P2PStatus status,
        String baseCurrencyCode,
        String quoteCurrencyCode,
        BigDecimal amount,
        BigDecimal rate,
        String posterDisplayName,
        Instant expiresAt,
        Instant createdAt
) {
}
