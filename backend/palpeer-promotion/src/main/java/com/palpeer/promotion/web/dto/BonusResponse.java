package com.palpeer.promotion.web.dto;

import com.palpeer.promotion.domain.BonusStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record BonusResponse(
        UUID id,
        UUID userId,
        UUID promotionId,
        UUID referralId,
        BigDecimal amount,
        String currencyCode,
        BonusStatus status,
        String reason,
        UUID ledgerEntryId,
        Instant createdAt
) {
}
