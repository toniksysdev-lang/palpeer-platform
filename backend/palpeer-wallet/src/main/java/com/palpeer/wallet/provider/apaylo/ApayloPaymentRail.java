package com.palpeer.wallet.provider.apaylo;

import com.fasterxml.jackson.databind.JsonNode;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.provider.PaymentRailProvider;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Apaylo CAD rails — Instant Interac deposit for funding; Interac send / EFT for withdrawals.
 *
 * <p>Funding uses {@code RequestInteracEtransferLink} (checkout Instant deposit — no request email
 * is sent). Returns {@code PENDING} with payee/amount/reference instructions; the CAD wallet is
 * credited only after webhook (or operator) settlement. Customers send Interac to the searchable
 * merchant account name ({@link ApayloProperties#getAccountId()}).
 * Docs: https://docs.apaylo.com/apaylo-api-reference/ref
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
        String customerEmail = firstNonBlank(request.interacEmail(), request.userEmail());
        if (!notBlank(customerEmail) || !customerEmail.contains("@")) {
            throw new BusinessException(
                    "APAYLO_INTERAC_EMAIL_REQUIRED",
                    "Interac email is required for Instant Interac deposit",
                    HttpStatus.BAD_REQUEST);
        }
        String name = customerName(
                firstNonBlank(request.interacFirstName(), request.customerFirstName()),
                firstNonBlank(request.interacLastName(), request.customerLastName()));

        Map<String, Object> body = new HashMap<>();
        body.put("CustomerName", name);
        body.put("CustomerEmail", customerEmail.trim());
        body.put("Amount", request.amount());
        body.put("Description", fundingDescription(request));
        // Link API idempotency; Email API used MerchantReferenceNumber historically.
        body.put("UniqueId", request.idempotencyKey());

        JsonNode response = apayloClient.post(properties.getCreateSearchableEtransferPath(), body);
        String reference = firstNonBlank(
                text(response, "ReferenceNumber"),
                text(response, "TransactionNumber"),
                text(response, "InteracReference"),
                request.fundingTransactionId().toString());
        // Real payment process: Instant Interac instructions + PENDING until webhook settles.
        // Sandbox auto-settle must not skip the customer send step (same as Kuda VA funding).
        String instructions = buildInstantDepositInstructions(request.amount(), reference, customerEmail);
        return new FundingInitiation(reference, instructions, true);
    }

    private String fundingDescription(FundingInitiationRequest request) {
        String apl = blankTo(properties.getAplReference(), "");
        String account = blankTo(properties.getAccountId(), "PALPEER");
        String raw = notBlank(apl)
                ? "PALPEER funding " + apl + " " + account
                : "PALPEER Instant Interac " + account;
        return sanitizeDescription(raw);
    }

    private String buildInstantDepositInstructions(
            java.math.BigDecimal amount, String reference, String customerEmail) {
        String accountName = blankTo(properties.getAccountId(), "Palpeer Global Holding Inc");
        String collectionEmail = blankTo(properties.getInteracCollectionEmail(), "ipay@apaylo.com");
        String apl = properties.getAplReference() == null ? "" : properties.getAplReference().trim();
        StringBuilder sb = new StringBuilder();
        sb.append("Instant deposit via Interac. Send CAD ")
                .append(amount)
                .append(" with Interac e-Transfer to \"")
                .append(accountName)
                .append("\" or ")
                .append(collectionEmail)
                .append(". Reference=")
                .append(reference)
                .append(". Open your banking app → Send → Interac → search for \"")
                .append(accountName)
                .append("\" or send to ")
                .append(collectionEmail)
                .append(" → enter the amount and reference. You initiate the transfer — we do not send an Interac request to your email.");
        if (notBlank(apl)) {
            sb.append(" Include ").append(apl).append(" in the memo if asked.");
        }
        sb.append(" Your Interac email: ").append(customerEmail.trim()).append('.');
        return sb.toString();
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
        // Real payout process: Interac/EFT submitted to Apaylo; wallet stays PENDING until webhook.
        log.info(
                "Apaylo CAD withdrawal submitted. ref={} destinationType={}",
                reference,
                looksLikeEft(destination) ? "EFT" : "INTERAC");
        return new WithdrawalInitiation(reference, true);
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
        // Live Apaylo expects SecurityQuestionAnswer (SecurityAnswer is ignored → "Please enter security answer").
        body.put(
                "SecurityQuestionAnswer",
                blankTo(properties.getInteracSecurityAnswer(), "PALPEER"));
        body.put("MerchantReferenceNumber", request.idempotencyKey());
        body.put("TransactionNumber", request.withdrawalTransactionId().toString().replace("-", ""));
        body.put("Description", sanitizeDescription("PALPEER withdrawal"));
        return apayloClient.post(properties.getSendInteracEtransferPath(), body);
    }

    /**
     * Poll Apaylo for Instant Interac / request funding completion (Apaylo has no webhooks).
     */
    public Optional<ConfirmedPayment> confirmFundingPayment(
            String providerReference, String idempotencyKey, BigDecimal expectedAmount) {
        if (!isEnabled()) {
            return Optional.empty();
        }
        LocalDate end = LocalDate.now(ZoneOffset.UTC);
        LocalDate start = end.minusDays(14);
        if (notBlank(providerReference)) {
            Optional<ConfirmedPayment> byRequest = findCompletedRequest(
                    providerReference.trim(), null, start, end, expectedAmount);
            if (byRequest.isPresent()) {
                return byRequest;
            }
            Optional<ConfirmedPayment> byIncoming = findCompletedIncoming(providerReference.trim(), expectedAmount, start, end);
            if (byIncoming.isPresent()) {
                return byIncoming;
            }
        }
        if (notBlank(idempotencyKey)) {
            return findCompletedRequest(null, idempotencyKey.trim(), start, end, expectedAmount);
        }
        return Optional.empty();
    }

    /**
     * Poll Apaylo for Interac send / EFT withdrawal completion.
     */
    public Optional<ConfirmedPayment> confirmWithdrawalPayment(String providerReference) {
        if (!isEnabled() || !notBlank(providerReference)) {
            return Optional.empty();
        }
        String ref = providerReference.trim();
        LocalDate end = LocalDate.now(ZoneOffset.UTC);
        LocalDate start = end.minusDays(14);
        Optional<ConfirmedPayment> send = findCompletedSend(ref, start, end);
        if (send.isPresent()) {
            return send;
        }
        return findCompletedEft(ref, start, end);
    }

    public record ConfirmedPayment(String providerReference) {}

    private Optional<ConfirmedPayment> findCompletedRequest(
            String interacOrTxnRef,
            String uniqueId,
            LocalDate start,
            LocalDate end,
            BigDecimal expectedAmount) {
        Map<String, Object> body = dateRange(start, end);
        if (notBlank(interacOrTxnRef)) {
            body.put("InteracReferenceNumber", interacOrTxnRef);
        }
        JsonNode response = apayloClient.postAllowEmpty(properties.getSearchRequestInteracPath(), body);
        for (JsonNode row : resultRows(response)) {
            if (!isCompletedStatus(firstText(row, "TransactionStatus", "Status", "transferStatus"))) {
                continue;
            }
            if (expectedAmount != null && !amountMatches(row, expectedAmount)) {
                continue;
            }
            if (notBlank(uniqueId)) {
                String uid = firstText(row, "UniqueId", "uniqueId");
                if (notBlank(uid) && !uniqueId.equalsIgnoreCase(uid.trim())) {
                    continue;
                }
            }
            if (notBlank(interacOrTxnRef) && !rowMatchesRef(row, interacOrTxnRef)) {
                continue;
            }
            return Optional.of(new ConfirmedPayment(firstNonBlank(
                    firstText(row, "InteracReferenceNumber", "ReferenceNumber", "TransactionNumber"),
                    interacOrTxnRef,
                    uniqueId)));
        }
        return Optional.empty();
    }

    private Optional<ConfirmedPayment> findCompletedIncoming(
            String providerReference, BigDecimal expectedAmount, LocalDate start, LocalDate end) {
        JsonNode response =
                apayloClient.postAllowEmpty(properties.getSearchIncomingInteracPath(), dateRange(start, end));
        for (JsonNode row : resultRows(response)) {
            if (!rowMatchesRef(row, providerReference)) {
                continue;
            }
            if (expectedAmount != null && !amountMatches(row, expectedAmount)) {
                continue;
            }
            return Optional.of(new ConfirmedPayment(firstNonBlank(
                    firstText(row, "ReferenceNumber", "TransactionReferenceNumber", "InteracReferenceNumber"),
                    providerReference)));
        }
        return Optional.empty();
    }

    private Optional<ConfirmedPayment> findCompletedSend(String providerReference, LocalDate start, LocalDate end) {
        Map<String, Object> byInterac = dateRange(start, end);
        byInterac.put("InteracReferenceNumber", providerReference);
        Optional<ConfirmedPayment> hit = matchSendRows(
                apayloClient.postAllowEmpty(properties.getSearchSendInteracPath(), byInterac), providerReference);
        if (hit.isPresent()) {
            return hit;
        }
        Map<String, Object> byTxn = dateRange(start, end);
        byTxn.put("TransactionNumber", providerReference.replace("-", ""));
        return matchSendRows(
                apayloClient.postAllowEmpty(properties.getSearchSendInteracPath(), byTxn), providerReference);
    }

    private Optional<ConfirmedPayment> matchSendRows(JsonNode response, String providerReference) {
        for (JsonNode row : resultRows(response)) {
            if (!isCompletedStatus(firstText(row, "TransactionStatus", "Status"))) {
                continue;
            }
            if (!rowMatchesRef(row, providerReference)) {
                continue;
            }
            return Optional.of(new ConfirmedPayment(firstNonBlank(
                    firstText(row, "InteracReferenceNumber", "TransactionNumber"), providerReference)));
        }
        return Optional.empty();
    }

    private Optional<ConfirmedPayment> findCompletedEft(String providerReference, LocalDate start, LocalDate end) {
        Map<String, Object> body = new HashMap<>();
        body.put("TransactionNumber", providerReference.replace("-", ""));
        body.put("MinTransactionDate", start.toString());
        body.put("MaxTransactionDate", end.toString());
        JsonNode response = apayloClient.postAllowEmpty(properties.getSearchEftPath(), body);
        for (JsonNode row : resultRows(response)) {
            if (!isCompletedStatus(firstText(row, "TransactionStatus", "Status"))) {
                continue;
            }
            if (!rowMatchesRef(row, providerReference)) {
                continue;
            }
            return Optional.of(new ConfirmedPayment(firstNonBlank(
                    firstText(row, "TransactionNumber", "TransactionId"), providerReference)));
        }
        return Optional.empty();
    }

    private static Map<String, Object> dateRange(LocalDate start, LocalDate end) {
        Map<String, Object> body = new HashMap<>();
        body.put("StartDate", start.toString());
        body.put("EndDate", end.toString());
        return body;
    }

    private static List<JsonNode> resultRows(JsonNode response) {
        List<JsonNode> rows = new ArrayList<>();
        if (response == null) {
            return rows;
        }
        JsonNode result = response.path("Result");
        if (result.isArray()) {
            result.forEach(rows::add);
            return rows;
        }
        if (result.isObject() && !result.has("Message")) {
            rows.add(result);
            return rows;
        }
        if (response.isArray()) {
            response.forEach(rows::add);
        }
        return rows;
    }

    private static boolean rowMatchesRef(JsonNode row, String ref) {
        if (!notBlank(ref)) {
            return true;
        }
        String needle = ref.trim();
        String compact = needle.replace("-", "");
        for (String field : new String[] {
            "InteracReferenceNumber",
            "ReferenceNumber",
            "TransactionReferenceNumber",
            "TransactionNumber",
            "TransactionId",
            "UniqueId",
            "transferReferenceNumber"
        }) {
            String value = firstText(row, field);
            if (!notBlank(value)) {
                continue;
            }
            String trimmed = value.trim();
            if (trimmed.equalsIgnoreCase(needle) || trimmed.replace("-", "").equalsIgnoreCase(compact)) {
                return true;
            }
        }
        return false;
    }

    private static boolean amountMatches(JsonNode row, BigDecimal expected) {
        String raw = firstText(row, "Amount", "amount");
        if (!notBlank(raw)) {
            return true;
        }
        try {
            return new BigDecimal(raw.trim().replace(",", "")).compareTo(expected) == 0;
        } catch (NumberFormatException ex) {
            return true;
        }
    }

    static boolean isCompletedStatus(String status) {
        if (!notBlank(status)) {
            // SearchInteracEtransfers only returns completed incoming transfers.
            return true;
        }
        String normalized = status.trim().toLowerCase(Locale.ROOT);
        return normalized.equals("completed")
                || normalized.equals("complete")
                || normalized.equals("settled")
                || normalized.equals("success")
                || normalized.equals("successful")
                || normalized.equals("paid")
                || normalized.equals("deposited")
                || normalized.equals("accepted");
    }

    private static String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (notBlank(value)) {
                return value;
            }
        }
        return null;
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
