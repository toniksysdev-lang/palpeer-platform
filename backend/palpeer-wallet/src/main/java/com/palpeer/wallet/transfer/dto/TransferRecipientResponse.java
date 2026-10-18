package com.palpeer.wallet.transfer.dto;

import java.util.UUID;

/**
 * Confirmed transfer recipient for the mobile review step.
 * {@code displayName} is the profile full name when set.
 */
public record TransferRecipientResponse(
        UUID userId,
        String displayName,
        /** Normalized email or phone that matched {@code q}. */
        String recipient,
        /** {@code EMAIL} or {@code PHONE}. */
        String matchedBy,
        /**
         * When {@code currencyCode} was supplied on the lookup: whether the recipient already has a
         * wallet in that currency (required to complete the transfer).
         */
        Boolean hasWallet
) {}
