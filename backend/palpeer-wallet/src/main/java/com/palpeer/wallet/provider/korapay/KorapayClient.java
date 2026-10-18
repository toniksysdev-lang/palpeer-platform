package com.palpeer.wallet.provider.korapay;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.common.exception.BusinessException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.HashMap;
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
 * Korapay Merchant API client (secret-key Bearer auth).
 * Docs: https://developers.korapay.com/docs/bank-transfers
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KorapayClient {

    private final KorapayProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient.Builder restClientBuilder;

    public boolean isConfigured() {
        return properties.isEnabled()
                && notBlank(properties.getSecretKey())
                && notBlank(properties.getBaseUrl());
    }

    public boolean isSandboxMode() {
        if (properties.isSandbox()) {
            return true;
        }
        String secret = properties.getSecretKey();
        return secret != null && secret.trim().startsWith("sk_test_");
    }

    /**
     * Creates a one-time NGN bank-transfer charge and returns the Korapay payload ({@code data}).
     */
    public JsonNode initiateBankTransfer(
            String reference,
            BigDecimal amount,
            String customerEmail,
            String customerName,
            boolean merchantBearsCost) {
        Map<String, Object> customer = new HashMap<>();
        customer.put("email", customerEmail);
        if (notBlank(customerName)) {
            customer.put("name", customerName);
        }
        Map<String, Object> body = new HashMap<>();
        body.put("reference", reference);
        body.put("amount", amount);
        body.put("currency", "NGN");
        body.put("customer", customer);
        body.put("narration", "PALPEER wallet funding");
        body.put("merchant_bears_cost", merchantBearsCost);
        if (isSandboxMode()) {
            // Caller will credit explicitly; avoid waiting on Korapay's ~2 minute auto settle.
            body.put("auto_complete", false);
        }
        JsonNode root = post(properties.getBankTransferPath(), body);
        requireOk(root, "Bank transfer initiate");
        return root.path("data");
    }

    /** Sandbox-only: simulate a customer transfer into the temporary account. */
    public void sandboxCredit(String accountNumber, BigDecimal amount) {
        Map<String, Object> body = Map.of(
                "account_number", accountNumber,
                "currency", "NGN",
                "amount", amount
        );
        JsonNode root = post(properties.getSandboxCreditPath(), body);
        requireOk(root, "Sandbox credit");
    }

    public JsonNode getCharge(String reference) {
        JsonNode root = get(trimSlash(properties.getChargeQueryPath()) + "/" + reference);
        requireOk(root, "Charge query");
        return root.path("data");
    }

    /**
     * Disburse NGN from the merchant Korapay balance to a Nigerian bank account.
     * Docs: https://developers.korapay.com/docs/payout-via-api
     */
    public JsonNode disburse(
            String reference,
            BigDecimal amount,
            String bankCode,
            String accountNumber,
            String customerEmail,
            String customerName) {
        Map<String, Object> bankAccount = new HashMap<>();
        bankAccount.put("bank", bankCode);
        bankAccount.put("account", accountNumber);

        Map<String, Object> customer = new HashMap<>();
        customer.put("email", customerEmail);
        if (notBlank(customerName)) {
            customer.put("name", customerName);
        }

        Map<String, Object> destination = new HashMap<>();
        destination.put("type", "bank_account");
        destination.put("amount", amount);
        destination.put("currency", "NGN");
        destination.put("narration", "PALPEER wallet withdrawal");
        destination.put("bank_account", bankAccount);
        destination.put("customer", customer);

        Map<String, Object> body = new HashMap<>();
        body.put("reference", reference);
        body.put("destination", destination);

        JsonNode root = post(properties.getDisbursePath(), body);
        requireOk(root, "Payout disburse");
        return root.path("data");
    }

    /** Query a charge or payout by merchant reference. */
    public JsonNode getTransaction(String reference) {
        JsonNode root = get(trimSlash(properties.getTransactionQueryPath()) + "/" + reference);
        requireOk(root, "Transaction query");
        return root.path("data");
    }

    /**
     * List banks available for payouts in a country (e.g. {@code NG}).
     * Docs: https://developers.korapay.com/docs/payout-via-api
     */
    public JsonNode listBanks(String countryCode) {
        String code = countryCode == null || countryCode.isBlank() ? "NG" : countryCode.trim().toUpperCase();
        JsonNode root = get(trimSlash(properties.getBanksPath()) + "?countryCode=" + code);
        requireOk(root, "List banks");
        return root.path("data");
    }

    /**
     * Merchant balances keyed by currency (e.g. {@code NGN.available_balance}).
     * Docs: https://developers.korapay.com/docs/balance-api
     */
    public JsonNode getBalances() {
        JsonNode root = get(properties.getBalancesPath());
        requireOk(root, "Balances");
        return root.path("data");
    }

    /** Available balance for a currency, or {@code null} if missing. */
    public BigDecimal getAvailableBalance(String currencyCode) {
        String code = currencyCode == null || currencyCode.isBlank()
                ? "NGN"
                : currencyCode.trim().toUpperCase();
        JsonNode currency = getBalances().path(code);
        if (currency.isMissingNode() || currency.isNull()) {
            return null;
        }
        return firstDecimal(currency, "available_balance", "availableBalance", "balance");
    }

    public BigDecimal getPendingBalance(String currencyCode) {
        String code = currencyCode == null || currencyCode.isBlank()
                ? "NGN"
                : currencyCode.trim().toUpperCase();
        JsonNode currency = getBalances().path(code);
        if (currency.isMissingNode() || currency.isNull()) {
            return null;
        }
        return firstDecimal(currency, "pending_balance", "pendingBalance");
    }

    private static BigDecimal firstDecimal(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode child = node.path(field);
            if (child.isMissingNode() || child.isNull()) {
                continue;
            }
            if (child.isNumber()) {
                return child.decimalValue();
            }
            String text = child.asText();
            if (text != null && !text.isBlank()) {
                try {
                    return new BigDecimal(text.trim());
                } catch (NumberFormatException ignored) {
                    // try next field
                }
            }
        }
        return null;
    }

    private JsonNode post(String path, Map<String, Object> body) {
        URI uri = URI.create(joinUrl(properties.getBaseUrl(), path));
        try {
            String raw = client()
                    .post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(h -> h.setBearerAuth(properties.getSecretKey().trim()))
                    .body(body)
                    .retrieve()
                    .body(String.class);
            return parse(raw);
        } catch (RestClientResponseException ex) {
            log.error("Korapay POST {} failed: {} {}", uri, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw korapayHttpError(ex);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Korapay POST {} failed: {}", uri, ex.toString());
            throw new BusinessException("KORAPAY_ERROR", "Korapay request failed", HttpStatus.BAD_GATEWAY);
        }
    }

    private JsonNode get(String path) {
        URI uri = URI.create(joinUrl(properties.getBaseUrl(), path));
        try {
            String raw = client()
                    .get()
                    .uri(uri)
                    .headers(h -> h.setBearerAuth(properties.getSecretKey().trim()))
                    .retrieve()
                    .body(String.class);
            return parse(raw);
        } catch (RestClientResponseException ex) {
            log.error("Korapay GET {} failed: {} {}", uri, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw korapayHttpError(ex);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Korapay GET {} failed: {}", uri, ex.toString());
            throw new BusinessException("KORAPAY_ERROR", "Korapay request failed", HttpStatus.BAD_GATEWAY);
        }
    }

    private RestClient client() {
        requireConfigured();
        // Force HTTP/1.1 — Cloudflare/Korapay often aborts JDK HttpClient HTTP/2 handshakes
        // ("Remote host terminated the handshake").
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(20))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(45));
        return restClientBuilder.clone().requestFactory(factory).build();
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new BusinessException(
                    "KORAPAY_DISABLED",
                    "Korapay is not configured (KORAPAY_ENABLED + KORAPAY_SECRET_KEY)",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private void requireOk(JsonNode root, String action) {
        if (root != null && root.path("status").isBoolean() && !root.path("status").asBoolean(true)) {
            String message = text(root, "message");
            throw new BusinessException(
                    "KORAPAY_ERROR",
                    message == null || message.isBlank() ? action + " failed" : message,
                    HttpStatus.BAD_GATEWAY);
        }
    }

    private BusinessException korapayHttpError(RestClientResponseException ex) {
        String detail = null;
        try {
            JsonNode node = objectMapper.readTree(ex.getResponseBodyAsString());
            detail = text(node, "message");
        } catch (Exception ignored) {
            // keep null
        }
        return new BusinessException(
                "KORAPAY_ERROR",
                detail == null || detail.isBlank()
                        ? "Korapay request failed: " + ex.getStatusCode().value()
                        : detail,
                HttpStatus.BAD_GATEWAY);
    }

    private JsonNode parse(String raw) throws Exception {
        if (raw == null || raw.isBlank()) {
            return objectMapper.createObjectNode();
        }
        return objectMapper.readTree(raw);
    }

    static String joinUrl(String baseUrl, String path) {
        String base = trimSlash(baseUrl == null || baseUrl.isBlank() ? "https://api.korapay.com" : baseUrl);
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

    private static String text(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode child = node.path(field);
        return child.isMissingNode() || child.isNull() ? null : child.asText();
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimSlash(String url) {
        if (url == null || url.isBlank()) {
            return "";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
