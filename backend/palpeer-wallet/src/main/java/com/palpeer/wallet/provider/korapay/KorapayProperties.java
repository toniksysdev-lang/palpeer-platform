package com.palpeer.wallet.provider.korapay;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.korapay")
public class KorapayProperties {

    private boolean enabled = false;

    /**
     * When true (or when the secret key is {@code sk_test_*}), use sandbox credit after initiating
     * a bank-transfer charge so local funding can settle without an inbound webhook.
     */
    private boolean sandbox = true;

    /**
     * After creating a sandbox bank-transfer account, immediately credit it via Korapay's sandbox
     * credit API and settle the funding (CREDIT the user wallet).
     */
    private boolean autoSandboxCredit = true;

    /**
     * When sandbox mode cannot reach Korapay (TLS/network), still settle funding/withdrawals
     * locally so NGN wallet demos keep working. Never used with live keys.
     */
    private boolean offlineSandboxSettle = true;

    /**
     * In sandbox, settle NGN withdrawals immediately after a successful disburse call (or offline
     * settle) so the wallet debit completes without waiting for a transfer webhook.
     */
    private boolean autoSandboxSettle = true;

    private String publicKey = "";

    private String secretKey = "";

    private String baseUrl = "https://api.korapay.com";

    private String bankTransferPath = "/merchant/api/v1/charges/bank-transfer";

    private String sandboxCreditPath = "/merchant/api/v1/virtual-bank-account/sandbox/credit";

    private String chargeQueryPath = "/merchant/api/v1/charges";

    /** Payout (disbursement) to Nigerian bank accounts. */
    private String disbursePath = "/merchant/api/v1/transactions/disburse";

    /** Query charge or payout by merchant reference. */
    private String transactionQueryPath = "/merchant/api/v1/transactions";

    /** List banks for a country (e.g. {@code ?countryCode=NG}). */
    private String banksPath = "/merchant/api/v1/misc/banks";

    /** Merchant available/pending balances. Docs: https://developers.korapay.com/docs/balance-api */
    private String balancesPath = "/merchant/api/v1/balances";

    /**
     * HMAC-SHA256 secret for inbound webhooks. Blank rejects every webhook (fail-closed).
     */
    private String webhookSecret = "";

    private String webhookSignatureHeader = "x-korapay-signature";
}
