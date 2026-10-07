package com.palpeer.kyc.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.kyc.config.ComplyCubeProperties;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * ComplyCube Pure API adapter.
 * Docs: https://docs.complycube.com/documentation/quick-guides/api-quick-guide.md
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "palpeer.complycube", name = "enabled", havingValue = "true")
public class ComplyCubeKycProvider implements KycVerificationProvider {

    public static final String NAME = "COMPLYCUBE";

    private final ComplyCubeProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient.Builder restClientBuilder;

    @Override
    public String providerName() {
        return NAME;
    }

    @Override
    public boolean isEnabled() {
        return properties.isEnabled()
                && properties.getApiKey() != null
                && !properties.getApiKey().isBlank();
    }

    @Override
    public String ensureClient(EnsureClientRequest request) {
        Map<String, Object> personDetails = new HashMap<>();
        personDetails.put("firstName", request.firstName());
        personDetails.put("lastName", request.lastName());
        if (request.dateOfBirth() != null && !request.dateOfBirth().isBlank()) {
            personDetails.put("dob", request.dateOfBirth());
        }
        Map<String, Object> body = new HashMap<>();
        body.put("type", "person");
        body.put("email", request.email());
        body.put("externalId", request.externalUserId());
        if (request.phone() != null && !request.phone().isBlank()) {
            body.put("mobile", request.phone());
        }
        body.put("personDetails", personDetails);
        JsonNode response = post("/clients", body);
        return requiredText(response, "id");
    }

    @Override
    public String createDocument(String providerClientId, String documentType, String issuingCountry) {
        Map<String, Object> body = new HashMap<>();
        body.put("clientId", providerClientId);
        body.put("type", mapDocumentType(documentType));
        body.put("classification", "proof_of_identity");
        if (issuingCountry != null && !issuingCountry.isBlank()) {
            body.put("issuingCountry", issuingCountry.trim().toUpperCase());
        }
        JsonNode response = post("/documents", body);
        return requiredText(response, "id");
    }

    @Override
    public void uploadDocumentImage(String providerDocumentId, String side, String fileName, byte[] bytes) {
        Map<String, Object> body = Map.of(
                "fileName", sanitizeFileName(fileName),
                "data", Base64.getEncoder().encodeToString(bytes)
        );
        post("/documents/" + providerDocumentId + "/upload/" + side, body);
    }

    @Override
    public String uploadLivePhoto(String providerClientId, String fileName, byte[] bytes) {
        Map<String, Object> body = Map.of(
                "clientId", providerClientId,
                "fileName", sanitizeFileName(fileName),
                "data", Base64.getEncoder().encodeToString(bytes)
        );
        JsonNode response = post("/livePhotos", body);
        return requiredText(response, "id");
    }

    @Override
    public String createIdentityCheck(String providerClientId, String providerDocumentId, String livePhotoId) {
        Map<String, Object> body = new HashMap<>();
        body.put("clientId", providerClientId);
        body.put("documentId", providerDocumentId);
        body.put("livePhotoId", livePhotoId);
        body.put("type", "identity_check");
        JsonNode response = post("/checks", body);
        return requiredText(response, "id");
    }

    @Override
    public String createDocumentCheck(String providerClientId, String providerDocumentId) {
        Map<String, Object> body = Map.of(
                "clientId", providerClientId,
                "documentId", providerDocumentId,
                "type", "document_check"
        );
        JsonNode response = post("/checks", body);
        return requiredText(response, "id");
    }

    @Override
    public Optional<ProviderCheckResult> getCheck(String providerCheckId) {
        try {
            JsonNode response = get("/checks/" + providerCheckId);
            return Optional.of(new ProviderCheckResult(
                    requiredText(response, "id"),
                    textOrNull(response, "type"),
                    textOrNull(response, "status"),
                    textOrNull(response, "result"),
                    response.path("resultBreakdown").isMissingNode()
                            ? null
                            : response.path("resultBreakdown").toString()
            ));
        } catch (BusinessException ex) {
            return Optional.empty();
        }
    }

    private JsonNode post(String path, Object body) {
        try {
            String raw = client().post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            return objectMapper.readTree(raw == null ? "{}" : raw);
        } catch (RestClientResponseException ex) {
            log.error("ComplyCube POST {} failed: status={} body={}", path, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new BusinessException(
                    "COMPLYCUBE_ERROR",
                    "ComplyCube request failed: " + ex.getStatusCode().value(),
                    HttpStatus.BAD_GATEWAY);
        } catch (Exception ex) {
            throw new BusinessException("COMPLYCUBE_ERROR", "ComplyCube request failed", HttpStatus.BAD_GATEWAY);
        }
    }

    private JsonNode get(String path) {
        try {
            String raw = client().get().uri(path).retrieve().body(String.class);
            return objectMapper.readTree(raw == null ? "{}" : raw);
        } catch (RestClientResponseException ex) {
            throw new BusinessException(
                    "COMPLYCUBE_ERROR",
                    "ComplyCube request failed: " + ex.getStatusCode().value(),
                    HttpStatus.BAD_GATEWAY);
        } catch (Exception ex) {
            throw new BusinessException("COMPLYCUBE_ERROR", "ComplyCube request failed", HttpStatus.BAD_GATEWAY);
        }
    }

    private RestClient client() {
        if (!isEnabled()) {
            throw new BusinessException(
                    "COMPLYCUBE_DISABLED",
                    "ComplyCube is not configured (set COMPLYCUBE_ENABLED=true and COMPLYCUBE_API_KEY)",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        return restClientBuilder
                .baseUrl(trimSlash(properties.getBaseUrl()))
                .defaultHeader("Authorization", properties.getApiKey().trim())
                .build();
    }

    private static String mapDocumentType(String documentType) {
        if (documentType == null || documentType.isBlank()) {
            return "unknown";
        }
        return switch (documentType.trim().toUpperCase()) {
            case "PASSPORT" -> "passport";
            case "DRIVING_LICENSE", "DRIVERS_LICENSE", "DRIVER_LICENSE" -> "driving_license";
            case "NATIONAL_ID", "NATIONAL_IDENTITY_CARD", "ID_CARD" -> "national_identity_card";
            case "RESIDENCE_PERMIT" -> "residence_permit";
            case "VISA" -> "visa";
            case "UTILITY_BILL" -> "utility_bill";
            case "BANK_STATEMENT" -> "bank_statement";
            default -> "other";
        };
    }

    private static String sanitizeFileName(String fileName) {
        String name = fileName == null || fileName.isBlank() ? "upload.jpg" : fileName;
        String lower = name.toLowerCase();
        if (!(lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".pdf"))) {
            return name + ".jpg";
        }
        return name;
    }

    private static String requiredText(JsonNode node, String field) {
        String value = textOrNull(node, field);
        if (value == null) {
            throw new BusinessException("COMPLYCUBE_ERROR", "Missing field in ComplyCube response: " + field, HttpStatus.BAD_GATEWAY);
        }
        return value;
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode child = node.path(field);
        return child.isMissingNode() || child.isNull() ? null : child.asText();
    }

    private static String trimSlash(String url) {
        if (url == null || url.isBlank()) {
            return "https://api.complycube.com/v1";
        }
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
