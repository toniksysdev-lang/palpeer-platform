package com.palpeer.p2p.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

public record UpdateP2PRequestDto(
        @DecimalMin(value = "0", inclusive = false) BigDecimal amount,
        @DecimalMin(value = "0", inclusive = false) BigDecimal rate,
        Instant expiresAt,
        @Size(max = 500) String notes,
        /** When set, updates whether PENDING bonus credit should apply to the buyer fee. */
        Boolean applyBonusCredit
) {
}
