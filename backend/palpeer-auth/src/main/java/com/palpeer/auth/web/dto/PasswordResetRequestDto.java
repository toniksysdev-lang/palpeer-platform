package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record PasswordResetRequestDto(
        @NotBlank @Email String email
) {
}
