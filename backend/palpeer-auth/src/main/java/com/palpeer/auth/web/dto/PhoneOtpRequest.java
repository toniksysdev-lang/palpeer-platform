package com.palpeer.auth.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PhoneOtpRequest(@NotBlank @Size(max = 32) String phone) {}
