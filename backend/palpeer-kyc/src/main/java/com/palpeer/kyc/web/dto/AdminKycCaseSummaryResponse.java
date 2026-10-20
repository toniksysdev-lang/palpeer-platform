package com.palpeer.kyc.web.dto;

import com.palpeer.kyc.domain.KycStatus;
import java.time.Instant;
import java.util.UUID;

/** Admin KYC list row with user identity fields for ops consoles. */
public record AdminKycCaseSummaryResponse(
        UUID caseId,
        UUID userId,
        String email,
        String fullName,
        KycStatus status,
        String rejectionReason,
        Instant createdAt,
        Instant updatedAt
) {
}
