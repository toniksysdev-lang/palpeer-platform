package com.palpeer.wallet.funding.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;

public record CreateFundingRequest(
        @NotNull UUID walletId,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal amount,
        String providerReference
) {
}
