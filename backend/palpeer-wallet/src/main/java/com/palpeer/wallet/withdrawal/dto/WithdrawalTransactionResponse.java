package com.palpeer.wallet.withdrawal.dto;

import com.palpeer.wallet.funding.MoneyMovementStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record WithdrawalTransactionResponse(
        UUID id,
        UUID walletId,
        BigDecimal amount,
        String currencyCode,
        MoneyMovementStatus status,
        String idempotencyKey,
        UUID holdLedgerEntryId,
        UUID debitLedgerEntryId,
        UUID releaseLedgerEntryId,
        UUID reversalLedgerEntryId,
        String failureReason,
        String destinationReference,
        String providerName,
        String providerReference,
        Instant createdAt
) {
}
