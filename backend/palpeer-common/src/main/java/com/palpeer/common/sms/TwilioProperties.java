package com.palpeer.common.sms;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Twilio Programmable Messaging settings.
 *
 * @see <a href="https://www.twilio.com/docs/messaging/api">Twilio Messaging API</a>
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.sms.twilio")
public class TwilioProperties {

    /** When true and credentials are present, {@link TwilioSmsSender} is the live SMS bean. */
    private boolean enabled = false;

    /** Account SID ({@code AC…}) — required in the Messages API path. */
    private String accountSid = "";

    /** API Key SID ({@code SK…}); preferred over Account SID for Basic auth username. */
    private String apiKeySid = "";

    /** API Key Secret (password when using API Key auth). */
    private String apiKeySecret = "";

    /** Account Auth Token (alternative to API Key auth). */
    private String authToken = "";

    /** E.164 Twilio number or alphanumeric sender (e.g. {@code +15551234567}). */
    private String fromNumber = "";

    /** Optional Messaging Service SID ({@code MG…}); used instead of {@link #fromNumber} when set. */
    private String messagingServiceSid = "";

    private String friendlyName = "";

    private int timeoutMs = 15000;
}
