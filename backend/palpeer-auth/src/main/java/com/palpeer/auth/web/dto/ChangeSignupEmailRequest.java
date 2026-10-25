package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangeSignupEmailRequest(
        @NotBlank @Size(max = 32) String phone,
        @NotBlank @Email @Size(max = 320) String email) {}
