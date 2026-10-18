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
import com.palpeer.wallet.provider.kuda.KudaPaymentRail;
import com.palpeer.wallet.provider.kuda.KudaProperties;
import com.palpeer.wallet.withdrawal.WithdrawalService;
import jakarta.servlet.http.HttpServletRequest;
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
 * Every request must carry a valid HMAC-SHA256 signature of the raw body; unsigned or
 * mis-signed requests are rejected before any state change.
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
        return handleRail(ApayloPaymentRail.NAME, rawBody, request,
                apayloProperties.getWebhookSecret(), apayloProperties.getWebhookSignatureHeader());
    }

    @PostMapping("/korapay")
    public ResponseEntity<ApiResponse<Void>> korapay(
            @RequestBody(required = false) String rawBody, HttpServletRequest request) {
        return handleRail(KorapayPaymentRail.NAME, rawBody, request,
                korapayProperties.getWebhookSecret(), korapayProperties.getWebhookSignatureHeader());
    }

    @PostMapping("/kuda")
    public ResponseEntity<ApiResponse<Void>> kuda(
            @RequestBody(required = false) String rawBody, HttpServletRequest request) {
        return handleRail(KudaPaymentRail.NAME, rawBody, request,
                kudaProperties.getWebhookSecret(), kudaProperties.getWebhookSignatureHeader());
    }

    private ResponseEntity<ApiResponse<Void>> handleRail(
            String providerName, String rawBody, HttpServletRequest request, String secret, String signatureHeader) {
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
            String reference = firstText(root,
                    "providerReference", "TransactionNumber", "ReferenceNumber",
                    "transactionReference", "MerchantReferenceNumber", "trackingReference", "reference");
            String fundingId = firstText(root, "fundingId", "FundingId");
            String withdrawalId = firstText(root, "withdrawalId", "WithdrawalId");

            if (fundingId != null) {
                fundingService.completeById(UUID.fromString(fundingId), success, reason);
            } else if (withdrawalId != null) {
                if (reference != null) {
                    withdrawalService.completeFromProvider(providerName, reference, success, success ? null : reason);
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
        if (s.contains("fail") || s.contains("declin") || s.contains("reject")
                || s.contains("cancel") || s.contains("expire")) {
            return Boolean.FALSE;
        }
        if (s.contains("unpaid") || s.contains("pending") || s.contains("processing")) {
            return null;
        }
        // Korapay events: charge.success / charge.failed / transfer.success / transfer.failed
        if (s.contains("success") || s.contains("complete") || s.contains("paid") || s.contains("credit")) {
            return Boolean.TRUE;
        }
        return null;
    }

    private static String firstText(JsonNode node, String... fields) {
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
}
