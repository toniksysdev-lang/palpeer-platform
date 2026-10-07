package com.palpeer.wallet.funding;

/**
 * Shared lifecycle for funding and withdrawal.
 * Verified Phase 6 catalog.
 */
public enum MoneyMovementStatus {
    INITIATED,
    PENDING,
    PROCESSING,
    SUCCESS,
    FAILED,
    REVERSED
}
