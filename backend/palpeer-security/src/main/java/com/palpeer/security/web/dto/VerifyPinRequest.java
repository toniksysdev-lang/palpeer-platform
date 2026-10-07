package com.palpeer.security.web.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyPinRequest(
        @NotBlank String pin
) {
}
