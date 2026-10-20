package com.palpeer.common.sms;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * BulkSMS JSON REST API settings ({@code https://api.bulksms.com/v1}).
 *
 * <p>Auth uses HTTP Basic with {@link #tokenId} as username and {@link #tokenSecret} as password.
 * The legacy EAPI ({@code https://www.bulksms.com/developer/eapi/}) is deprecated in favour of this
 * JSON API.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.sms.bulksms")
public class BulkSmsProperties {

    /** When false, {@link LoggingSmsSender} is used instead of live BulkSMS delivery. */
    private boolean enabled = false;

    /** API Token ID from BulkSMS → Settings → Advanced → API Tokens. */
    private String tokenId = "";

    /** API Token Secret paired with {@link #tokenId}. */
    private String tokenSecret = "";

    /** JSON API base (no trailing slash), e.g. {@code https://api.bulksms.com/v1}. */
    private String baseUrl = "https://api.bulksms.com/v1";

    /** Optional alphanumeric sender ID (route-specific; max 11 chars when used). */
    private String sender = "Palpeer";

    private int timeoutMs = 15000;

    public boolean isConfigured() {
        return enabled
                && tokenId != null
                && !tokenId.isBlank()
                && tokenSecret != null
                && !tokenSecret.isBlank();
    }
}
