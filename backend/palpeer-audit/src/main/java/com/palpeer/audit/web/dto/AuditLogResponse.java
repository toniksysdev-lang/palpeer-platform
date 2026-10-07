package com.palpeer.audit.web.dto;

import java.time.Instant;
import java.util.UUID;

public record AuditLogResponse(
        UUID id,
        Instant createdAt,
        String userRef,
        String action,
        String entity,
        String oldValue,
        String newValue,
        String ipAddress,
        String device
) {
}
