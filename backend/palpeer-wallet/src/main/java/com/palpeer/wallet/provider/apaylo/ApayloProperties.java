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
     * When true, use {@link #sandboxBaseUrl} (default sandboxapi) instead of {@link #baseUrl}.
     */
    private boolean sandbox = false;

    /**
     * When sandbox is on, settle CAD funding/withdrawals immediately after Apaylo accepts the
     * call (local demos cannot receive Interac/EFT webhooks). Live mode ignores this flag.
     */
    private boolean autoSandboxSettle = true;

    /**
     * When sandbox mode cannot reach Apaylo, still settle CAD funding/withdrawals locally so
     * wallet demos keep working. Never used with live mode.
     */
    private boolean offlineSandboxSettle = true;

    /**
     * Merchant API key (header {@code Key}).
     */
    private String apiKey = "";

    /**
     * Shared secret used to build the daily {@code Signature} header.
     */
    private String sharedKey = "";

    /**
     * Live merchant API host (env2). Apaylo documents this as {@code host/host/api}.
     */
    private String baseUrl = "https://api.etransfer.apaylo.com/api.apaylo.com/api";

    /**
     * Sandbox merchant API host (env2). Used when {@link #sandbox} is true.
     */
    private String sandboxBaseUrl = "https://sandboxapi.apaylo.com/sandboxapi.apaylo.com/api";

    /**
     * Optional merchant display name / account label (informational; auth is Key+Signature).
     */
    private String accountId = "";

    /**
     * Path for Interac Request Money (CAD funding).
     */
    private String createSearchableEtransferPath = "/Merchant/RequestInteracEtransferEmail";

    /**
     * Path for Interac send (CAD withdrawal to email/phone).
     */
    private String sendInteracEtransferPath = "/Merchant/SendInteracEtransfer";

    /**
     * Path for EFT credit (CAD bank withdrawal).
     */
    private String sendEftPath = "/EFT/CreateEFTTransaction";

    /**
     * Interac send security question (required by Apaylo SendInteracEtransfer).
     */
    private String interacSecurityQuestion = "What is the name of this transfer?";

    /**
     * Interac send security answer paired with {@link #interacSecurityQuestion}.
     */
    private String interacSecurityAnswer = "PALPEER";

    /**
     * Path for merchant wallet balance ({@code GET}).
     */
    private String accountBalancePath = "/Merchant/GetBalance";

    /**
     * HMAC-SHA256 secret for inbound webhooks. Blank rejects every webhook.
     */
    private String webhookSecret = "";

    private String webhookSignatureHeader = "X-Webhook-Signature";
}
