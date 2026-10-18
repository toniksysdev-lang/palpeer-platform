package com.palpeer.common.mail;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Conditional;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Delivers mail via SendPulse SMTP REST ({@code POST /smtp/emails}) so PaaS hosts that block
 * outbound SMTP can still send OTP and notification emails over HTTPS.
 */
@Slf4j
@Component
@Conditional(SendPulseMailConfiguredCondition.class)
@RequiredArgsConstructor
public class SendPulseEmailSender implements EmailSender {

    private final SendPulseMailProperties sendPulseProperties;
    private final PalpeerMailProperties mailProperties;

    private final AtomicReference<CachedToken> tokenRef = new AtomicReference<>();

    @Override
    public void send(String to, String subject, String textBody, String htmlBody) {
        if (!sendPulseProperties.hasCredentials()) {
            throw new IllegalStateException(
                    "SendPulse is not configured. Set PALPEER_SENDPULSE_CLIENT_ID and"
                            + " PALPEER_SENDPULSE_CLIENT_SECRET.");
        }
        if (!StringUtils.hasText(to)) {
            throw new IllegalArgumentException("Email recipient is required");
        }

        String preparedHtml = prepareHtml(htmlBody);
        boolean hasHtml = StringUtils.hasText(preparedHtml);
        String text = textBody == null ? "" : textBody;
        if (!hasHtml && !StringUtils.hasText(text)) {
            throw new IllegalArgumentException("Email body is required");
        }

        Map<String, Object> from = new LinkedHashMap<>();
        from.put("name", mailProperties.getFromName());
        from.put("email", mailProperties.getFrom());

        Map<String, Object> recipient = new LinkedHashMap<>();
        recipient.put("email", to.trim());

        Map<String, Object> email = new LinkedHashMap<>();
        email.put("subject", subject == null ? "" : subject);
        email.put("from", from);
        email.put("to", List.of(recipient));
        email.put("text", text);
        if (hasHtml) {
            email.put(
                    "html",
                    Base64.getEncoder()
                            .encodeToString(preparedHtml.getBytes(StandardCharsets.UTF_8)));
        } else {
            email.put("auto_plain_text", true);
        }
        if (StringUtils.hasText(mailProperties.getHeaderFrom())) {
            Map<String, Object> replyTo = new LinkedHashMap<>();
            replyTo.put("email", mailProperties.getHeaderFrom().trim());
            replyTo.put("name", mailProperties.getFromName());
            email.put("reply_to", replyTo);
        }

        Map<String, Object> body = Map.of("email", email);
        try {
            JsonNode response =
                    client()
                            .post()
                            .uri("/smtp/emails")
                            .header("Authorization", "Bearer " + accessToken())
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(body)
                            .retrieve()
                            .body(JsonNode.class);
            String id = response == null ? null : response.path("id").asText(null);
            boolean ok = response != null && response.path("result").asBoolean(false);
            if (!ok) {
                throw new IllegalStateException(
                        "SendPulse rejected email: " + (response == null ? "empty" : response));
            }
            log.info(
                    "Email sent to={} subject={} html={} htmlChars={} via sendpulse id={}",
                    to,
                    subject,
                    hasHtml,
                    hasHtml ? preparedHtml.length() : 0,
                    id);
        } catch (RestClientResponseException ex) {
            log.error(
                    "Failed to send email to={} subject={} via sendpulse: {} {}",
                    to,
                    subject,
                    ex.getStatusCode().value(),
                    truncate(ex.getResponseBodyAsString(), 400),
                    ex);
            throw new IllegalStateException(
                    "Email delivery failed: SendPulse HTTP " + ex.getStatusCode().value(), ex);
        }
    }

    private String accessToken() {
        CachedToken cached = tokenRef.get();
        Instant now = Instant.now();
        if (cached != null && now.isBefore(cached.expiresAt().minusSeconds(60))) {
            return cached.token();
        }
        synchronized (this) {
            cached = tokenRef.get();
            if (cached != null && now.isBefore(cached.expiresAt().minusSeconds(60))) {
                return cached.token();
            }
            Map<String, String> form =
                    Map.of(
                            "grant_type",
                            "client_credentials",
                            "client_id",
                            sendPulseProperties.getClientId().trim(),
                            "client_secret",
                            sendPulseProperties.getClientSecret().trim());
            try {
                JsonNode response =
                        client()
                                .post()
                                .uri("/oauth/access_token")
                                .contentType(MediaType.APPLICATION_JSON)
                                .body(form)
                                .retrieve()
                                .body(JsonNode.class);
                if (response == null || !StringUtils.hasText(response.path("access_token").asText())) {
                    throw new IllegalStateException("SendPulse OAuth returned no access_token");
                }
                String token = response.path("access_token").asText();
                long expiresIn = response.path("expires_in").asLong(3600);
                tokenRef.set(new CachedToken(token, Instant.now().plusSeconds(Math.max(60, expiresIn))));
                return token;
            } catch (RestClientResponseException ex) {
                throw new IllegalStateException(
                        "SendPulse OAuth failed: HTTP " + ex.getStatusCode().value(), ex);
            }
        }
    }

    private RestClient client() {
        HttpClient httpClient =
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofSeconds(30));
        String base = sendPulseProperties.getBaseUrl();
        if (!StringUtils.hasText(base)) {
            base = "https://api.sendpulse.com";
        }
        return RestClient.builder()
                .baseUrl(base.endsWith("/") ? base.substring(0, base.length() - 1) : base)
                .requestFactory(factory)
                .build();
    }

    /**
     * REST cannot attach CID inlines the way SMTP MIME does — swap the logo to a data URI so
     * branded HTML still renders.
     */
    String prepareHtml(String htmlBody) {
        if (!StringUtils.hasText(htmlBody)) {
            return htmlBody;
        }
        if (!htmlBody.contains(EmailBrand.LOGO_CID_SRC)) {
            return htmlBody;
        }
        String dataUri = loadLogoDataUri();
        if (dataUri == null) {
            log.warn("Email logo missing on classpath (mail/palpeer-logo.png); HTML may show broken image");
            return htmlBody;
        }
        return htmlBody.replace(EmailBrand.LOGO_CID_SRC, dataUri);
    }

    private String loadLogoDataUri() {
        ClassPathResource logo = new ClassPathResource("mail/palpeer-logo.png");
        if (!logo.exists()) {
            return null;
        }
        try (InputStream in = logo.getInputStream()) {
            byte[] bytes = in.readAllBytes();
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(bytes);
        } catch (IOException ex) {
            log.warn("Failed to load email logo: {}", ex.getMessage());
            return null;
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max) + "…";
    }

    private record CachedToken(String token, Instant expiresAt) {}
}
