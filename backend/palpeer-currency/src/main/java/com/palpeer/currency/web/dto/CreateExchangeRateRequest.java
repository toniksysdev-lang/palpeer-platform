package com.palpeer.currency.web.dto;

import com.palpeer.currency.domain.RateChannel;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

public record CreateExchangeRateRequest(
        @NotBlank @Size(min = 3, max = 10) String baseCurrencyCode,
        @NotBlank @Size(min = 3, max = 10) String quoteCurrencyCode,
        RateChannel channel,
        Boolean submitForApproval,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal buyRate,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal sellRate,
        @NotNull Instant effectiveDate
) {
}
