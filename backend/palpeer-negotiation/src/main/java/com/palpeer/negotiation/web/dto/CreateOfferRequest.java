package com.palpeer.negotiation.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateOfferRequest(
        @NotNull UUID p2pRequestId,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal amount,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal rate
) {
}
