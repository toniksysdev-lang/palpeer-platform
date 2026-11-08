package com.palpeer.promotion.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One row in the loyalty points ledger, derived from a CAD bonus.
 * {@code entryType}: EARNED (still unused) or USED (applied to fee / credited to wallet).
 */
public record LoyaltyPointsLedgerEntry(
        UUID id,
        String entryType,
        long points,
        BigDecimal cadAmount,
        String currencyCode,
        String reason,
        String status,
        UUID referralId,
        UUID promotionId,
        Instant createdAt
) {
}
