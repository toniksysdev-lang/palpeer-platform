package com.palpeer.promotion.web.dto;

import com.palpeer.promotion.domain.ReferralStatus;
import java.time.Instant;
import java.util.UUID;

public record ReferralResponse(
        UUID id,
        UUID referrerUserId,
        UUID refereeUserId,
        String referralCode,
        ReferralStatus status,
        UUID promotionId,
        Instant createdAt
) {
}
