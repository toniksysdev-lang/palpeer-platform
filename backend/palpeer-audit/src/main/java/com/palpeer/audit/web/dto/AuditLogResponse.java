package com.palpeer.audit.web.dto;

import java.time.Instant;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        Instant createdAt,
        String userRef,
        /** Resolved from {@code userRef} when it is a user id; otherwise null. */
        String actorEmail,
        String action,
        String entity,
        String oldValue,
        String newValue,
        String ipAddress,
        String device
) {
}
