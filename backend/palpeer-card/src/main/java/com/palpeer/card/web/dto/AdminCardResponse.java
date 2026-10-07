package com.palpeer.card.web.dto;

import com.palpeer.card.domain.CardStatus;
import java.time.Instant;
import java.util.UUID;

/**
 * Admin card projection: {@link CardResponse} fields plus the owning {@code userId}.
 */
public record AdminCardResponse(
        UUID id,
        UUID userId,
        UUID walletId,
        String providerName,
        String providerCardId,
        String lastFour,
        String brand,
        String currencyCode,
        CardStatus status,
        Integer expiryMonth,
        Integer expiryYear,
        String cardholderName,
        Instant createdAt
) {
}
