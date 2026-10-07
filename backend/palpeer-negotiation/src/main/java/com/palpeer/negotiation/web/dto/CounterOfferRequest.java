package com.palpeer.negotiation.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CounterOfferRequest(
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal amount,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal rate
) {
}
