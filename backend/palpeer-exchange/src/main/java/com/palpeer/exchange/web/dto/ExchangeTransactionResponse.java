package com.palpeer.exchange.web.dto;

import com.palpeer.exchange.domain.ExchangeTransactionStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ExchangeTransactionResponse(
        UUID id,
        UUID quoteId,
        UUID sourceWalletId,
        UUID targetWalletId,
        BigDecimal sourceAmount,
        BigDecimal targetAmount,
        BigDecimal appliedRate,
        ExchangeTransactionStatus status,
        String idempotencyKey,
        UUID debitLedgerEntryId,
        UUID creditLedgerEntryId,
        String failureReason,
        Instant createdAt
) {
}
