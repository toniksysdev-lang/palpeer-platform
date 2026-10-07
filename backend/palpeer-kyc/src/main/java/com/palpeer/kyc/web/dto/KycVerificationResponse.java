package com.palpeer.kyc.web.dto;

import com.palpeer.kyc.domain.KycStatus;
import java.util.UUID;

public record KycVerificationResponse(
        UUID caseId,
        KycStatus status,
        String providerName,
        String providerClientId,
        String providerCheckId
) {
}
