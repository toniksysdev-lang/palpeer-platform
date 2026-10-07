package com.palpeer.promotion.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ApplyReferralRequest(
        @NotBlank @Size(max = 40) String referralCode
) {
}
