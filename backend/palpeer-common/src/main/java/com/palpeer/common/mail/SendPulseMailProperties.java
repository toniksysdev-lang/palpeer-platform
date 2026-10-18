package com.palpeer.common.mail;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/**
 * SendPulse SMTP REST API credentials ({@code PALPEER_SENDPULSE_*}). Prefer this over raw SMTP on
 * hosts that block outbound ports 587/465 (e.g. Render free).
 *
 * <p>When dedicated API vars are empty, {@code application.yml} falls back to
 * {@code PALPEER_SMTP_USERNAME} / {@code PALPEER_SMTP_PASSWORD} as OAuth client_id / client_secret.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.mail.sendpulse")
public class SendPulseMailProperties {

    /**
     * When true, force SendPulse even if {@code palpeer.mail.provider=auto}. When false with
     * provider=auto, SendPulse is still selected if client-id and client-secret are both set.
     */
    private boolean enabled = false;

    /** OAuth client_id (SendPulse API ID, or SMTP username fallback). */
    private String clientId = "";

    /** OAuth client_secret (SendPulse API Secret, or SMTP password fallback). */
    private String clientSecret = "";

    private String baseUrl = "https://api.sendpulse.com";

    public boolean hasCredentials() {
        return StringUtils.hasText(clientId) && StringUtils.hasText(clientSecret);
    }
}
