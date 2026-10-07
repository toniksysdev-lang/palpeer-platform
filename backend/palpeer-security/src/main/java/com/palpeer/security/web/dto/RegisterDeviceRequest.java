package com.palpeer.security.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterDeviceRequest(
        @NotBlank @Size(max = 255) String deviceIdentifier,
        @Size(max = 40) String platform,
        @Size(max = 120) String deviceName,
        @NotBlank @Size(max = 2000) String biometricCredential
) {
}
