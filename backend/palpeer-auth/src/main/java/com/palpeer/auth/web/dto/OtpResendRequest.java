package com.palpeer.auth.web.dto;

import com.palpeer.auth.domain.OtpChannel;
import com.palpeer.auth.domain.OtpPurpose;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record OtpResendRequest(
        @NotBlank String email,
        @NotNull OtpPurpose purpose,
        @NotNull OtpChannel channel
) {
}
