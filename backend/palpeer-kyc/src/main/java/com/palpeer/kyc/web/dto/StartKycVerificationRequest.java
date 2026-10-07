package com.palpeer.kyc.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Starts ComplyCube verification using previously uploaded document/selfie.
 * firstName/lastName required by ComplyCube client API (profile catalog still P2-01).
 */
public record StartKycVerificationRequest(
        @NotBlank @Size(max = 80) String firstName,
        @NotBlank @Size(max = 80) String lastName,
        @Size(max = 10) String dateOfBirth,
        @Size(min = 2, max = 2) String issuingCountry
) {
}
