package com.palpeer.auth.web.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthTokensResponse(
        UUID userId,
        String accessToken,
        String refreshToken,
        String tokenType,
        Boolean mfaRequired,
        String mfaToken
) {
    public static AuthTokensResponse of(UUID userId, String accessToken, String refreshToken) {
        return new AuthTokensResponse(userId, accessToken, refreshToken, "Bearer", null, null);
    }

    public static AuthTokensResponse mfaChallenge(UUID userId, String mfaToken) {
        return new AuthTokensResponse(userId, null, null, "Bearer", true, mfaToken);
    }
}
