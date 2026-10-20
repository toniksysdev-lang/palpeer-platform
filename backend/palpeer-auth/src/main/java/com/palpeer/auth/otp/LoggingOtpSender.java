package com.palpeer.auth.otp;

import com.palpeer.auth.domain.OtpChannel;
import com.palpeer.auth.domain.OtpPurpose;
import com.palpeer.common.mail.EmailSender;
import com.palpeer.common.mail.PalpeerEmailTemplates;
import com.palpeer.common.sms.SmsSender;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Delivers OTP codes: EMAIL via branded templates; SMS via {@link SmsSender}
 * (Telnyx / Twilio / BulkSMS when configured, else logging fallback).
 */
@Slf4j
@Component
public class LoggingOtpSender implements OtpSender {

    private final boolean logCode;
    private final EmailSender emailSender;
    private final SmsSender smsSender;

    public LoggingOtpSender(
            @Value("${palpeer.security.otp.log-code:false}") boolean logCode,
            EmailSender emailSender,
            SmsSender smsSender) {
        this.logCode = logCode;
        this.emailSender = emailSender;
        this.smsSender = smsSender;
    }

    @Override
    public void send(OtpChannel channel, String destination, OtpPurpose purpose, String code) {
        if (logCode) {
            log.warn(
                    "DEV OTP [channel={}, destination={}, purpose={}, code={}]",
                    channel,
                    destination,
                    purpose,
                    code);
        }

        if (channel == OtpChannel.EMAIL) {
            sendEmailOtp(destination, purpose, code);
        } else {
            sendSmsOtp(destination, purpose, code);
        }
    }

    private void sendSmsOtp(String destination, OtpPurpose purpose, String code) {
        String body = "PALPEER verification code: "
                + code
                + ". It expires in 10 minutes. Do not share this code.";
        try {
            smsSender.send(destination, body);
            log.info("OTP SMS sent [destination={}, purpose={}]", destination, purpose);
        } catch (RuntimeException ex) {
            log.error(
                    "OTP SMS failed [destination={}, purpose={}]: {} — continuing without SMS",
                    destination,
                    purpose,
                    ex.getMessage());
            if (!logCode) {
                log.warn(
                        "Set OTP_LOG_CODE=true so clients receive debugOtp while SMS is unavailable"
                                + " [destination={}, purpose={}]",
                        destination,
                        purpose);
            }
        }
    }

    private void sendEmailOtp(String destination, OtpPurpose purpose, String code) {
        var rendered =
                purpose == OtpPurpose.EMAIL_VERIFICATION
                        ? PalpeerEmailTemplates.emailVerification(code)
                        : PalpeerEmailTemplates.otp(
                                purpose.name().toLowerCase().replace('_', ' '), code);
        try {
            emailSender.send(destination, rendered.subject(), rendered.text(), rendered.html());
            log.info(
                    "OTP email sent [destination={}, purpose={}, subject={}, htmlChars={}]",
                    destination,
                    purpose,
                    rendered.subject(),
                    rendered.html() == null ? 0 : rendered.html().length());
        } catch (RuntimeException ex) {
            log.error(
                    "OTP email failed [destination={}, purpose={}]: {} — continuing without email",
                    destination,
                    purpose,
                    ex.getMessage());
            if (!logCode) {
                log.warn(
                        "Set OTP_LOG_CODE=true so clients receive debugOtp while SMTP is unavailable"
                                + " [destination={}, purpose={}]",
                        destination,
                        purpose);
            }
        }
    }
}
