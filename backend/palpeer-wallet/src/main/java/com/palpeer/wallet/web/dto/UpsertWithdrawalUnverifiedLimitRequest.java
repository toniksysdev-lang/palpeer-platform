package com.palpeer.wallet.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record UpsertWithdrawalUnverifiedLimitRequest(
        @NotBlank String currencyCode,
        @NotNull @DecimalMin("0.00") BigDecimal maxAmount) {}
