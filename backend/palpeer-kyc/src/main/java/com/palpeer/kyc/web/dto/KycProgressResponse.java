package com.palpeer.kyc.web.dto;

import com.palpeer.kyc.domain.KycStatus;
import java.util.List;
import java.util.UUID;

/**
 * Fact-based progress checklist derived from uploaded artifacts and current status.
 * CONTRACT_PENDING (P2-03): weighted scoring / required document set not specified.
 */
public record KycProgressResponse(
        UUID caseId,
        KycStatus status,
        boolean hasDocument,
        long documentCount,
        boolean hasSelfie,
        long selfieCount,
        /** Distinct document types uploaded for this case (e.g. PASSPORT), newest first. */
        List<String> documentTypes
) {
}
