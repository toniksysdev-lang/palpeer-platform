package com.palpeer.admin.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AdminMfaCodeRequest(
        @NotBlank @Pattern(regexp = "\\d{6}", message = "Code must be 6 digits") String code) {}
