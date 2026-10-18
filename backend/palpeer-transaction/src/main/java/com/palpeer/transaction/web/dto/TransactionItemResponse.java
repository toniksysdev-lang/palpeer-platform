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
        /** Owner email when resolved (admin lists); null on owner self-service views. */
        String userEmail,
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
    public TransactionItemResponse withUserEmail(String email) {
        return new TransactionItemResponse(
                type,
                id,
                userId,
                email,
                status,
                walletId,
                secondaryWalletId,
                currencyCode,
                secondaryCurrencyCode,
                amount,
                secondaryAmount,
                appliedRate,
                failureReason,
                ledgerEntryIds,
                createdAt,
                updatedAt);
    }
}
