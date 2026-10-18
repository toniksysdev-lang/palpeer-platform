package com.palpeer.kyc.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.webhook.WebhookSignatures;
import com.palpeer.kyc.config.ComplyCubeProperties;
import com.palpeer.kyc.service.KycService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * ComplyCube webhook receiver.
 * Docs: https://docs.complycube.com/documentation/integration-resources/webhooks.md
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/webhooks/complycube")
@RequiredArgsConstructor
public class ComplyCubeWebhookController {

    private final KycService kycService;
    private final ComplyCubeProperties properties;
    private final ObjectMapper objectMapper;

    @PostMapping
    public ResponseEntity<ApiResponse<Void>> handle(
            @RequestBody String rawBody,
            @RequestHeader(value = "ComplyCube-Signature", required = false) String signature) {
        if (!WebhookSignatures.hmacSha256Matches(properties.getWebhookSecret(), rawBody, signature)) {
            log.warn("ComplyCube webhook rejected — missing secret or invalid signature");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.fail("Invalid signature", null));
        }
        try {
            JsonNode event = objectMapper.readTree(rawBody);
            String type = text(event, "type");
            JsonNode payload = event.path("payload");
            if (payload.isMissingNode()) {
                payload = event.path("data");
            }
            String checkId = firstText(payload, "id", "checkId");
            String result = extractOutcome(payload);
            String status = firstText(payload, "status");
            if (checkId != null && type != null && type.toLowerCase().contains("check")) {
                kycService.applyProviderCheckResult(checkId, result, status);
            } else if (checkId != null) {
                kycService.applyProviderCheckResult(checkId, result, status);
            } else {
                log.warn("ComplyCube webhook ignored — no check id. type={}", type);
            }
            return ResponseEntity.ok(ApiResponse.ok("accepted", null));
        } catch (Exception ex) {
            log.error("ComplyCube webhook processing failed", ex);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.fail("Webhook processing failed", null));
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode child = node.path(field);
        if (child.isMissingNode() || child.isNull() || !child.isValueNode()) {
            return null;
        }
        String value = child.asText();
        return value == null || value.isBlank() ? null : value;
    }

    private static String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    /**
     * Prefer {@code result.outcome} (ComplyCube object shape); fall back to string {@code result}/{@code outcome}.
     */
    private static String extractOutcome(JsonNode payload) {
        JsonNode result = payload.path("result");
        if (result.isObject()) {
            String outcome = text(result, "outcome");
            if (outcome != null) {
                return outcome;
            }
        }
        if (result.isTextual()) {
            String value = result.asText();
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return firstText(payload, "outcome");
    }
}
