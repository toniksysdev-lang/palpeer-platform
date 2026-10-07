package com.palpeer.ledger.service;

import com.palpeer.ledger.domain.LedgerEntryType;
import java.math.BigDecimal;
import java.util.UUID;

public record LedgerPostingRequest(
        UUID walletId,
        LedgerEntryType entryType,
        BigDecimal amount,
        String idempotencyKey,
        String referenceType,
        String referenceId,
        String description
) {
}
