package com.palpeer.kyc.web.dto;

import com.palpeer.kyc.domain.KycStatus;
import java.time.Instant;
import java.util.UUID;

public record KycStatusResponse(
        UUID caseId,
        UUID userId,
        KycStatus status,
        String rejectionReason,
        Instant createdAt,
        Instant updatedAt
) {
}
