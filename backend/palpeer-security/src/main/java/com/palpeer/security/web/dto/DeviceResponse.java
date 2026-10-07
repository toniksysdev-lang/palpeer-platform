package com.palpeer.security.web.dto;

import java.time.Instant;
import java.util.UUID;

public record DeviceResponse(
        UUID id,
        String deviceIdentifier,
        String platform,
        String deviceName,
        boolean enabled,
        Instant lastUsedAt
) {
}
