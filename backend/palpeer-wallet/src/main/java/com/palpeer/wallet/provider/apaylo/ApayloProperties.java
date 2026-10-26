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
     * When sandbox is on, settle CAD <em>withdrawals</em> immediately after Apaylo accepts the
     * call (and settle pending funding on read if still PENDING). Funding initiation itself
     * always stays PENDING with Instant Interac instructions until webhook/operator settle.
     * Live mode should leave this false.
     */
    private boolean autoSandboxSettle = false;

    /**
     * When sandbox mode cannot reach Apaylo, still settle CAD <em>withdrawals</em> locally.
     * Funding never silent-credits offline. Never used with live mode.
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
     * Searchable Interac account name customers send to (e.g. {@code Palpeer Global Holding Inc}).
     */
    private String accountId = "";

    /**
     * Interac destination email for CAD Instant deposits (searchable Autodeposit / send-to email).
     * Shown alongside the payee name in funding instructions.
     */
    private String interacCollectionEmail = "ipay@apaylo.com";

    /**
     * Apaylo APL reference (e.g. {@code APL1234}) required in Instant deposit Descriptions.
     */
    private String aplReference = "";

    /**
     * Path for Instant Interac deposit / checkout (CAD funding). Prefer
     * {@code /Merchant/RequestInteracEtransferLink} — no email is sent to the customer.
     */
    private String createSearchableEtransferPath = "/Merchant/RequestInteracEtransferLink";

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
