package com.palpeer.transaction.domain;

/**
 * Product types projected into the transaction feed.
 * CONTRACT_PENDING (P11-01): catalog may still grow (card, bonus).
 */
public enum TransactionActivityType {
    FUNDING,
    WITHDRAWAL,
    EXCHANGE,
    /** Wallet-to-wallet transfer (ledger reference type TRANSFER). Always SUCCESS when recorded. */
    TRANSFER,
    /**
     * Settled P2P order (ACCEPTED or COMPLETED). Base amount + quote amount via applied rate;
     * currencies come from the linked request.
     */
    P2P
}
