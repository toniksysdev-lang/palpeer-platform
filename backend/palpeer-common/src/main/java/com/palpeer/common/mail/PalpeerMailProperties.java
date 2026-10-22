package com.palpeer.common.mail;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.mail")
public class PalpeerMailProperties {

    /**
     * Delivery backend: {@code auto} (SendPulse REST when credentials exist, else SMTP),
     * {@code sendpulse}, or {@code smtp}.
     */
    private String provider = "auto";

    /**
     * Envelope / From address. Prefer an address on a SendPulse-authenticated domain (e.g.
     * {@code noreply@palpeer.com}).
     */
    private String from = "noreply@palpeer.com";

    /** Display name — avoid ALL-CAPS (spam filter signal). */
    private String fromName = "Palpeer";

    /**
     * Reply-To address. Prefer a monitored inbox (e.g. {@code support@palpeer.com}), not
     * {@code noreply@…}.
     */
    private String headerFrom = "support@palpeer.com";
}
