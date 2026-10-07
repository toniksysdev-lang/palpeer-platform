package com.palpeer.auth.web.dto;

import java.util.UUID;

public record AuthTokensResponse(
        UUID userId,
        String accessToken,
        String refreshToken,
        String tokenType
) {
    public static AuthTokensResponse of(UUID userId, String accessToken, String refreshToken) {
        return new AuthTokensResponse(userId, accessToken, refreshToken, "Bearer");
    }
}
