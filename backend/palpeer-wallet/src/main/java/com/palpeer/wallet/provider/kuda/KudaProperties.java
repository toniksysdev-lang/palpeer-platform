package com.palpeer.wallet.provider.kuda;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.kuda")
public class KudaProperties {

    private boolean enabled = false;

    private boolean sandbox = true;

    private String email = "";

    private String apiKey = "";

    /**
     * Live: https://kuda-openapi.kuda.com/v2
     * UAT: https://kuda-openapi-uat.kudabank.com/v2
     */
    private String baseUrl = "";

    /**
     * Optional fixed sender name on outbound transfers.
     */
    private String senderName = "PALPEER";

    /**
     * HMAC-SHA256 secret for inbound webhooks. Blank rejects every webhook.
     * CONTRACT_PENDING (P6-KUDA-02): confirm Kuda's signing scheme and header name.
     */
    private String webhookSecret = "";

    private String webhookSignatureHeader = "X-Webhook-Signature";
}
