package com.palpeer.auth.otp;

import com.palpeer.auth.domain.OtpChannel;
import com.palpeer.auth.domain.OtpPurpose;
import com.palpeer.common.mail.EmailSender;
import com.palpeer.common.mail.PalpeerEmailTemplates;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Delivers OTP codes: EMAIL via branded SMTP HTML templates; SMS remains a placeholder.
 */
@Slf4j
@Component
public class LoggingOtpSender implements OtpSender {

    private final boolean logCode;
    private final EmailSender emailSender;

    public LoggingOtpSender(
            @Value("${palpeer.security.otp.log-code:false}") boolean logCode,
            EmailSender emailSender) {
        this.logCode = logCode;
        this.emailSender = emailSender;
    }

    @Override
    public void send(OtpChannel channel, String destination, OtpPurpose purpose, String code) {
        // Log before delivery so the code is always available when SMTP is blocked.
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
            log.info("OTP SMS placeholder [destination={}, purpose={}]", destination, purpose);
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
            // Free hosts (e.g. Render) often block outbound SMTP (connect timeout on :587/:465).
            // Soft-fail so registration can continue; the OTP is still stored and returned as
            // debugOtp when log-code is enabled (see AuthService / render.yaml OTP_LOG_CODE).
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
