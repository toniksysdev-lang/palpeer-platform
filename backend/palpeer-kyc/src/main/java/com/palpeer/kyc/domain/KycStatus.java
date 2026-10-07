package com.palpeer.kyc.domain;

/**
 * KYC case lifecycle states — verified Phase 2 catalog.
 */
public enum KycStatus {
    NOT_STARTED,
    IN_PROGRESS,
    SUBMITTED,
    UNDER_REVIEW,
    APPROVED,
    REJECTED
}
