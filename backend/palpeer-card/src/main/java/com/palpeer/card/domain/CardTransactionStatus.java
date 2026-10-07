package com.palpeer.card.domain;

/**
 * Card transaction processing status.
 * CONTRACT_PENDING (P13-03): status transitions and settlement rules.
 */
public enum CardTransactionStatus {
    PENDING,
    SETTLED,
    FAILED,
    REVERSED
}
