package com.palpeer.wallet.funding.dto;

import java.math.BigDecimal;

/**
 * Structured payment details while funding awaits the customer's transfer.
 *
 * <ul>
 *   <li>{@code BANK_TRANSFER} — Kuda virtual account (account number / bank)
 *   <li>{@code INTERAC_INSTANT} — Apaylo Instant Interac Request Money (pay via Interac email /
 *       banking fulfill; {@code trackingReference} is the Interac reference)
 * </ul>
 */
public record FundingPaymentDetails(
        String accountNumber,
        String accountName,
        String bankName,
        String bankCode,
        String trackingReference,
        BigDecimal amount,
        String currencyCode,
        /** {@code BANK_TRANSFER} or {@code INTERAC_INSTANT}. */
        String method,
        /** Payer Interac email that receives the Request Money (CAD Instant deposit). */
        String interacEmail,
        /** Optional Apaylo APL#### memo for Instant deposit. */
        String aplReference,
        /**
         * Unused for Instant Interac Request Money (leave null). Do not send customers to a
         * collection email — that path prompts for a security question.
         */
        String collectionEmail
) {
    public static final String METHOD_BANK_TRANSFER = "BANK_TRANSFER";
    public static final String METHOD_INTERAC_INSTANT = "INTERAC_INSTANT";

    public FundingPaymentDetails(
            String accountNumber,
            String accountName,
            String bankName,
            String bankCode,
            String trackingReference,
            BigDecimal amount,
            String currencyCode) {
        this(
                accountNumber,
                accountName,
                bankName,
                bankCode,
                trackingReference,
                amount,
                currencyCode,
                METHOD_BANK_TRANSFER,
                null,
                null,
                null);
    }

    public FundingPaymentDetails(
            String accountNumber,
            String accountName,
            String bankName,
            String bankCode,
            String trackingReference,
            BigDecimal amount,
            String currencyCode,
            String method,
            String interacEmail,
            String aplReference) {
        this(
                accountNumber,
                accountName,
                bankName,
                bankCode,
                trackingReference,
                amount,
                currencyCode,
                method,
                interacEmail,
                aplReference,
                null);
    }
}
