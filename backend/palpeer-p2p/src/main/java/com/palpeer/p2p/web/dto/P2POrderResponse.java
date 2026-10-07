package com.palpeer.p2p.web.dto;

import com.palpeer.p2p.domain.P2PStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record P2POrderResponse(
        UUID id,
        UUID requestId,
        UUID requesterId,
        UUID acceptorId,
        BigDecimal amount,
        BigDecimal rate,
        P2PStatus status,
        Instant createdAt
) {
}
