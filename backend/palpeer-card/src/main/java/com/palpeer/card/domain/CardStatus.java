package com.palpeer.card.domain;

/**
 * Local card lifecycle status.
 * CONTRACT_PENDING (P13-01): definitive status catalog and provider mapping.
 */
public enum CardStatus {
    PENDING,
    ACTIVE,
    BLOCKED,
    CLOSED
}
