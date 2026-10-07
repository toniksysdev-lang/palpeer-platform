package com.palpeer.promotion.web.dto;

import com.palpeer.promotion.domain.PromotionType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

public record CreatePromotionRequest(
        @NotBlank @Size(max = 40) String code,
        @NotBlank @Size(max = 200) String title,
        @Size(max = 2000) String description,
        @NotNull PromotionType promotionType,
        Instant startsAt,
        Instant endsAt,
        @DecimalMin("0.000000000001") BigDecimal bonusAmount,
        @Size(max = 10) String bonusCurrencyCode
) {
}
