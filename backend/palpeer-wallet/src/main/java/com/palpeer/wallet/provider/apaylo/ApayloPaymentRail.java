package com.palpeer.wallet.provider.apaylo;

import com.fasterxml.jackson.databind.JsonNode;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.provider.PaymentRailProvider;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Apaylo CAD rails — Instant Interac deposit for funding; Interac send / EFT for withdrawals.
 * Funding uses Request Money ({@code RequestInteracEtransferEmail}) only — no other CAD fund methods.
 * Docs: https://docs.apaylo.com/
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ApayloPaymentRail implements PaymentRailProvider {

    public static final String NAME = "APAYLO";

    private final ApayloProperties properties;
    private final ApayloClient apayloClient;

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
        return apayloClient.isConfigured();
    }

    @Override
    public FundingInitiation initiateFunding(FundingInitiationRequest request) {
        requireEnabled();
        Map<String, Object> body = new HashMap<>();
        body.put(
                "CustomerName",
                customerName(request.customerFirstName(), request.customerLastName()));
        body.put("CustomerEmail", request.userEmail());
        body.put("Amount", request.amount());
        // Description: 5–200 chars; only space and symbols .#,$@' (no UUID hyphens).
        body.put("Description", sanitizeDescription("PALPEER wallet funding"));
        body.put("MerchantReferenceNumber", request.idempotencyKey());
        body.put("TransactionNumber", request.fundingTransactionId().toString());

        JsonNode response = apayloClient.post(properties.getCreateSearchableEtransferPath(), body);
        String reference = firstNonBlank(
                text(response, "TransactionNumber"),
                text(response, "ReferenceNumber"),
                text(response, "InteracReference"),
                request.fundingTransactionId().toString());
        boolean settleNow = properties.isSandbox() && properties.isAutoSandboxSettle();
        String instructions;
        if (settleNow) {
            instructions = "Sandbox funding completed. CAD "
                    + request.amount()
                    + " will be credited to your wallet. Reference="
                    + reference;
        } else {
            instructions = "Interac, Instant deposit via Interac. Reference="
                    + reference
                    + "; amount=CAD "
                    + request.amount()
                    + "; accept the Interac request in your email or banking app to complete the deposit.";
        }
        // false → FundingService CREDITS the CAD wallet immediately (sandbox demo settle).
        return new FundingInitiation(reference, instructions, !settleNow);
    }

    @Override
    public WithdrawalInitiation initiateWithdrawal(WithdrawalInitiationRequest request) {
        requireEnabled();
        if (!"CAD".equalsIgnoreCase(request.currencyCode())) {
            throw new BusinessException(
                    "APAYLO_CURRENCY_UNSUPPORTED",
                    "Apaylo withdrawals support CAD only",
                    HttpStatus.BAD_REQUEST);
        }
        if (request.amount() == null || request.amount().signum() <= 0) {
            throw new BusinessException(
                    "APAYLO_AMOUNT_INVALID",
                    "Withdrawal amount must be greater than zero",
                    HttpStatus.BAD_REQUEST);
        }

        String destination = request.destinationReference() == null ? "" : request.destinationReference().trim();
        if (destination.isBlank()) {
            throw new BusinessException(
                    "APAYLO_DESTINATION_REQUIRED",
                    "CAD withdrawal requires an Interac email/phone or EFT institution:transit:account",
                    HttpStatus.BAD_REQUEST);
        }

        String customerName = sanitizeCustomerName(
                notBlank(request.customerName()) ? request.customerName() : "PALPEER Customer");

        try {
            JsonNode response;
            if (looksLikeEft(destination)) {
                response = sendEft(request, destination, customerName);
            } else {
                response = sendInterac(request, destination, customerName);
            }
            String reference = firstNonBlank(
                    text(response, "TransactionNumber"),
                    text(response, "ReferenceNumber"),
                    request.withdrawalTransactionId().toString());
            boolean settleNow = properties.isSandbox() && properties.isAutoSandboxSettle();
            if (settleNow) {
                log.info("Apaylo CAD withdrawal settled in sandbox. ref={}", reference);
            }
            return new WithdrawalInitiation(reference, !settleNow);
        } catch (BusinessException ex) {
            if (properties.isSandbox() && properties.isOfflineSandboxSettle()) {
                log.warn(
                        "Apaylo unreachable in sandbox — settling CAD withdrawal locally. cause={}",
                        ex.getMessage());
                String offlineRef = "offline-"
                        + request.withdrawalTransactionId().toString().replace("-", "");
                return new WithdrawalInitiation(offlineRef, false);
            }
            throw ex;
        }
    }

    private JsonNode sendEft(
            WithdrawalInitiationRequest request, String destination, String customerName) {
        String[] parts = destination.split("[:|;\\-]");
        if (parts.length < 3) {
            throw new BusinessException(
                    "APAYLO_DESTINATION_INVALID",
                    "CAD EFT destination must be institution:transit:account",
                    HttpStatus.BAD_REQUEST);
        }
        Map<String, Object> body = new HashMap<>();
        body.put("Amount", request.amount());
        body.put("CustomerName", customerName);
        body.put("InstitutionNumber", parts[0].trim());
        body.put("TransitNumber", parts[1].trim());
        body.put("AccountNumber", parts[2].trim());
        body.put("MerchantReferenceNumber", request.idempotencyKey());
        body.put("TransactionNumber", request.withdrawalTransactionId().toString().replace("-", ""));
        body.put("Description", sanitizeDescription("PALPEER withdrawal"));
        return apayloClient.post(properties.getSendEftPath(), body);
    }

    private JsonNode sendInterac(
            WithdrawalInitiationRequest request, String destination, String customerName) {
        Map<String, Object> body = new HashMap<>();
        body.put("Amount", request.amount());
        body.put("CustomerName", customerName);
        body.put("CustomerEmail", destination.contains("@") ? destination : request.userEmail());
        if (!destination.contains("@") && notBlank(destination)) {
            body.put("CustomerPhone", destination);
        }
        body.put("SecurityQuestion", blankTo(properties.getInteracSecurityQuestion(), "What is the name of this transfer?"));
        body.put("SecurityAnswer", blankTo(properties.getInteracSecurityAnswer(), "PALPEER"));
        body.put("MerchantReferenceNumber", request.idempotencyKey());
        body.put("TransactionNumber", request.withdrawalTransactionId().toString().replace("-", ""));
        body.put("Description", sanitizeDescription("PALPEER withdrawal"));
        return apayloClient.post(properties.getSendInteracEtransferPath(), body);
    }

    private static String blankTo(String value, String fallback) {
        return notBlank(value) ? value.trim() : fallback;
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

    /**
     * Apaylo CustomerName allows only letters, digits, space, and {@code -.'’}.
     * Never fall back to an email — {@code @} is rejected with HTTP 400.
     */
    static String customerName(String first, String last) {
        String name = ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
        return sanitizeCustomerName(name.isBlank() ? "PALPEER Customer" : name);
    }

    static String sanitizeCustomerName(String raw) {
        if (raw == null || raw.isBlank()) {
            return "PALPEER Customer";
        }
        String cleaned = raw
                .replaceAll("[^A-Za-z0-9\\-.'’\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (cleaned.isBlank()) {
            return "PALPEER Customer";
        }
        return cleaned.length() > 80 ? cleaned.substring(0, 80).trim() : cleaned;
    }

    /**
     * Apaylo Description: 5–200 characters; letters/digits/space and {@code .#,$@'} only.
     * UUIDs with hyphens are rejected.
     */
    static String sanitizeDescription(String raw) {
        String cleaned = raw == null
                ? ""
                : raw.replaceAll("[^A-Za-z0-9 .#,$@']", " ").replaceAll("\\s+", " ").trim();
        if (cleaned.length() < 5) {
            cleaned = "PALPEER payment";
        }
        return cleaned.length() > 200 ? cleaned.substring(0, 200).trim() : cleaned;
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
}
