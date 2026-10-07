package com.palpeer.transaction.domain;

/**
 * Product types projected into the transaction feed.
 * CONTRACT_PENDING (P11-01): catalog may grow (P2P, card, bonus) once those settle on ledger.
 */
public enum TransactionActivityType {
    FUNDING,
    WITHDRAWAL,
    EXCHANGE
}
