package com.palpeer.user.domain;

/**
 * User lifecycle status.
 *
 * CONTRACT_PENDING: definitive status catalog was not provided in the Phase 1 brief.
 * Values below are provisional placeholders required to persist the verified `status` field.
 * Replace/confirm before production use.
 */
public enum UserStatus {
    PENDING_VERIFICATION,
    ACTIVE,
    SUSPENDED,
    CLOSED
}
