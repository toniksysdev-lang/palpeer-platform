package com.palpeer.wallet.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.webhook.WebhookSignatures;
import com.palpeer.wallet.funding.FundingService;
import com.palpeer.wallet.provider.apaylo.ApayloPaymentRail;
import com.palpeer.wallet.provider.apaylo.ApayloProperties;
import com.palpeer.wallet.provider.korapay.KorapayPaymentRail;
import com.palpeer.wallet.provider.korapay.KorapayProperties;
import com.palpeer.wallet.provider.kuda.KudaClient;
import com.palpeer.wallet.provider.kuda.KudaPaymentRail;
import com.palpeer.wallet.provider.kuda.KudaProperties;
import com.palpeer.wallet.withdrawal.WithdrawalService;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Payment provider webhooks for Apaylo (CAD), Korapay (NGN), and Kuda (NGN).
 * Apaylo/Korapay require HMAC-SHA256 of the raw body. Kuda uses dashboard username/password
 * headers ({@code username} + Base64 {@code password}); HMAC remains a test fallback.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/webhooks")
@RequiredArgsConstructor
public class PaymentWebhookController {

    private final FundingService fundingService;
    private final WithdrawalService withdrawalService;
    private final ObjectMapper objectMapper;
    private final ApayloProperties apayloProperties;
    private final KorapayProperties korapayProperties;
    private final KudaProperties kudaProperties;

    @PostMapping("/apaylo")
    public ResponseEntity<ApiResponse<Void>> apaylo(
            @RequestBody(required = false) String rawBody, HttpServletRequest request) {
        return handleHmacRail(
                ApayloPaymentRail.NAME,
                rawBody,
                request,
                apayloProperties.getWebhookSecret(),
                apayloProperties.getWebhookSignatureHeader());
    }

    @PostMapping("/korapay")
    public ResponseEntity<ApiResponse<Void>> korapay(
            @RequestBody(required = false) String rawBody, HttpServletRequest request) {
        return handleHmacRail(
                KorapayPaymentRail.NAME,
                rawBody,
                request,
                korapayProperties.getWebhookSecret(),
                korapayProperties.getWebhookSignatureHeader());
    }

    @PostMapping("/kuda")
    public ResponseEntity<ApiResponse<Void>> kuda(
            @RequestBody(required = false) String rawBody, HttpServletRequest request) {
        String body = rawBody == null ? "" : rawBody;
        if (!authenticateKuda(request, body)) {
            return unauthorized();
        }

        try {
            JsonNode root = objectMapper.readTree(body.isBlank() ? "{}" : body);
            String eventType = firstText(root, "eventType", "EventType");
            String transactionType = firstText(root, "transactionType", "TransactionType");

            // Live Kuda Transaction.Notification payload
            if ((eventType != null && eventType.equalsIgnoreCase("Transaction.Notification"))
                    || (transactionType != null
                            && notBlank(firstText(root, "accountNumber", "AccountNumber")))) {
                return handleKudaTransactionNotification(root);
            }

            // Test / operator-style payloads (fundingId + status)
            Boolean success = resolveOutcome(root);
            if (success == null) {
                log.warn("KUDA webhook ignored — status missing or not terminal");
                return ResponseEntity.ok(ApiResponse.ok("ignored", null));
            }
            String reason = firstText(root, "reason", "message", "narrations");
            String reference = firstText(
                    root,
                    "providerReference",
                    "transactionReference",
                    "TransactionReference",
                    "clientRequestRef",
                    "trackingReference",
                    "reference");
            String fundingId = firstText(root, "fundingId", "FundingId");
            String withdrawalId = firstText(root, "withdrawalId", "WithdrawalId");

            if (fundingId != null) {
                fundingService.completeById(UUID.fromString(fundingId), success, reason);
            } else if (withdrawalId != null && reference != null) {
                withdrawalService.completeFromProvider(
                        KudaPaymentRail.NAME, reference, success, success ? null : reason);
            } else if (reference != null) {
                try {
                    fundingService.completeFromProvider(KudaPaymentRail.NAME, reference, success, reason);
                } catch (Exception fundingMiss) {
                    withdrawalService.completeFromProvider(KudaPaymentRail.NAME, reference, success, reason);
                }
            } else {
                log.warn("KUDA webhook ignored — no funding/withdrawal reference");
            }
            return ResponseEntity.ok(ApiResponse.ok("accepted", null));
        } catch (Exception ex) {
            log.error("KUDA webhook failed", ex);
            return ResponseEntity.badRequest().body(ApiResponse.fail("Webhook processing failed", null));
        }
    }

