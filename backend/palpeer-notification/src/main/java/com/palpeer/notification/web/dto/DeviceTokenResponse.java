package com.palpeer.notification.web.dto;

import com.palpeer.notification.domain.DeviceTokenPlatform;
import java.time.Instant;
import java.util.UUID;

public record DeviceTokenResponse(
        UUID id,
        DeviceTokenPlatform platform,
        String deviceIdentifier,
        boolean enabled,
        Instant lastSeenAt,
        Instant createdAt,
        Instant updatedAt
) {
}
