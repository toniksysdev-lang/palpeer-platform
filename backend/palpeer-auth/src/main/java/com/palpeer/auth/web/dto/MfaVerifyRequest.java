package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.NotBlank;

public record MfaVerifyRequest(
        @NotBlank String mfaToken,
        /** 6-digit TOTP or a one-time recovery code ({@code XXXX-XXXX}). */
        @NotBlank String code) {}
