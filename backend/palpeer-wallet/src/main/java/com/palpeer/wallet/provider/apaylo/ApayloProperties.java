package com.palpeer.wallet.provider.apaylo;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.apaylo")
public class ApayloProperties {

    private boolean enabled = false;

    /**
     * Merchant API key (header {@code Key}).
     */
    private String apiKey = "";

    /**
     * Shared secret / password (header {@code Password}).
     */
    private String sharedKey = "";

    private String baseUrl = "https://api.apaylo.com";

    /**
     * Path for Interac Request Money (CAD funding).
     * CONTRACT_PENDING (P6-APAYLO-01): confirm exact path with Apaylo account docs.
     */
    private String createSearchableEtransferPath = "/api/Merchant/CreateSearchableEtransfer";

    /**
     * Path for Interac send (CAD withdrawal to email/phone).
     */
    private String sendInteracEtransferPath = "/api/Merchant/SendInteracEtransfer";

    /**
     * Path for EFT credit (CAD bank withdrawal).
     */
    private String sendEftPath = "/api/Merchant/CreateEFTTransaction";

    /**
     * HMAC-SHA256 secret for inbound webhooks. Blank rejects every webhook.
     * CONTRACT_PENDING (P6-APAYLO-02): confirm Apaylo's signing scheme and header name.
     */
    private String webhookSecret = "";

    private String webhookSignatureHeader = "X-Webhook-Signature";
}