    private ResponseEntity<ApiResponse<Void>> handleKudaTransactionNotification(JsonNode root) {
        String transactionType = firstText(root, "transactionType", "TransactionType");
        String accountNumber = firstText(root, "accountNumber", "AccountNumber");
        String txnRef = firstText(
                root, "transactionReference", "TransactionReference", "instrumentNumber", "InstrumentNumber");
        String clientRef = firstText(root, "clientRequestRef", "ClientRequestRef", "trackingReference");
        String amountRaw = firstText(root, "amount", "Amount", "originalAmount");

        if (transactionType == null) {
            log.warn("KUDA Transaction.Notification ignored — missing transactionType");
            return ResponseEntity.ok(ApiResponse.ok("ignored", null));
        }

        String type = transactionType.toLowerCase(Locale.ROOT);
        if (type.contains("credit")) {
            if (accountNumber == null || amountRaw == null) {
                log.warn("KUDA credit notification missing accountNumber/amount");
                return ResponseEntity.ok(ApiResponse.ok("ignored", null));
            }
            BigDecimal amountNaira = parseKudaAmountNaira(amountRaw);
            fundingService.completePendingVirtualAccountCredit(
                    KudaPaymentRail.NAME, accountNumber, amountNaira, txnRef, true, null);
            return ResponseEntity.ok(ApiResponse.ok("accepted", null));
        }

        if (type.contains("debit") || type.contains("reversal")) {
            boolean success = !type.contains("reversal") && !type.contains("fail");
            String reference = clientRef != null ? clientRef : txnRef;
            if (reference == null) {
                log.warn("KUDA debit notification missing clientRequestRef/transactionReference");
                return ResponseEntity.ok(ApiResponse.ok("ignored", null));
            }
            String reason = firstText(root, "narrations", "message", "reason");
            try {
                withdrawalService.completeFromProvider(
                        KudaPaymentRail.NAME, reference, success, success ? null : reason);
            } catch (Exception ex) {
                // Idempotency key is often the withdrawal trackingReference; also try txnRef.
                if (clientRef != null && txnRef != null && !clientRef.equals(txnRef)) {
                    withdrawalService.completeFromProvider(
                            KudaPaymentRail.NAME, txnRef, success, success ? null : reason);
                } else {
                    throw ex;
                }
            }
            return ResponseEntity.ok(ApiResponse.ok("accepted", null));
        }

        log.warn("KUDA Transaction.Notification ignored — transactionType={}", transactionType);
        return ResponseEntity.ok(ApiResponse.ok("ignored", null));
    }

    private static BigDecimal parseKudaAmountNaira(String amountRaw) {
        BigDecimal raw = new BigDecimal(amountRaw.trim());
        // Kuda documents webhook amounts in kobo (integer). Whole numbers ≥ 100 treated as kobo.
        if (raw.scale() <= 0 && raw.abs().compareTo(BigDecimal.valueOf(100)) >= 0) {
            return KudaClient.fromKobo(raw.longValueExact());
        }
        return raw;
    }

