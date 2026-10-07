package com.palpeer.wallet.provider.apaylo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.provider.PaymentRailProvider;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Apaylo CAD rails — Interac e-Transfer for funding/payout and EFT for bank withdrawals.
 * Docs: https://docs.apaylo.com/docs/get-started
 * Product: https://www.apaylo.com (merchant API Key + Password headers).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ApayloPaymentRail implements PaymentRailProvider {

    public static final String NAME = "APAYLO";

    private final ApayloProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient.Builder restClientBuilder;

    @Override
    public String providerName() {
        return NAME;
    }

    @Override
    public Set<String> supportedCurrencies() {
        return Set.of("CAD");
    }

    @Override
    public boolean isEnabled() {
        return properties.isEnabled()
                && notBlank(properties.getApiKey())
                && notBlank(properties.getSharedKey());
    }

    @Override
    public FundingInitiation initiateFunding(FundingInitiationRequest request) {
        requireEnabled();
        Map<String, Object> body = new HashMap<>();
        body.put("CustomerName", joinName(request.customerFirstName(), request.customerLastName(), request.userEmail()));
        body.put("CustomerEmail", request.userEmail());
        body.put("Amount", request.amount());
        body.put("Description", "PALPEER wallet funding " + request.fundingTransactionId());
        body.put("MerchantReferenceNumber", request.idempotencyKey());
        body.put("TransactionNumber", request.fundingTransactionId().toString());

        JsonNode response = post(properties.getCreateSearchableEtransferPath(), body);
        String reference = firstNonBlank(
                text(response, "TransactionNumber"),
                text(response, "ReferenceNumber"),
                text(response, "InteracReference"),
                request.fundingTransactionId().toString());
        String instructions = "Pay via Interac e-Transfer Request Money. Reference=" + reference
                + "; amount=CAD " + request.amount()
                + "; follow Apaylo/Interac instructions in your email if sent.";
        return new FundingInitiation(reference, instructions, true);
    }

    @Override
    public WithdrawalInitiation initiateWithdrawal(WithdrawalInitiationRequest request) {
        requireEnabled();
        String destination = request.destinationReference() == null ? "" : request.destinationReference().trim();
        JsonNode response;
        if (looksLikeEft(destination)) {
            String[] parts = destination.split("[:|;\\-]");
            if (parts.length < 3) {
                throw new BusinessException(
                        "APAYLO_DESTINATION_INVALID",
                        "CAD EFT destination must be institution:transit:account",
                        HttpStatus.BAD_REQUEST);
            }
            Map<String, Object> body = new HashMap<>();
            body.put("Amount", request.amount());
            body.put("InstitutionNumber", parts[0].trim());
            body.put("TransitNumber", parts[1].trim());
            body.put("AccountNumber", parts[2].trim());
            body.put("MerchantReferenceNumber", request.idempotencyKey());
            body.put("Description", "PALPEER withdrawal " + request.withdrawalTransactionId());
            response = post(properties.getSendEftPath(), body);
        } else {
            Map<String, Object> body = new HashMap<>();
            body.put("Amount", request.amount());
            body.put("CustomerEmail", destination.contains("@") ? destination : request.userEmail());
            if (!destination.contains("@") && notBlank(destination)) {
                body.put("CustomerPhone", destination);
            }
            body.put("MerchantReferenceNumber", request.idempotencyKey());
            body.put("Description", "PALPEER withdrawal " + request.withdrawalTransactionId());
            response = post(properties.getSendInteracEtransferPath(), body);
        }
        String reference = firstNonBlank(
                text(response, "TransactionNumber"),
                text(response, "ReferenceNumber"),
                request.withdrawalTransactionId().toString());
        return new WithdrawalInitiation(reference, true);
    }

    private JsonNode post(String path, Object body) {
        try {
            String raw = client().post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            if (raw == null || raw.isBlank()) {
                return objectMapper.createObjectNode();
            }
            return objectMapper.readTree(raw);
        } catch (RestClientResponseException ex) {
            log.error("Apaylo POST {} failed: {} {}", path, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new BusinessException(
                    "APAYLO_ERROR",
                    "Apaylo request failed: " + ex.getStatusCode().value(),
                    HttpStatus.BAD_GATEWAY);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException("APAYLO_ERROR", "Apaylo request failed", HttpStatus.BAD_GATEWAY);
        }
    }

    private RestClient client() {
        return restClientBuilder
                .baseUrl(trimSlash(properties.getBaseUrl()))
                .defaultHeader("Key", properties.getApiKey().trim())
                .defaultHeader("Password", properties.getSharedKey().trim())
                .build();
    }

    private void requireEnabled() {
        if (!isEnabled()) {
            throw new BusinessException(
                    "APAYLO_DISABLED",
                    "Apaylo is not configured (APAYLO_ENABLED + APAYLO_API_KEY + APAYLO_SHARED_KEY)",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private static boolean looksLikeEft(String destination) {
        return destination.matches("\\d{3}[:|;\\-]\\d{5}[:|;\\-]\\d+");
    }

    private static String joinName(String first, String last, String fallback) {
        String name = ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
        return name.isBlank() ? fallback : name;
    }

    private static String text(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode child = node.path(field);
        if (child.isMissingNode() || child.isNull()) {
            child = node.path("Data").path(field);
        }
        if (child.isMissingNode() || child.isNull()) {
            child = node.path("Result").path(field);
        }
        return child.isMissingNode() || child.isNull() ? null : child.asText();
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (notBlank(value)) {
                return value;
            }
        }
        return null;
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimSlash(String url) {
        if (url == null || url.isBlank()) {
            return "https://api.apaylo.com";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
