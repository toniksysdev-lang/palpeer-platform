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

    /** Envelope / From address. */
    private String from = "noreply@palpeer.com.ng";

    private String fromName = "PALPEER SUPPORT";

    /** Optional Reply-To / Header From override. */
    private String headerFrom;
}
