package com.palpeer.promotion.domain;

/**
 * CONTRACT_PENDING (P14-03): bonus grant/settlement.
 * Ledger credit deferred — {@code ledgerEntryId} reserved.
 */
public enum BonusStatus {
    PENDING,
    GRANTED,
    CANCELLED,
    FAILED
}
