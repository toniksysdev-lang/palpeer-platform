package com.palpeer.p2p.web.dto;

import com.palpeer.p2p.domain.P2PSide;
import com.palpeer.p2p.domain.P2PStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record P2PRequestResponse(
        UUID id,
        UUID userId,
        P2PSide side,
        String baseCurrencyCode,
        String quoteCurrencyCode,
        BigDecimal amount,
        BigDecimal rate,
        P2PStatus status,
        Instant expiresAt,
        String notes,
        Instant createdAt
) {
}
