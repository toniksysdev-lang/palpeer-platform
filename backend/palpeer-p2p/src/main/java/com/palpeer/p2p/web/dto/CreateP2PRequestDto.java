package com.palpeer.p2p.web.dto;

import com.palpeer.p2p.domain.P2PSide;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

public record CreateP2PRequestDto(
        @NotNull P2PSide side,
        @NotBlank @Size(min = 3, max = 10) String baseCurrencyCode,
        @NotBlank @Size(min = 3, max = 10) String quoteCurrencyCode,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal amount,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal rate,
        Instant expiresAt,
        @Size(max = 500) String notes,
        /** Optional; when true on a BUY listing, apply PENDING bonus credit to the fee at settle. */
        Boolean applyBonusCredit
) {
}
