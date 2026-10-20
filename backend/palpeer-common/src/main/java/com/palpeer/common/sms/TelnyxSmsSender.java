package com.palpeer.common.sms;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Conditional;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Sends SMS via Telnyx Messaging ({@code POST /messages}).
 *
 * <p>Enable exactly one live SMS provider at a time (Telnyx, Twilio, or BulkSMS).
 *
 * @see <a href="https://developers.telnyx.com/docs/api/v2/messaging">Telnyx Messaging</a>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Conditional(TelnyxConfiguredCondition.class)
@ConditionalOnProperty(prefix = "palpeer.sms.telnyx", name = "enabled", havingValue = "true")
public class TelnyxSmsSender implements SmsSender {

    private final TelnyxProperties properties;

    @Override
    public void send(String to, String body) {
        String msisdn = normalizeMsisdn(to);
        if (msisdn.isBlank()) {
            throw new IllegalArgumentException("SMS destination is blank");
        }
        if (body == null || body.isBlank()) {
            throw new IllegalArgumentException("SMS body is blank");
        }

        String from = trim(properties.getFromNumber());
        String profileId = trim(properties.getMessagingProfileId());
        String apiKey = trim(properties.getApiKey());
        if (from.isBlank() || profileId.isBlank() || apiKey.isBlank()) {
            throw new IllegalStateException("Telnyx from number, messaging profile, and API key are required");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("from", from);
        payload.put("to", msisdn);
        payload.put("text", body);
        payload.put("messaging_profile_id", profileId);

        try {
            client()
                    .post()
                    .uri("/messages")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + apiKey)
                    .body(payload)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Telnyx SMS sent [to={}]", msisdn);
        } catch (RestClientResponseException ex) {
            log.error(
                    "Telnyx SMS failed [to={}, status={}, body={}]",
                    msisdn,
                    ex.getStatusCode().value(),
                    ex.getResponseBodyAsString());
            throw new IllegalStateException(
                    "Telnyx delivery failed (" + ex.getStatusCode().value() + ")", ex);
        } catch (RuntimeException ex) {
            log.error("Telnyx SMS failed [to={}]: {}", msisdn, ex.getMessage());
            throw ex;
        }
    }

    private RestClient client() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(properties.getTimeoutMs()));
        factory.setReadTimeout(Duration.ofMillis(properties.getTimeoutMs()));
        String base = properties.getBaseUrl() == null
                ? "https://api.telnyx.com/v2"
                : properties.getBaseUrl().trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return RestClient.builder().baseUrl(base).requestFactory(factory).build();
    }

    static String normalizeMsisdn(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.trim().replaceAll("[\\s()-]", "");
        if (trimmed.startsWith("00")) {
            trimmed = "+" + trimmed.substring(2);
        }
        if (!trimmed.isEmpty() && !trimmed.startsWith("+") && trimmed.chars().allMatch(Character::isDigit)) {
            trimmed = "+" + trimmed;
        }
        return trimmed;
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
