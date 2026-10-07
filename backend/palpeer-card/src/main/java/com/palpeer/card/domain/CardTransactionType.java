package com.palpeer.card.domain;

/**
 * Provider-reported card movement type.
 * CONTRACT_PENDING (P13-02): catalog (auth/capture/refund/etc.).
 */
public enum CardTransactionType {
    AUTHORIZATION,
    CAPTURE,
    REFUND,
    REVERSAL,
    FEE,
    OTHER
}
