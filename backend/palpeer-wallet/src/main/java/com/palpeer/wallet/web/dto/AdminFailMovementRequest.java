package com.palpeer.wallet.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Fail a funding/withdrawal with Google Authenticator step-up. */
public record AdminFailMovementRequest(
        String reason,
        @NotBlank @Pattern(regexp = "\\d{6}", message = "Code must be 6 digits") String code) {}
