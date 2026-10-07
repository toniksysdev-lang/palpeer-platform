package com.palpeer.security.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ChangePinRequest(
        @NotBlank String currentPin,
        @NotBlank
        @Pattern(regexp = "\\d{4,8}", message = "PIN must be 4-8 digits (provisional P3-01)")
        String newPin
) {
}
