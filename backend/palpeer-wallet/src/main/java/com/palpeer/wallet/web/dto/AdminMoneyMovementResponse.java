package com.palpeer.wallet.web.dto;

import com.palpeer.wallet.funding.MoneyMovementStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Unified funding/withdrawal row for admin wallet detail. */
public record AdminMoneyMovementResponse(
        UUID id,
        String type,
        UUID walletId,
        UUID userId,
        BigDecimal amount,
        String currencyCode,
        MoneyMovementStatus status,
        String failureReason,
        String reference,
        String providerName,
        Instant createdAt
) {
}
