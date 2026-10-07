package com.palpeer.admin.web.dto;

import java.util.Set;
import java.util.UUID;

public record AdminUserResponse(
        UUID id,
        UUID userId,
        boolean enabled,
        Set<String> roleCodes
) {
}
