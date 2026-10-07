package com.palpeer.wallet.web.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record WalletResponse(
        UUID id,
        UUID userId,
        String currencyCode,
        BigDecimal availableBalance,
        BigDecimal pendingBalance
) {
}
