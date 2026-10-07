package com.palpeer.exchange.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Calculate/preview input. Provide exactly one of sourceAmount or targetAmount.
 */
public record ExchangeCalculateRequest(
        @NotNull UUID sourceWalletId,
        @NotNull UUID targetWalletId,
        @DecimalMin(value = "0", inclusive = false) BigDecimal sourceAmount,
        @DecimalMin(value = "0", inclusive = false) BigDecimal targetAmount
) {
}
