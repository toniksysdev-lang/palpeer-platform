package com.palpeer.card.web.dto;

import com.palpeer.card.domain.CardTransactionStatus;
import com.palpeer.card.domain.CardTransactionType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CardTransactionResponse(
        UUID id,
        UUID cardId,
        String providerTransactionId,
        CardTransactionType entryType,
        CardTransactionStatus status,
        BigDecimal amount,
        String currencyCode,
        String merchantName,
        Instant occurredAt,
        UUID ledgerEntryId,
        String failureReason,
        Instant createdAt
) {
}
