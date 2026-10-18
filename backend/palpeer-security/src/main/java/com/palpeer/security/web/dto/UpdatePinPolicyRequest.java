package com.palpeer.security.web.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record UpdatePinPolicyRequest(
        @Min(1) @Max(50) int maxWrongAttempts,
        @NotNull @DecimalMin("0.01") @DecimalMax("720") BigDecimal lockoutHours) {}
