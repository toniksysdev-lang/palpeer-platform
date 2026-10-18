package com.palpeer.common.mail;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Slf4j
@Component
@ConditionalOnMissingBean(EmailSender.class)
@RequiredArgsConstructor
public class SmtpEmailSender implements EmailSender {

    private final JavaMailSender mailSender;
    private final PalpeerMailProperties properties;
    private final MailProperties mailProperties;

    @Override
    public void send(String to, String subject, String textBody, String htmlBody) {
        if (!StringUtils.hasText(mailProperties.getHost())
                || !StringUtils.hasText(mailProperties.getUsername())
                || !StringUtils.hasText(mailProperties.getPassword())) {
            throw new IllegalStateException(
                    "SMTP is not configured. Set PALPEER_SMTP_HOST, PALPEER_SMTP_USERNAME, and PALPEER_SMTP_PASSWORD.");
        }
        try {
            boolean hasHtml = StringUtils.hasText(htmlBody);
            MimeMessage message = mailSender.createMimeMessage();
            // MIXED_RELATED builds a proper multipart/alternative (text + HTML) that clients prefer.
            MimeMessageHelper helper =
                    new MimeMessageHelper(
                            message,
                            hasHtml
                                    ? MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED
                                    : MimeMessageHelper.MULTIPART_MODE_NO,
                            StandardCharsets.UTF_8.name());
            String fromEmail = properties.getFrom();
            String fromName = properties.getFromName();
            helper.setFrom(new InternetAddress(fromEmail, fromName, StandardCharsets.UTF_8.name()));
            if (properties.getHeaderFrom() != null && !properties.getHeaderFrom().isBlank()) {
                message.setHeader("Sender", properties.getHeaderFrom().trim());
            }
            helper.setTo(to);
            helper.setSubject(subject);
            if (hasHtml) {
                helper.setText(textBody == null ? "" : textBody, htmlBody);
                ClassPathResource logo = new ClassPathResource("mail/palpeer-logo.png");
                if (logo.exists()) {
                    helper.addInline(EmailBrand.LOGO_CONTENT_ID, logo, "image/png");
                } else {
                    log.warn("Email logo missing on classpath (mail/palpeer-logo.png); HTML will show broken image");
                }
            } else {
                helper.setText(textBody == null ? "" : textBody, false);
            }
            mailSender.send(message);
            log.info(
                    "Email sent to={} subject={} html={} htmlChars={} via {}:{}",
                    to,
                    subject,
                    hasHtml,
                    hasHtml ? htmlBody.length() : 0,
                    mailProperties.getHost(),
                    mailProperties.getPort());
        } catch (MessagingException | UnsupportedEncodingException | MailException ex) {
            log.error(
                    "Failed to send email to={} subject={} from={} smtp={}:{}: {}",
                    to,
                    subject,
                    properties.getFrom(),
                    mailProperties.getHost(),
                    mailProperties.getPort(),
                    ex.getMessage(),
                    ex);
            throw new IllegalStateException("Email delivery failed: " + ex.getMessage(), ex);
        }
    }
}
