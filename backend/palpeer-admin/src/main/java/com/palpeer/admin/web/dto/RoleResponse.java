package com.palpeer.admin.web.dto;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record RoleResponse(
        UUID id,
        String code,
        String name,
        String description,
        Set<String> permissionCodes,
        Instant createdAt
) {
}
