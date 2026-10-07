package com.palpeer.admin.web.dto;

import java.util.Set;
import java.util.UUID;

public record AdminMeResponse(
        UUID userId,
        String email,
        boolean enabled,
        Set<String> roleCodes,
        Set<String> permissionCodes
) {
}
