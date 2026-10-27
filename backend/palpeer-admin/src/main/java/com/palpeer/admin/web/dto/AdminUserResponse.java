package com.palpeer.admin.web.dto;

import java.util.Set;
import java.util.UUID;

public record AdminUserResponse(
        UUID id,
        UUID userId,
        String email,
        String firstName,
        String lastName,
        boolean enabled,
        Set<String> roleCodes
) {
}
