package com.palpeer.admin.web.dto;

import com.palpeer.user.domain.UserStatus;
import java.time.Instant;
import java.util.UUID;

public record AdminUserSummaryResponse(
        UUID id,
        String email,
        String phone,
        UserStatus status,
        boolean enabled,
        boolean emailVerified,
        boolean phoneVerified,
        Instant createdAt
) {
}
