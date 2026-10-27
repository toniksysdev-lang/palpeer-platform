package com.palpeer.admin.web.dto;

import java.time.Instant;
import java.util.List;

public record AdminMfaEnableResponse(
        boolean enabled, Instant enabledAt, List<String> recoveryCodes, int recoveryCodesRemaining) {}
