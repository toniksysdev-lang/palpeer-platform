package com.palpeer.wallet.web.dto;

import com.palpeer.wallet.domain.PlatformFeeSourceType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PlatformFeeRevenueResponse(
        UUID id,
        PlatformFeeSourceType sourceType,
        String referenceType,
        UUID referenceId,
        UUID userId,
        String userEmail,
        String currencyCode,
        BigDecimal amount,
        String description,
        Instant createdAt
) {
}
