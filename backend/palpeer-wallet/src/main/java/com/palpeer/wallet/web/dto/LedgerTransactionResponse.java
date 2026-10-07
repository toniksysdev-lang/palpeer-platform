package com.palpeer.wallet.web.dto;

import com.palpeer.ledger.domain.LedgerEntryType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record LedgerTransactionResponse(
        UUID id,
        UUID walletId,
        LedgerEntryType entryType,
        BigDecimal amount,
        String currencyCode,
        BigDecimal availableBalanceAfter,
        BigDecimal pendingBalanceAfter,
        String referenceType,
        String referenceId,
        String description,
        Instant createdAt
) {
}
