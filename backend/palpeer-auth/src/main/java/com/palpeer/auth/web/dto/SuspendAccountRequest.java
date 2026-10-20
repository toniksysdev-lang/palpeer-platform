package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Confirm emergency account suspension from a new-device alert email.
 * The one-time lock key comes from {@code /secure/account-lock/{key}}; email/password/PIN are
 * checked against the database and are never embedded in the link. The key alone cannot suspend.
 */
public record SuspendAccountRequest(
        @NotBlank String token,
        @NotBlank String email,
        @NotBlank String password,
        @NotBlank String pin
) {}
