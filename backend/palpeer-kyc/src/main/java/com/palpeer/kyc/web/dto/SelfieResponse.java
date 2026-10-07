package com.palpeer.kyc.web.dto;

import java.util.UUID;

public record SelfieResponse(
        UUID id,
        UUID kycCaseId,
        String contentType,
        String originalFilename,
        long sizeBytes
) {
}
