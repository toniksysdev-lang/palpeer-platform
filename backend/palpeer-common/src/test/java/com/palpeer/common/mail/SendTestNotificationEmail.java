package com.palpeer.common.mail;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * One-shot helper (disabled unless {@code -Dpalpeer.test.email=...} is set):
 *
 * <pre>
 * mvn -pl palpeer-common -Dtest=SendTestNotificationEmail#send \
 *   -Dpalpeer.test.email=you@example.com test
 * </pre>
 *
 * <p>Sends a real notification email via SendPulse using env credentials (same as the API).
 */
class SendTestNotificationEmail {

    @Test
    @EnabledIfSystemProperty(named = "palpeer.test.email", matches = ".+")
    void send() {
        String to = System.getProperty("palpeer.test.email", System.getenv("PALPEER_TEST_EMAIL"));
        if (to == null || to.isBlank()) {
            throw new IllegalStateException(
                    "Set -Dpalpeer.test.email=... or PALPEER_TEST_EMAIL");
        }

        SendPulseMailProperties sendPulse = new SendPulseMailProperties();
        sendPulse.setEnabled(true);
        sendPulse.setClientId(requiredEnv("PALPEER_SENDPULSE_CLIENT_ID"));
        sendPulse.setClientSecret(requiredEnv("PALPEER_SENDPULSE_CLIENT_SECRET"));
        String base = System.getenv("PALPEER_SENDPULSE_BASE_URL");
        if (base != null && !base.isBlank()) {
            sendPulse.setBaseUrl(base.trim());
        }

        PalpeerMailProperties mail = new PalpeerMailProperties();
        mail.setFrom(envOr("PALPEER_MAIL_FROM", "noreply@palpeer.com"));
        mail.setFromName(envOr("PALPEER_MAIL_FROM_NAME", "Palpeer"));
        mail.setHeaderFrom(envOr("PALPEER_MAIL_HEADER_FROM", "support@palpeer.com"));

        var rendered =
                PalpeerEmailTemplates.notification(
                        "Open Palpeer App — link check",
                        "Tap Open Palpeer App below. On iPhone and Android it should open the"
                                + " installed Palpeer app (not the website).\n\n"
                                + "Deep link: "
                                + EmailBrand.APP_OPEN_URL);

        new SendPulseEmailSender(sendPulse, mail)
                .send(to.trim(), rendered.subject(), rendered.text(), rendered.html());

        System.out.println(
                "Sent to "
                        + to
                        + " CTA="
                        + EmailBrand.APP_OPEN_CTA
                        + " href="
                        + EmailBrand.APP_OPEN_URL);
    }

    private static String requiredEnv(String key) {
        String v = System.getenv(key);
        if (v == null || v.isBlank()) {
            throw new IllegalStateException("Missing env " + key);
        }
        return v.trim();
    }

    private static String envOr(String key, String fallback) {
        String v = System.getenv(key);
        return v == null || v.isBlank() ? fallback : v.trim();
    }
}
