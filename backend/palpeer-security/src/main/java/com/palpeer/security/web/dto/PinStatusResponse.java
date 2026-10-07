package com.palpeer.security.web.dto;

import java.time.Instant;

/**
 * @param lockedUntil set while the PIN is locked after too many wrong attempts; null otherwise
 */
public record PinStatusResponse(
        boolean pinSet,
        Instant lockedUntil
) {
}
