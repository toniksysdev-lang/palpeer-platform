package com.palpeer.auth.web.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * Active refresh-token session. Token hashes are never exposed.
 */
public record SessionResponse(
        UUID id,
        Instant createdAt,
        Instant expiresAt,
        boolean current
) {
}
