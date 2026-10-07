package com.palpeer.wallet.funding.dto;

import com.palpeer.wallet.funding.MoneyMovementStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FundingTransactionResponse(
        UUID id,
        UUID walletId,
        BigDecimal amount,
        String currencyCode,
        MoneyMovementStatus status,
        String idempotencyKey,
        UUID ledgerEntryId,
        UUID reversalLedgerEntryId,
        String failureReason,
        String providerName,
        String providerReference,
        String fundingInstructions,
        Instant createdAt
) {
}
