package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Password login. {@code email} accepts an email address or phone number
 * (kept as {@code email} for API compatibility with existing clients).
 */
public record LoginRequest(
        @NotBlank String email,
        @NotBlank String password,
        /** When true, issues a longer-lived refresh token for "Remember session". */
        Boolean rememberMe
) {
}
