package com.palpeer.common.sms;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Sends SMS via Twilio Programmable Messaging ({@code POST …/Messages.json}).
 *
 * @see <a href="https://www.twilio.com/docs/messaging/api/message-resource">Twilio Messages</a>
 */
@Slf4j
@Component
@Primary
@RequiredArgsConstructor
@Conditional(TwilioConfiguredCondition.class)
@ConditionalOnProperty(prefix = "palpeer.sms.twilio", name = "enabled", havingValue = "true")
public class TwilioSmsSender implements SmsSender {

    private static final String API_BASE = "https://api.twilio.com/2010-04-01";

    private final TwilioProperties properties;

    @Override
    public void send(String to, String body) {
        String msisdn = normalizeMsisdn(to);
        if (msisdn.isBlank()) {
            throw new IllegalArgumentException("SMS destination is blank");
        }
        if (body == null || body.isBlank()) {
            throw new IllegalArgumentException("SMS body is blank");
        }
        String accountSid = trim(properties.getAccountSid());
        if (accountSid.isBlank()) {
            throw new IllegalStateException("Twilio Account SID is not configured");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("To", msisdn);
        form.add("Body", body);
        String messagingService = trim(properties.getMessagingServiceSid());
        String from = trim(properties.getFromNumber());
        if (!messagingService.isBlank()) {
            form.add("MessagingServiceSid", messagingService);
        } else if (!from.isBlank()) {
            form.add("From", from);
        } else {
            throw new IllegalStateException("Twilio From number or Messaging Service SID is required");
        }

        String user;
        String pass;
        String apiKeySid = trim(properties.getApiKeySid());
        String apiKeySecret = trim(properties.getApiKeySecret());
        if (!apiKeySid.isBlank() && !apiKeySecret.isBlank()) {
            user = apiKeySid;
            pass = apiKeySecret;
        } else {
            user = accountSid;
            pass = trim(properties.getAuthToken());
        }
        if (pass.isBlank()) {
            throw new IllegalStateException("Twilio API Key Secret or Auth Token is not configured");
        }

        String auth = Base64.getEncoder()
                .encodeToString((user + ":" + pass).getBytes(StandardCharsets.UTF_8));

        try {
            client()
                    .post()
                    .uri("/Accounts/{accountSid}/Messages.json", accountSid)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .header("Authorization", "Basic " + auth)
                    .body(form)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Twilio SMS sent [to={}]", msisdn);
        } catch (RestClientResponseException ex) {
            log.error(
                    "Twilio SMS failed [to={}, status={}, body={}]",
                    msisdn,
                    ex.getStatusCode().value(),
                    ex.getResponseBodyAsString());
            throw new IllegalStateException(
                    "Twilio delivery failed (" + ex.getStatusCode().value() + ")", ex);
        } catch (RuntimeException ex) {
            log.error("Twilio SMS failed [to={}]: {}", msisdn, ex.getMessage());
            throw ex;
        }
    }

    private RestClient client() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(properties.getTimeoutMs()));
        factory.setReadTimeout(Duration.ofMillis(properties.getTimeoutMs()));
        return RestClient.builder().baseUrl(API_BASE).requestFactory(factory).build();
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
