package com.palpeer.p2p.web.dto;

import com.palpeer.p2p.domain.P2PSide;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Public marketplace rate card — no owner id or private notes. */
public record PublicP2PRateResponse(
        UUID id,
        P2PSide side,
        String baseCurrencyCode,
        String quoteCurrencyCode,
        BigDecimal amount,
        BigDecimal rate,
        Instant expiresAt,
        Instant createdAt
) {
}
