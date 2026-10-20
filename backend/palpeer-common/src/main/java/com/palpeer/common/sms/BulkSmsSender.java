package com.palpeer.common.sms;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
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
 * Sends SMS via BulkSMS JSON REST API ({@code POST /messages}).
 *
 * @see <a href="https://www.bulksms.com/developer/json/v1/">BulkSMS JSON API</a>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@Conditional(BulkSmsConfiguredCondition.class)
@ConditionalOnProperty(prefix = "palpeer.sms.bulksms", name = "enabled", havingValue = "true")
public class BulkSmsSender implements SmsSender {

    private final BulkSmsProperties properties;

    @Override
    public void send(String to, String body) {
        String msisdn = normalizeMsisdn(to);
        if (msisdn.isBlank()) {
            throw new IllegalArgumentException("SMS destination is blank");
        }
        if (body == null || body.isBlank()) {
            throw new IllegalArgumentException("SMS body is blank");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("to", msisdn);
        payload.put("body", body);
        if (properties.getSender() != null && !properties.getSender().isBlank()) {
            payload.put("from", properties.getSender().trim());
        }

        String auth = Base64.getEncoder()
                .encodeToString((properties.getTokenId() + ":" + properties.getTokenSecret())
                        .getBytes(StandardCharsets.UTF_8));

        try {
            client()
                    .post()
                    .uri("/messages")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Basic " + auth)
                    .body(List.of(payload))
                    .retrieve()
                    .toBodilessEntity();
            log.info("BulkSMS sent [to={}]", msisdn);
        } catch (RestClientResponseException ex) {
            log.error(
                    "BulkSMS failed [to={}, status={}, body={}]",
                    msisdn,
                    ex.getStatusCode().value(),
                    ex.getResponseBodyAsString());
            throw new IllegalStateException(
                    "BulkSMS delivery failed (" + ex.getStatusCode().value() + ")", ex);
        } catch (RuntimeException ex) {
            log.error("BulkSMS failed [to={}]: {}", msisdn, ex.getMessage());
            throw ex;
        }
    }

    private RestClient client() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(properties.getTimeoutMs()));
        factory.setReadTimeout(Duration.ofMillis(properties.getTimeoutMs()));
        String base = properties.getBaseUrl() == null ? "https://api.bulksms.com/v1" : properties.getBaseUrl().trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return RestClient.builder().baseUrl(base).requestFactory(factory).build();
    }

    /** BulkSMS expects international format without spaces; keep leading +. */
    static String normalizeMsisdn(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.trim().replaceAll("[\\s()-]", "");
        if (trimmed.startsWith("00")) {
            trimmed = "+" + trimmed.substring(2);
        }
        return trimmed;
    }
}
