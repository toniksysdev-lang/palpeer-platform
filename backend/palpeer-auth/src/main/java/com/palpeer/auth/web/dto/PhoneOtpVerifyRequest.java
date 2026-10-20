package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PhoneOtpVerifyRequest(
        @NotBlank @Size(max = 32) String phone, @NotBlank @Size(min = 4, max = 12) String code) {}
