package com.palpeer.p2p.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record UpsertP2PRateBoundsRequest(
        @NotBlank @Size(min = 3, max = 10) String baseCurrencyCode,
        @NotBlank @Size(min = 3, max = 10) String quoteCurrencyCode,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal minRate,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal maxRate
) {
}
