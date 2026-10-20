package com.palpeer.security.web.dto;

import java.time.Instant;

/**
 * @param lockedUntil set while the transaction PIN is locked after too many wrong PIN attempts
 * @param securityAnswersLockedUntil set while security-answer checks are locked (Forgot PIN)
 */
public record PinStatusResponse(
        boolean pinSet, Instant lockedUntil, Instant securityAnswersLockedUntil) {

    /** Backward-compatible constructor for older call sites / tests. */
    public PinStatusResponse(boolean pinSet, Instant lockedUntil) {
        this(pinSet, lockedUntil, null);
    }
}
