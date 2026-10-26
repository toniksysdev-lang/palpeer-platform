package com.palpeer.kyc.web.dto;

import com.palpeer.kyc.domain.KycStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Admin KYC case detail, including read-only ComplyCube provider metadata for live identity checks.
 */
public record AdminKycCaseDetailResponse(
        UUID caseId,
        UUID userId,
        KycStatus status,
        String rejectionReason,
        Instant createdAt,
        Instant updatedAt,
        String providerName,
        String providerClientId,
        String providerCheckId,
        /** {@code identity_check} when a live photo was submitted; otherwise null / document path. */
        String providerCheckType,
        String providerCheckStatus,
        String providerOutcome,
        String providerBreakdown,
        /** True when the case was submitted with a live photo for ComplyCube identity_check. */
        boolean liveIdentityCheck,
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
            Instant createdAt,
            /** True once the selfie was uploaded to ComplyCube as a live photo. */
            boolean linkedToProvider
    ) {
    }
}
