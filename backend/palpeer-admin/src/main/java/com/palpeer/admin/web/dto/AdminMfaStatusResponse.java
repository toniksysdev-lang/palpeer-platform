package com.palpeer.admin.web.dto;

import java.time.Instant;

public record AdminMfaStatusResponse(
        boolean enabled, Instant enabledAt, int recoveryCodesRemaining, boolean enrollmentRequired) {}
