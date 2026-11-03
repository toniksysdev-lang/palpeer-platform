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
     * Merchant display / account label (optional; shown on funding details).
     */
    private String accountId = "";

    /**
     * Registered Autodeposit receive email customers send CAD Instant Interac to
     * (e.g. {@code pay@palpeer.com}).
     */
    private String interacCollectionEmail = "";

    /**
     * Apaylo APL reference (e.g. {@code APL1234}) optional memo for Instant deposit.
     */
    private String aplReference = "";

    /**
     * Unused for Autodeposit funding (kept for forward-compat / optional Request Money experiments).
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
     * Poll Instant Interac / request-money funding status (Apaylo has no webhooks).
     */
    private String searchRequestInteracPath = "/Merchant/SearchRequestInteracEtransfer";

    /**
     * Poll completed incoming Interac receives (autodeposit / send-to-business).
     */
    private String searchIncomingInteracPath = "/Merchant/SearchInteracEtransfers";

    /**
     * Poll Interac send (CAD withdrawal) status.
     */
    private String searchSendInteracPath = "/Merchant/SearchSendInteracEtransfer";

    /**
     * Poll EFT credit (CAD bank withdrawal) status.
     */
    private String searchEftPath = "/EFT/SearchEFTTransaction";

    /**
     * Background reconcile delay (Apaylo recommends polling every 3–5 minutes).
     */
    private long reconcileDelayMs = 180_000L;

    private long reconcileInitialDelayMs = 20_000L;

    /**
     * Unused: Apaylo does not offer webhooks (see docs FAQ). Kept for forward-compat.
     */
    private String webhookSecret = "";

    private String webhookSignatureHeader = "X-Webhook-Signature";
}