    private boolean authenticateKuda(HttpServletRequest request, String body) {
        String username = kudaProperties.getWebhookUsername();
        String password = kudaProperties.getWebhookPassword();
        if (notBlank(username) && notBlank(password)) {
            String headerUser = request.getHeader("username");
            String encodedPassword = request.getHeader("password");
            if (encodedPassword == null) {
                encodedPassword = "";
            }
            String decoded;
            try {
                decoded = new String(Base64.getDecoder().decode(encodedPassword), StandardCharsets.UTF_8);
            } catch (IllegalArgumentException ex) {
                log.warn("KUDA webhook rejected — password header is not valid Base64");
                return false;
            }
            boolean ok = username.equals(headerUser) && password.equals(decoded);
            if (!ok) {
                log.warn("KUDA webhook rejected — invalid username/password headers");
            }
            return ok;
        }

        String secret = kudaProperties.getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            log.warn("KUDA webhook rejected — configure KUDA_WEBHOOK_USERNAME/PASSWORD or KUDA_WEBHOOK_SECRET");
            return false;
        }
        String header = kudaProperties.getWebhookSignatureHeader();
        if (!WebhookSignatures.hmacSha256Matches(secret, body, request.getHeader(header))) {
            log.warn("KUDA webhook rejected — invalid signature");
            return false;
        }
        return true;
    }

    private ResponseEntity<ApiResponse<Void>> handleHmacRail(
            String providerName,
            String rawBody,
            HttpServletRequest request,
            String secret,
            String signatureHeader) {
        String body = rawBody == null ? "" : rawBody;
        if (secret == null || secret.isBlank()) {
            log.warn("{} webhook rejected — no webhook secret configured", providerName);
            return unauthorized();
        }
        if (!WebhookSignatures.hmacSha256Matches(secret, body, request.getHeader(signatureHeader))) {
            log.warn("{} webhook rejected — invalid signature", providerName);
            return unauthorized();
        }

        try {
            JsonNode root = objectMapper.readTree(body.isBlank() ? "{}" : body);
            Boolean success = resolveOutcome(root);
            if (success == null) {
                log.warn("{} webhook ignored — status missing or not terminal", providerName);
                return ResponseEntity.ok(ApiResponse.ok("ignored", null));
            }
            String reason = firstText(root, "reason", "message");
            String reference = firstText(
                    root,
                    "providerReference",
                    "TransactionNumber",
                    "ReferenceNumber",
                    "transactionReference",
                    "MerchantReferenceNumber",
                    "trackingReference",
                    "reference");
            String fundingId = firstText(root, "fundingId", "FundingId");
            String withdrawalId = firstText(root, "withdrawalId", "WithdrawalId");

            if (fundingId != null) {
                fundingService.completeById(UUID.fromString(fundingId), success, reason);
            } else if (withdrawalId != null) {
                if (reference != null) {
                    withdrawalService.completeFromProvider(
                            providerName, reference, success, success ? null : reason);
                }
            } else if (reference != null) {
                try {
                    fundingService.completeFromProvider(providerName, reference, success, reason);
                } catch (Exception fundingMiss) {
                    withdrawalService.completeFromProvider(providerName, reference, success, reason);
                }
            } else {
                log.warn("{} webhook ignored — no funding/withdrawal reference", providerName);
            }
            return ResponseEntity.ok(ApiResponse.ok("accepted", null));
        } catch (Exception ex) {
            log.error("{} webhook failed", providerName, ex);
            return ResponseEntity.badRequest().body(ApiResponse.fail("Webhook processing failed", null));
        }
    }

    private static ResponseEntity<ApiResponse<Void>> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.fail("Invalid signature", null));
    }

    /** TRUE = settled, FALSE = failed, null = unknown / non-terminal (no state change). */
    static Boolean resolveOutcome(JsonNode root) {
        String status = firstText(root, "status", "Status", "transactionStatus", "event");
        if (status == null) {
            status = firstText(root.path("data"), "status");
        }
        if (status == null) {
            return null;
        }
        String s = status.toLowerCase(Locale.ROOT);
        if (s.contains("fail")
                || s.contains("declin")
                || s.contains("reject")
                || s.contains("cancel")
                || s.contains("expire")) {
            return Boolean.FALSE;
        }
        if (s.contains("unpaid") || s.contains("pending") || s.contains("processing")) {
            return null;
        }
        if (s.contains("success") || s.contains("complete") || s.contains("paid") || s.contains("credit")) {
            return Boolean.TRUE;
        }
        return null;
    }

    private static String firstText(JsonNode node, String... fields) {
        if (node == null) {
            return null;
        }
        for (String field : fields) {
            JsonNode child = node.path(field);
            if (!child.isMissingNode() && !child.isNull() && !child.asText().isBlank()) {
                return child.asText();
            }
            JsonNode nested = node.path("data").path(field);
            if (!nested.isMissingNode() && !nested.isNull() && !nested.asText().isBlank()) {
                return nested.asText();
            }
            JsonNode dataCaps = node.path("Data").path(field);
            if (!dataCaps.isMissingNode() && !dataCaps.isNull() && !dataCaps.asText().isBlank()) {
                return dataCaps.asText();
            }
        }
        return null;
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
