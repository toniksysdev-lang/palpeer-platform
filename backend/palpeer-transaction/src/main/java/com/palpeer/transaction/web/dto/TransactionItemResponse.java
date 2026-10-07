package com.palpeer.transaction.web.dto;

import com.palpeer.transaction.domain.TransactionActivityType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Unified list/detail projection across funding, withdrawal, and exchange.
 */
public record TransactionItemResponse(
        TransactionActivityType type,
        UUID id,
        UUID userId,
        String status,
        UUID walletId,
        UUID secondaryWalletId,
        String currencyCode,
        String secondaryCurrencyCode,
        BigDecimal amount,
        BigDecimal secondaryAmount,
        BigDecimal appliedRate,
        String failureReason,
        Map<String, UUID> ledgerEntryIds,
        Instant createdAt,
        Instant updatedAt
) {
}
