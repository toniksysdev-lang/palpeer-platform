package com.palpeer.auth.web.dto;

/**
 * @param debugOtp Present only when {@code palpeer.security.otp.log-code} is true.
 */
public record OtpResendResponse(String debugOtp) {
}
