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

    /**
     * When sandbox is on, settle NGN <em>withdrawals</em> immediately after Kuda accepts the call
     * (and settle pending funding on read). Funding initiation itself always stays PENDING until
     * webhook/demo-fund unless this is true <em>and</em> {@link #demoFundEnabled} credits the VA.
     * Live mode should leave this false and rely on Kuda webhooks.
     */
    private boolean autoSandboxSettle = false;

    /**
     * When sandbox mode cannot reach Kuda (auth/network), still settle <em>withdrawals</em> locally.
     * Funding never silent-credits offline — it stays PENDING with VA transfer instructions.
     */
    private boolean offlineSandboxSettle = true;

    /**
     * When sandbox is on, call Kuda {@code FUND_VIRTUAL_ACCOUNT} to credit the customer's VA from
     * the business main account (official demo/test funding) and skip the customer transfer step.
     * Default false so the app shows VA details and waits for a real inbound transfer + webhook.
     * Live mode never uses this.
     */
    private boolean demoFundEnabled = false;

    private String email = "";

    private String apiKey = "";

    /**
     * Live: https://kuda-openapi.kuda.com/v2.1
     * UAT: https://kuda-openapi-uat.kudabank.com/v2.1
     */
    private String baseUrl = "";

    /**
     * Optional fixed sender name on outbound transfers.
     */
    private String senderName = "PALPEER";

    /**
     * Kuda dashboard webhook username (custom {@code username} header, plaintext).
     * Preferred auth when set together with {@link #webhookPassword}.
     */
    private String webhookUsername = "";

    /**
     * Kuda dashboard webhook password (compared after Base64-decoding the {@code password} header).
     */
    private String webhookPassword = "";

    /**
     * Optional HMAC-SHA256 secret for local/tests. Used only when username/password are blank.
     */
    private String webhookSecret = "";

    private String webhookSignatureHeader = "X-Webhook-Signature";
}
