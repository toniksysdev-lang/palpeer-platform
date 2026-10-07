package com.palpeer.auth.otp;

import com.palpeer.auth.domain.OtpChannel;
import com.palpeer.auth.domain.OtpPurpose;

/**
 * Abstraction for OTP delivery.
 * EMAIL is sent over SMTP ({@code PALPEER_SMTP_*}); SMS provider is still pending.
 */
public interface OtpSender {

    void send(OtpChannel channel, String destination, OtpPurpose purpose, String code);
}
