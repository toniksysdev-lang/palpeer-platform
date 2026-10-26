package com.palpeer.wallet.provider.kuda;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.palpeer.common.exception.BusinessException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
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
 * Docs: https://business-support.kuda.com/ and https://kuda.com/business/open-api/
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

    public boolean isSandboxMode() {
        return properties.isSandbox();
    }

    public JsonNode invoke(String serviceType, Map<String, Object> data) {
        return invoke(serviceType, data, shortRequestRef());
    }

    /**
     * @param requestRef short unique ref (keep for {@code TRANSACTION_STATUS_QUERY} /
     *     {@code DYNAMIC_COLLECTION_ACCOUNT_TSQ}).
     */
    public JsonNode invoke(String serviceType, Map<String, Object> data, String requestRef) {
        requireConfigured();
        ObjectNode envelope = objectMapper.createObjectNode();
        envelope.put("serviceType", serviceType);
        // Kuda prefers short request refs for money-movement calls.
        envelope.put(
                "requestRef",
                notBlank(requestRef) ? requestRef.trim() : shortRequestRef());
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
            requireSuccessful(root, serviceType);
            return unwrap(root);
        } catch (RestClientResponseException ex) {
            log.error("Kuda {} failed: {} {}", serviceType, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new BusinessException(
                    "KUDA_ERROR",
                    "Kuda request failed: " + ex.getStatusCode().value(),
                    HttpStatus.BAD_GATEWAY);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("KUDA_ERROR", "Kuda request failed", HttpStatus.BAD_GATEWAY);
        }
    }

    public long toKobo(BigDecimal amount) {
        return amount.movePointRight(2).setScale(0, RoundingMode.HALF_EVEN).longValueExact();
    }

    /**
     * Confirms a prior {@code SINGLE_FUND_TRANSFER} using its original {@code requestRef}.
     * Use after timeouts / pending responses before treating the payout as failed.
     */
    public JsonNode queryTransferStatus(String transferRequestRef) {
        return invoke(
                "TRANSACTION_STATUS_QUERY",
                Map.of(
                        "isThirdPartyBankTransfer",
                        false,
                        "transactionRequestReference",
                        transferRequestRef.trim()),
                shortRequestRef());
    }

    /**
     * Confirms a dynamic collection account payment using the creation {@code requestRef} and/or
     * returned account number.
     */
    public JsonNode queryDynamicCollectionStatus(String accountCreationRequestRef, String accountNumber) {
        Map<String, Object> data = new java.util.HashMap<>();
        if (notBlank(accountCreationRequestRef)) {
            data.put("accountCreationRequestRef", accountCreationRequestRef.trim());
        }
        if (notBlank(accountNumber)) {
            data.put("accountNumber", accountNumber.trim());
        }
        return invoke("DYNAMIC_COLLECTION_ACCOUNT_TSQ", data, shortRequestRef());
    }

    public static BigDecimal fromKobo(long kobo) {
        return BigDecimal.valueOf(kobo).movePointLeft(2);
    }

    /**
     * Full NIP bank directory for the active Kuda environment ({@code BANK_LIST}).
     * Returns the banks array node, or an empty array when none are present.
     */
    public JsonNode listBanks() {
        JsonNode root = invoke("BANK_LIST", Map.of());
        JsonNode banks = firstArray(root, "banks", "Banks");
        if (banks != null) {
            return banks;
        }
        JsonNode data = root.path("data");
        if (data.isMissingNode() || data.isNull()) {
            data = root.path("Data");
        }
        banks = firstArray(data.isMissingNode() ? root : data, "banks", "Banks");
        return banks != null ? banks : objectMapper.createArrayNode();
    }

    private static JsonNode firstArray(JsonNode node, String... fields) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isArray()) {
            return node;
        }
        for (String field : fields) {
            JsonNode child = node.path(field);
            if (child.isArray()) {
                return child;
            }
        }
        return null;
    }

    /**
     * Main business account available balance in NGN (not kobo). Null when Kuda is disabled.
     */
    public BigDecimal getMainAccountBalance() {
        if (!isConfigured()) {
            return null;
        }
        JsonNode root = invoke("ADMIN_RETRIEVE_MAIN_ACCOUNT_BALANCE", Map.of());
        JsonNode data = root.path("data");
        if (data.isMissingNode() || data.isNull()) {
            data = root.path("Data");
        }
        if (data.isMissingNode() || data.isNull()) {
            data = root;
        }
        Long kobo = firstLong(
                data,
                "availableBalance",
                "AvailableBalance",
                "withdrawableBalance",
                "WithdrawableBalance",
                "ledgerBalance",
                "LedgerBalance");
        if (kobo == null) {
            log.warn("Kuda balance response did not include a recognised balance field: {}", root);
            return null;
        }
        return fromKobo(kobo);
    }

    private static Long firstLong(JsonNode node, String... fields) {
        if (node == null) {
            return null;
        }
        for (String field : fields) {
            JsonNode child = node.path(field);
            if (child.isMissingNode() || child.isNull()) {
                continue;
            }
            if (child.isNumber()) {
                return child.longValue();
            }
            if (child.isTextual()) {
                try {
                    return new BigDecimal(child.asText().trim()).longValue();
                } catch (NumberFormatException ignored) {
                    // continue
                }
            }
        }
        return null;
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
                throw new BusinessException(
                        "KUDA_AUTH_FAILED", "Kuda token response empty", HttpStatus.BAD_GATEWAY);
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
                ? "https://kuda-openapi-uat.kudabank.com/v2.1"
                : "https://kuda-openapi.kuda.com/v2.1";
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new BusinessException(
                    "KUDA_DISABLED",
                    "Kuda is not configured (KUDA_ENABLED + KUDA_EMAIL + KUDA_API_KEY)",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private void requireSuccessful(JsonNode root, String serviceType) {
        if (root == null) {
            return;
        }
        if (root.has("RequestSuccessful") && root.get("RequestSuccessful").isBoolean()
                && !root.get("RequestSuccessful").asBoolean(true)) {
            throw kudaBusinessError(root, serviceType);
        }
        if (root.has("requestSuccessful") && root.get("requestSuccessful").isBoolean()
                && !root.get("requestSuccessful").asBoolean(true)) {
            throw kudaBusinessError(root, serviceType);
        }
        JsonNode status = root.get("status");
        if (status != null && status.isBoolean() && !status.asBoolean(true)) {
            throw kudaBusinessError(root, serviceType);
        }
        String statusCode = firstText(root, "statusCode", "StatusCode", "responseCode", "ResponseCode");
        if (statusCode != null
                && !statusCode.equals("00")
                && !statusCode.equals("0")
                && !statusCode.equalsIgnoreCase("success")) {
            // Some successful calls omit statusCode; only fail on an explicit non-success code.
            if (statusCode.matches("\\d+") && !"00".equals(statusCode) && !"0".equals(statusCode)) {
                throw kudaBusinessError(root, serviceType);
            }
        }
    }

    private static BusinessException kudaBusinessError(JsonNode root, String serviceType) {
        String message = firstText(root, "message", "Message", "statusMessage", "StatusMessage");
        if (message == null || message.isBlank()) {
            message = "Kuda " + serviceType + " failed";
        }
        // Surface name-enquiry failures under a dedicated code so the app can show bank-detail copy
        // instead of a generic payment-provider error.
        String code = "NAME_ENQUIRY".equals(serviceType) ? "KUDA_NAME_ENQUIRY_FAILED" : "KUDA_ERROR";
        return new BusinessException(code, message, HttpStatus.BAD_GATEWAY);
    }

    private static String firstText(JsonNode node, String... fields) {
        if (node == null) {
            return null;
        }
        for (String field : fields) {
            JsonNode child = node.path(field);
            if (!child.isMissingNode() && !child.isNull() && notBlank(child.asText())) {
                return child.asText();
            }
        }
        return null;
    }

    private JsonNode unwrap(JsonNode root) {
        if (root == null) {
            return objectMapper.createObjectNode();
        }
        JsonNode data = root.get("data");
        if (data == null || data.isNull() || data.isMissingNode()) {
            data = root.get("Data");
        }
        if (data != null && !data.isNull() && !data.isMissingNode()) {
            if (data.isTextual()) {
                try {
                    return objectMapper.readTree(data.asText());
                } catch (Exception ignored) {
                    return root;
                }
            }
            if (data.isObject()) {
                return data;
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
        return message.toLowerCase(Locale.ROOT).contains("unauthor") || status.equalsIgnoreCase("401");
    }

    private static String shortRequestRef() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
