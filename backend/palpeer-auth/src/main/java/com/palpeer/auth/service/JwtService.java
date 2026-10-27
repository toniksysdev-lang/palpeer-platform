package com.palpeer.auth.service;

import com.palpeer.auth.config.AuthProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    public static final String CLAIM_TOKEN_TYPE = "token_type";
    public static final String TOKEN_TYPE_ACCESS = "access";
    public static final String TOKEN_TYPE_REFRESH = "refresh";
    public static final String TOKEN_TYPE_MFA_CHALLENGE = "mfa_challenge";
    public static final String CLAIM_REMEMBER_ME = "remember_me";
    public static final String CLAIM_DEVICE_ID = "device_id";
    public static final String CLAIM_DEVICE_NAME = "device_name";
    public static final String CLAIM_PLATFORM = "platform";

    private final AuthProperties authProperties;
    private final SecretKey secretKey;

    public JwtService(AuthProperties authProperties) {
        this.authProperties = authProperties;
        this.secretKey = Keys.hmacShaKeyFor(
                authProperties.getJwt().getSecret().getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(UUID userId, String email) {
        Instant now = Instant.now();
        Instant expiry = now.plus(authProperties.getJwt().getAccessTokenTtl());
        return Jwts.builder()
                .issuer(authProperties.getJwt().getIssuer())
                .subject(userId.toString())
                .claim("email", email)
                .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE_ACCESS)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(secretKey)
                .compact();
    }

    public String createRefreshToken(UUID userId) {
        return createRefreshToken(userId, authProperties.getJwt().getRefreshTokenTtl());
    }

    public String createRefreshToken(UUID userId, Duration ttl) {
        Instant now = Instant.now();
        Instant expiry = now.plus(ttl);
        return Jwts.builder()
                .issuer(authProperties.getJwt().getIssuer())
                .subject(userId.toString())
                .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE_REFRESH)
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(secretKey)
                .compact();
    }

    /** Short-lived token proving password auth succeeded; exchanged for session after TOTP. */
    public String createMfaChallengeToken(
            UUID userId, boolean rememberMe, String deviceId, String deviceName, String platform) {
        Instant now = Instant.now();
        Instant expiry = now.plus(Duration.ofMinutes(5));
        var builder = Jwts.builder()
                .issuer(authProperties.getJwt().getIssuer())
                .subject(userId.toString())
                .claim(CLAIM_TOKEN_TYPE, TOKEN_TYPE_MFA_CHALLENGE)
                .claim(CLAIM_REMEMBER_ME, rememberMe)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(secretKey);
        if (deviceId != null && !deviceId.isBlank()) {
            builder.claim(CLAIM_DEVICE_ID, deviceId);
        }
        if (deviceName != null && !deviceName.isBlank()) {
            builder.claim(CLAIM_DEVICE_NAME, deviceName);
        }
        if (platform != null && !platform.isBlank()) {
            builder.claim(CLAIM_PLATFORM, platform);
        }
        return builder.compact();
    }

    public boolean isMfaChallengeToken(String token) {
        return TOKEN_TYPE_MFA_CHALLENGE.equals(parseClaims(token).get(CLAIM_TOKEN_TYPE, String.class));
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .requireIssuer(authProperties.getJwt().getIssuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(parseClaims(token).getSubject());
    }

    public boolean isAccessToken(String token) {
        return TOKEN_TYPE_ACCESS.equals(parseClaims(token).get(CLAIM_TOKEN_TYPE, String.class));
    }

    public boolean isRefreshToken(String token) {
        return TOKEN_TYPE_REFRESH.equals(parseClaims(token).get(CLAIM_TOKEN_TYPE, String.class));
    }

    public Instant extractExpiry(String token) {
        return parseClaims(token).getExpiration().toInstant();
    }
}
