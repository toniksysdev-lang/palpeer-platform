package com.palpeer.auth.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.palpeer.auth.config.AuthProperties;
import com.palpeer.common.exception.BusinessException;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.Arrays;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Verifies Google Sign-In ID tokens against configured OAuth client IDs (audiences).
 */
@Service
@Slf4j
public class GoogleIdTokenService {

    private final AuthProperties authProperties;
    private final NetHttpTransport transport = new NetHttpTransport();
    private final GsonFactory jsonFactory = GsonFactory.getDefaultInstance();

    public GoogleIdTokenService(AuthProperties authProperties) {
        this.authProperties = authProperties;
    }

    public boolean isConfigured() {
        return !audiences().isEmpty();
    }

    public GoogleIdentity verify(String idTokenRaw) {
        List<String> audiences = audiences();
        if (audiences.isEmpty()) {
            throw new BusinessException(
                    "GOOGLE_AUTH_DISABLED",
                    "Google Sign-In is not configured",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }

        GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(transport, jsonFactory)
                .setAudience(audiences)
                .build();

        try {
            GoogleIdToken idToken = verifier.verify(idTokenRaw);
            if (idToken == null) {
                throw new BusinessException(
                        "INVALID_GOOGLE_TOKEN", "Invalid Google ID token", HttpStatus.UNAUTHORIZED);
            }
            GoogleIdToken.Payload payload = idToken.getPayload();
            String email = payload.getEmail();
            Boolean emailVerified = payload.getEmailVerified();
            if (email == null || email.isBlank() || !Boolean.TRUE.equals(emailVerified)) {
                throw new BusinessException(
                        "GOOGLE_EMAIL_UNVERIFIED",
                        "Google account email is missing or unverified",
                        HttpStatus.UNAUTHORIZED);
            }
            return new GoogleIdentity(payload.getSubject(), email.trim().toLowerCase());
        } catch (BusinessException ex) {
            throw ex;
        } catch (GeneralSecurityException | IOException | IllegalArgumentException ex) {
            log.warn("Google ID token verification failed: {}", ex.toString());
            throw new BusinessException(
                    "INVALID_GOOGLE_TOKEN", "Invalid Google ID token", HttpStatus.UNAUTHORIZED);
        }
    }

    private List<String> audiences() {
        String raw = authProperties.getGoogle().getClientIds();
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public record GoogleIdentity(String subject, String email) {}
}
