package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Email @Size(max = 320) String email,
        @NotBlank
                @Size(min = 3, max = 32)
                @Pattern(
                        regexp = "^[a-zA-Z0-9_]{3,32}$",
                        message = "Username must be 3–32 letters, numbers, or underscores")
                String username,
        @NotBlank @Size(max = 32) String phone,
        @NotBlank @Size(min = 8, max = 128) String password) {}
