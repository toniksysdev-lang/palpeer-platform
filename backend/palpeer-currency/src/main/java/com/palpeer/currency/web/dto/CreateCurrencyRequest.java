package com.palpeer.currency.web.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateCurrencyRequest(
        @NotBlank @Size(min = 3, max = 10) String code,
        @NotBlank @Size(max = 10) String symbol,
        @Min(0) @Max(18) int precision
) {
}
