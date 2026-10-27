package com.palpeer.admin.web.dto;

import jakarta.validation.constraints.NotBlank;

public record AdminMfaDisableRequest(
        @NotBlank String password,
        /** 6-digit TOTP or a recovery code. */
        @NotBlank String code) {}
