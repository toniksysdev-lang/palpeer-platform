package com.palpeer.auth.domain;

/**
 * OTP purpose.
 *
 * CONTRACT_PENDING: which flows require OTP was not fully specified.
 * EMAIL_VERIFICATION / PHONE_VERIFICATION / PASSWORD_RESET are provisional
 * to support the verified endpoints (OTP, resend OTP, password reset).
 */
public enum OtpPurpose {
    EMAIL_VERIFICATION,
    PHONE_VERIFICATION,
    PASSWORD_RESET
}
