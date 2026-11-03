package com.palpeer.wallet.funding.dto;

import java.math.BigDecimal;

/**
 * Structured payment details while funding awaits the customer's transfer.
 *
 * <ul>
 *   <li>{@code BANK_TRANSFER} — Kuda virtual account (account number / bank)
 *   <li>{@code INTERAC_INSTANT} — Apaylo Instant Interac Autodeposit ({@code collectionEmail} is
 *       the send-to address; {@code trackingReference} is the memo / settlement ref)
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
        /** Payer Interac email (send-from) for CAD Instant deposit. */
        String interacEmail,
        /** Optional Apaylo APL#### memo for Instant deposit. */
        String aplReference,
        /** Merchant Autodeposit receive email (e.g. pay@palpeer.com). */
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
