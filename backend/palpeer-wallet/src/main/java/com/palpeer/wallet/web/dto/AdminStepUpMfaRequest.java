package com.palpeer.wallet.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Google Authenticator (TOTP) code required for sensitive money operations. */
public record AdminStepUpMfaRequest(
        @NotBlank @Pattern(regexp = "\\d{6}", message = "Code must be 6 digits") String code) {}
