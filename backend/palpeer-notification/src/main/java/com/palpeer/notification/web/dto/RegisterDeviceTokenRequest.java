package com.palpeer.notification.web.dto;

import com.palpeer.notification.domain.DeviceTokenPlatform;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RegisterDeviceTokenRequest(
        @NotBlank @Size(max = 512) String token,
        @NotNull DeviceTokenPlatform platform,
        @Size(max = 255) String deviceIdentifier
) {
}
