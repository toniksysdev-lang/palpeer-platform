package com.palpeer.transaction.service;

import com.palpeer.transaction.domain.TransactionActivityType;
import java.time.Instant;
import java.util.UUID;

/**
 * Optional filters for the admin global transaction feed. Every field may be null.
 * {@code status} is matched against each source's own status enum; sources whose enum
 * does not contain the value contribute no rows.
 */
public record AdminTransactionFilter(
        TransactionActivityType type,
        String status,
        String currencyCode,
        UUID userId,
        Instant from,
        Instant to
) {
}
