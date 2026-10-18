package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Password login. {@code email} accepts an email address or phone number
 * (kept as {@code email} for API compatibility with existing clients).
 *
 * <p>{@code deviceIdentifier} should be a stable per-install id from the mobile app so only one
 * device stays signed in. Admin scripts may omit it.
 */
public record LoginRequest(
        @NotBlank String email,
        @NotBlank String password,
        /** When true, issues a longer-lived refresh token for "Remember session". */
        Boolean rememberMe,
        /** Stable per-install identifier (mobile). */
        String deviceIdentifier,
        String deviceName,
        String platform
) {
    public DeviceLoginInfo device() {
        return DeviceLoginInfo.of(deviceIdentifier, deviceName, platform);
    }
}
