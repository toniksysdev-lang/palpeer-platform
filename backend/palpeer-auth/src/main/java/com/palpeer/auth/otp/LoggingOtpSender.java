package com.palpeer.auth.otp;

import com.palpeer.auth.domain.OtpChannel;
import com.palpeer.auth.domain.OtpPurpose;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.mail.EmailSender;
import com.palpeer.common.mail.PalpeerEmailTemplates;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
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
        if (channel == OtpChannel.EMAIL) {
            sendEmailOtp(destination, purpose, code);
        } else {
            log.info("OTP SMS placeholder [destination={}, purpose={}]", destination, purpose);
        }

        if (logCode) {
            log.warn(
                    "DEV OTP [channel={}, destination={}, purpose={}, code={}]",
                    channel,
                    destination,
                    purpose,
                    code);
        }
    }

    private void sendEmailOtp(String destination, OtpPurpose purpose, String code) {
        String purposeLabel = purpose.name().toLowerCase().replace('_', ' ');
        var rendered = PalpeerEmailTemplates.otp(purposeLabel, code);
        try {
            emailSender.send(destination, rendered.subject(), rendered.text(), rendered.html());
            log.info("OTP email sent [destination={}, purpose={}]", destination, purpose);
        } catch (RuntimeException ex) {
            log.error(
                    "OTP email failed [destination={}, purpose={}]: {}",
                    destination,
                    purpose,
                    ex.getMessage());
            throw new BusinessException(
                    "OTP_EMAIL_FAILED",
                    "Could not send the verification email. Check SMTP settings and try again.",
                    HttpStatus.BAD_GATEWAY,
                    ex);
        }
    }
}
