package com.palpeer.wallet.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record UpsertPoolFundThresholdRequest(
        @NotBlank String provider,
        @NotBlank String currencyCode,
        @NotNull @DecimalMin("0.00") BigDecimal thresholdAmount,
        List<UUID> notifyAdminUserIds,
        List<String> notifyPhones) {}
