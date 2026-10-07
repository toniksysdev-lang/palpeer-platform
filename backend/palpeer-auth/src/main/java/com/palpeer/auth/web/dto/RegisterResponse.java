package com.palpeer.auth.web.dto;

import java.util.UUID;

public record RegisterResponse(
        UUID userId,
        String email,
        String phone,
        String status,
        String message,
        /** Present only when `palpeer.security.otp.log-code` is true (local/dev autofill). */
        String debugOtp
) {
}
