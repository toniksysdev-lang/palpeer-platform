package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record NewDeviceOtpVerifyRequest(
        @NotBlank
        @Pattern(regexp = "\\d{4,8}", message = "code must be 4–8 digits")
        String code
) {
}
