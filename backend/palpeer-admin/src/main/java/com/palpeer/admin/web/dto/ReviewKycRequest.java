package com.palpeer.admin.web.dto;

import com.palpeer.kyc.domain.KycStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReviewKycRequest(
        @NotNull KycStatus status,
        @Size(max = 500) String rejectionReason
) {
}
