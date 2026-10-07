package com.palpeer.promotion.web.dto;

import com.palpeer.promotion.domain.PromotionType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PromotionResponse(
        UUID id,
        String code,
        String title,
        String description,
        PromotionType promotionType,
        boolean active,
        Instant startsAt,
        Instant endsAt,
        BigDecimal bonusAmount,
        String bonusCurrencyCode,
        Instant createdAt
) {
}
