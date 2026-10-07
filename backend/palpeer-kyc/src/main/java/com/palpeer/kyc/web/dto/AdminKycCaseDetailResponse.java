package com.palpeer.kyc.web.dto;

import com.palpeer.kyc.domain.KycStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Admin KYC case detail. Storage keys and provider ids are intentionally omitted.
 */
public record AdminKycCaseDetailResponse(
        UUID caseId,
        UUID userId,
        KycStatus status,
        String rejectionReason,
        Instant createdAt,
        Instant updatedAt,
        List<Document> documents,
        Selfie selfie
) {

    public record Document(
            UUID id,
            String documentType,
            String contentType,
            String originalFilename,
            long sizeBytes,
            Instant createdAt
    ) {
    }

    public record Selfie(
            UUID id,
            String contentType,
            String originalFilename,
            long sizeBytes,
            Instant createdAt
    ) {
    }
}
