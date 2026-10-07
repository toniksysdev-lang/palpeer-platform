package com.palpeer.wallet.provider.kuda;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.palpeer.common.exception.BusinessException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Kuda OpenAPI client (token + serviceType envelope).
 * Docs: https://kuda.com/business/open-api/ and https://kudabank.gitbook.io/kudabank/
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KudaClient {

    private final KudaProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient.Builder restClientBuilder;
    private final AtomicReference<String> cachedToken = new AtomicReference<>();

    public boolean isConfigured() {
        return properties.isEnabled()
                && notBlank(properties.getEmail())
                && notBlank(properties.getApiKey());
    }

    public JsonNode invoke(String serviceType, Map<String, Object> data) {
        requireConfigured();
        ObjectNode envelope = objectMapper.createObjectNode();
        envelope.put("serviceType", serviceType);
        envelope.put("requestRef", UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        envelope.set("data", objectMapper.valueToTree(data == null ? Map.of() : data));

        try {
            String raw = client(token(false))
                    .post()
                    .uri("")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(envelope)
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(raw == null ? "{}" : raw);
            if (isUnauthorized(root)) {
                cachedToken.set(null);
                raw = client(token(true))
                        .post()
                        .uri("")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(envelope)
                        .retrieve()
                        .body(String.class);
                root = objectMapper.readTree(raw == null ? "{}" : raw);
            }
            return unwrap(root);
        } catch (RestClientResponseException ex) {
            log.error("Kuda {} failed: {} {}", serviceType, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new BusinessException("KUDA_ERROR", "Kuda request failed: " + ex.getStatusCode().value(), HttpStatus.BAD_GATEWAY);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("KUDA_ERROR", "Kuda request failed", HttpStatus.BAD_GATEWAY);
        }
    }

    public long toKobo(BigDecimal amount) {
        return amount.movePointRight(2).setScale(0, RoundingMode.HALF_EVEN).longValueExact();
    }

    private String token(boolean forceRefresh) {
        if (!forceRefresh) {
            String existing = cachedToken.get();
            if (notBlank(existing)) {
                return existing;
            }
        }
        try {
            String raw = restClientBuilder
                    .baseUrl(resolveBaseUrl())
                    .build()
                    .post()
                    .uri("/Account/GetToken")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "email", properties.getEmail().trim(),
                            "apiKey", properties.getApiKey().trim()))
                    .retrieve()
                    .body(String.class);
            String token = raw == null ? "" : raw.replace("\"", "").trim();
            if (!notBlank(token)) {
                throw new BusinessException("KUDA_AUTH_FAILED", "Kuda token response empty", HttpStatus.BAD_GATEWAY);
            }
            cachedToken.set(token);
            return token;
        } catch (RestClientResponseException ex) {
            throw new BusinessException("KUDA_AUTH_FAILED", "Kuda GetToken failed", HttpStatus.BAD_GATEWAY);
        }
    }

    private RestClient client(String bearer) {
        return restClientBuilder
                .baseUrl(resolveBaseUrl())
                .defaultHeader("Authorization", "Bearer " + bearer)
                .build();
    }

    private String resolveBaseUrl() {
        if (notBlank(properties.getBaseUrl())) {
            return trimSlash(properties.getBaseUrl());
        }
        return properties.isSandbox()
                ? "https://kuda-openapi-uat.kudabank.com/v2"
                : "https://kuda-openapi.kuda.com/v2";
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new BusinessException(
                    "KUDA_DISABLED",
                    "Kuda is not configured (KUDA_ENABLED + KUDA_EMAIL + KUDA_API_KEY)",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private JsonNode unwrap(JsonNode root) {
        if (root == null) {
            return objectMapper.createObjectNode();
        }
        // Some responses nest payload under data/Data
        if (root.has("data") && root.get("data").isTextual()) {
            try {
                return objectMapper.readTree(root.get("data").asText());
            } catch (Exception ignored) {
                return root;
            }
        }
        return root;
    }

    private static boolean isUnauthorized(JsonNode root) {
        if (root == null) {
            return false;
        }
        String message = root.path("message").asText("");
        String status = root.path("status").asText("");
        return message.toLowerCase().contains("unauthor") || status.equalsIgnoreCase("401");
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
