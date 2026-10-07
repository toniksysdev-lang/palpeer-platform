package com.palpeer.ledger.domain;

/**
 * Ledger entry types — verified Phase 5 catalog.
 *
 * CONTRACT_PENDING (P5-01): HOLD/RELEASE semantics.
 * Provisional:
 * - CREDIT: increases available
 * - DEBIT: decreases available
 * - HOLD: moves amount from available to pending
 * - RELEASE: moves amount from pending back to available
 */
public enum LedgerEntryType {
    CREDIT,
    DEBIT,
    HOLD,
    RELEASE
}
