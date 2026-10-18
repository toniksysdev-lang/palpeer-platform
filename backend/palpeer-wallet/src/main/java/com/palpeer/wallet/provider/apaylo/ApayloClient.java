package com.palpeer.wallet.provider.apaylo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.common.exception.BusinessException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Apaylo Merchant API client.
 *
 * <p>Auth (per https://docs.apaylo.com/docs/api-overview): headers {@code Key} + {@code Signature},
 * where Signature is Base64(SHA512(apiKey + sharedSecret + yyyy-MM-dd UTC)).
 *
 * <p>Sandbox env2 host: {@code https://sandboxapi.apaylo.com/sandboxapi.apaylo.com/api}
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ApayloClient {

    private static final DateTimeFormatter SIGNATURE_DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private final ApayloProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient.Builder restClientBuilder;
    private final Clock clock = Clock.systemUTC();

    public boolean isConfigured() {
        return properties.isEnabled()
                && notBlank(properties.getApiKey())
                && notBlank(properties.getSharedKey());
    }

    public JsonNode post(String path, Map<String, Object> body) {
        requireConfigured();
        Map<String, Object> payload = body == null ? new HashMap<>() : new HashMap<>(body);
        URI uri = URI.create(joinUrl(resolveBaseUrl(), path));
        try {
            String raw = client()
                    .post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(this::applyAuth)
                    .body(payload)
                    .retrieve()
                    .body(String.class);
            return requireSuccess(parseBody(raw), path);
        } catch (RestClientResponseException ex) {
            log.error("Apaylo POST {} failed: {} {}", uri, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw apayloHttpError(ex);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Apaylo POST {} failed: {}", uri, ex.toString());
            throw new BusinessException("APAYLO_ERROR", "Apaylo request failed", HttpStatus.BAD_GATEWAY);
        }
    }

    public JsonNode get(String path) {
        requireConfigured();
        URI uri = URI.create(joinUrl(resolveBaseUrl(), path));
        try {
            String raw = client()
                    .get()
                    .uri(uri)
                    .headers(this::applyAuth)
                    .retrieve()
                    .body(String.class);
            return requireSuccess(parseBody(raw), path);
        } catch (RestClientResponseException ex) {
            log.error("Apaylo GET {} failed: {} {}", uri, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw apayloHttpError(ex);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Apaylo GET {} failed: {}", uri, ex.toString());
            throw new BusinessException("APAYLO_ERROR", "Apaylo request failed", HttpStatus.BAD_GATEWAY);
        }
    }

    private BusinessException apayloHttpError(RestClientResponseException ex) {
        String detail = extractErrorMessage(ex.getResponseBodyAsString());
        return new BusinessException(
                "APAYLO_ERROR",
                detail == null || detail.isBlank()
                        ? "Apaylo request failed: " + ex.getStatusCode().value()
                        : detail,
                HttpStatus.BAD_GATEWAY);
    }

    private String extractErrorMessage(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(rawBody);
            String message = text(node, "Message");
            if (message == null || message.isBlank()) {
                message = text(node.path("Result"), "Message");
            }
            return message;
        } catch (Exception ignored) {
            return null;
        }
    }

    /**
     * Merchant wallet balance via {@code GET /Merchant/GetBalance}.
     * Prefers {@code AvailableBalance} (funds usable for sends) over {@code ActualBalance}.
     */
    public BigDecimal getAccountBalance() {
        if (!isConfigured()) {
            return null;
        }
        JsonNode response = get(properties.getAccountBalancePath());
        if (response.path("IsError").asBoolean(false)) {
            String message = text(response, "Message");
            throw new BusinessException(
                    "APAYLO_ERROR",
                    message == null || message.isBlank() ? "Apaylo GetBalance returned an error" : message,
                    HttpStatus.BAD_GATEWAY);
        }
        BigDecimal balance = firstDecimal(
                response,
                "AvailableBalance",
                "availableBalance",
                "ActualBalance",
                "actualBalance",
                "Balance",
                "balance",
                "ClearedBalance",
                "AccountBalance",
                "CurrentBalance");
        if (balance == null) {
            log.warn("Apaylo balance response did not include a recognised balance field: {}", response);
        }
        return balance;
    }

    /**
     * Base64(SHA-512(apiKey + sharedSecret + yyyy-MM-dd)) using UTC date, matching Apaylo docs.
     */
    static String buildSignature(String apiKey, String sharedSecret, LocalDate utcDate) {
        String concatenated = apiKey + sharedSecret + SIGNATURE_DATE.format(utcDate);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-512");
            byte[] hash = digest.digest(concatenated.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to build Apaylo signature", ex);
        }
    }

    private void applyAuth(org.springframework.http.HttpHeaders headers) {
        String apiKey = properties.getApiKey().trim();
        LocalDate today = LocalDate.now(clock.withZone(ZoneOffset.UTC));
        headers.set("Key", apiKey);
        headers.set("Signature", buildSignature(apiKey, properties.getSharedKey().trim(), today));
    }

    private RestClient client() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(45));
        // No baseUrl: Apaylo hosts include a path segment (…/api). RestClient treats
        // "/Merchant/…" as an absolute path and would strip that segment (404).
        return restClientBuilder
                .clone()
                .requestFactory(requestFactory)
                .build();
    }

    private String resolveBaseUrl() {
        if (properties.isSandbox()) {
            if (notBlank(properties.getSandboxBaseUrl())) {
                return trimSlash(properties.getSandboxBaseUrl());
            }
            return "https://sandboxapi.apaylo.com/sandboxapi.apaylo.com/api";
        }
        return trimSlash(properties.getBaseUrl());
    }

    /**
     * Join base + path without dropping Apaylo's {@code /…/api} path prefix.
     * Absolute paths like {@code /Merchant/GetBalance} must not replace the base path.
     */
    static String joinUrl(String baseUrl, String path) {
        String base = trimSlash(baseUrl);
        if (path == null || path.isBlank()) {
            return base;
        }
        String trimmed = path.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        while (trimmed.startsWith("/")) {
            trimmed = trimmed.substring(1);
        }
        return base + "/" + trimmed;
    }

    private JsonNode parseBody(String raw) throws Exception {
        if (raw == null || raw.isBlank()) {
            return objectMapper.createObjectNode();
        }
        return objectMapper.readTree(raw);
    }

    private JsonNode requireSuccess(JsonNode response, String path) {
        if (response != null && response.path("IsError").asBoolean(false)) {
            String message = text(response, "Message");
            if (message == null || message.isBlank()) {
                message = text(response.path("Result"), "Message");
            }
            log.error("Apaylo {} returned IsError=true: {}", path, response);
            throw new BusinessException(
                    "APAYLO_ERROR",
                    message == null || message.isBlank() ? "Apaylo returned an error" : message,
                    HttpStatus.BAD_GATEWAY);
        }
        return response;
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new BusinessException(
                    "APAYLO_DISABLED",
                    "Apaylo is not configured (APAYLO_ENABLED + APAYLO_API_KEY + APAYLO_SHARED_KEY)",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private static String text(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode child = node.path(field);
        if (child.isMissingNode() || child.isNull()) {
            return null;
        }
        return child.asText();
    }

    private static BigDecimal firstDecimal(JsonNode node, String... fields) {
        if (node == null) {
            return null;
        }
        for (String field : fields) {
            BigDecimal value = asDecimal(node.path(field));
            if (value != null) {
                return value;
            }
            value = asDecimal(node.path("Data").path(field));
            if (value != null) {
                return value;
            }
            value = asDecimal(node.path("Result").path(field));
            if (value != null) {
                return value;
            }
            value = asDecimal(node.path("data").path(field));
            if (value != null) {
                return value;
            }
        }
        return findBalanceLeaf(node);
    }

    private static BigDecimal findBalanceLeaf(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                if (entry.getKey().toLowerCase().contains("balance")) {
                    BigDecimal value = asDecimal(entry.getValue());
                    if (value != null) {
                        return value;
                    }
                }
                BigDecimal nested = findBalanceLeaf(entry.getValue());
                if (nested != null) {
                    return nested;
                }
            }
        }
        return null;
    }

    private static BigDecimal asDecimal(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isNumber()) {
            return node.decimalValue();
        }
        if (node.isTextual()) {
            String text = node.asText().trim().replace(",", "");
            if (text.isEmpty()) {
                return null;
            }
            try {
                return new BigDecimal(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimSlash(String url) {
        if (url == null || url.isBlank()) {
            return "https://api.etransfer.apaylo.com/api.apaylo.com/api";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
