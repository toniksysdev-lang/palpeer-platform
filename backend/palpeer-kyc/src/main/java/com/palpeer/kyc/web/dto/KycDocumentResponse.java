package com.palpeer.kyc.web.dto;

import java.util.UUID;

public record KycDocumentResponse(
        UUID id,
        UUID kycCaseId,
        String documentType,
        String contentType,
        String originalFilename,
        long sizeBytes
) {
}
