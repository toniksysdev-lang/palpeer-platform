package com.palpeer.p2p.web.dto;

import com.palpeer.p2p.domain.P2PSide;
import com.palpeer.p2p.domain.P2PStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record P2PRequestResponse(
        UUID id,
        UUID userId,
        /** Profile full name when set; otherwise an email-local-part / generic fallback. */
        String posterDisplayName,
        P2PSide side,
        String baseCurrencyCode,
        String quoteCurrencyCode,
        BigDecimal amount,
        BigDecimal rate,
        P2PStatus status,
        Instant expiresAt,
        String notes,
        Instant createdAt,
        /** Estimated platform fee when a tier matches (base currency); null when none. */
        BigDecimal estimatedFeeAmount,
        String estimatedFeeCurrency,
        /** Buyer opted in to apply PENDING bonus credit toward the platform fee. */
        boolean applyBonusCredit
) {
}
