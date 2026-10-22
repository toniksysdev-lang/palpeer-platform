package com.palpeer.auth.web.dto;

/**
 * Public signup resume hint for a phone number.
 *
 * <p>{@code nextStep} values:
 * <ul>
 *   <li>{@code PHONE_OTP_REQUIRED} — no account; send/verify SMS then register</li>
 *   <li>{@code REGISTER_REQUIRED} — phone pre-verified; open create-account</li>
 *   <li>{@code EMAIL_OTP_REQUIRED} — account exists, email not verified yet</li>
 *   <li>{@code LOGIN_READY} — account can sign in (email verified, or already used)</li>
 *   <li>{@code BLOCKED} — disabled / suspended</li>
 * </ul>
 */
public record SignupStatusResponse(
        String nextStep,
        String phone,
        String email,
        String maskedEmail,
        boolean emailVerified,
        boolean phoneVerified,
        boolean hasLoggedIn,
        String status
) {
    public static final String PHONE_OTP_REQUIRED = "PHONE_OTP_REQUIRED";
    public static final String REGISTER_REQUIRED = "REGISTER_REQUIRED";
    public static final String EMAIL_OTP_REQUIRED = "EMAIL_OTP_REQUIRED";
    public static final String LOGIN_READY = "LOGIN_READY";
    public static final String BLOCKED = "BLOCKED";
}
