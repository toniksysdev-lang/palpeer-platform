package com.palpeer.wallet.web.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record WalletResponse(
        UUID id,
        UUID userId,
        String currencyCode,
        BigDecimal availableBalance,
        BigDecimal pendingBalance,
        /** Populated for admin inventory; null on owner self-service responses. */
        String userEmail,
        String userFirstName,
        String userLastName
) {
    /** Owner self-service constructor — no user contact fields. */
    public WalletResponse(
            UUID id,
            UUID userId,
            String currencyCode,
            BigDecimal availableBalance,
            BigDecimal pendingBalance) {
        this(id, userId, currencyCode, availableBalance, pendingBalance, null, null, null);
    }
}
