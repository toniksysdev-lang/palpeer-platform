package com.palpeer.common.sms;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Telnyx Messaging API settings.
 *
 * @see <a href="https://developers.telnyx.com/docs/api/v2/messaging">Telnyx Messaging</a>
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.sms.telnyx")
public class TelnyxProperties {

    /** When true and credentials are present, {@link TelnyxSmsSender} can register as live SMS. */
    private boolean enabled = false;

    /** API v2 bearer key ({@code KEY…}). */
    private String apiKey = "";

    /** API base (no trailing slash), e.g. {@code https://api.telnyx.com/v2}. */
    private String baseUrl = "https://api.telnyx.com/v2";

    /** Messaging Profile ID used when sending. */
    private String messagingProfileId = "";

    /** E.164 sender number (e.g. {@code +12267560402}). */
    private String fromNumber = "";

    private int timeoutMs = 15000;
}
