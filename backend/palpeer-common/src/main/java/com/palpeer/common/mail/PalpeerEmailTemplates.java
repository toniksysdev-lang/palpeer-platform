package com.palpeer.common.mail;

/**
 * Beautiful dark-theme transactional templates matching palpeer.com.
 */
public final class PalpeerEmailTemplates {

    private PalpeerEmailTemplates() {}

    public record RenderedEmail(String subject, String html, String text) {}

    public static RenderedEmail otp(String purposeLabel, String code) {
        String subject = switch (purposeLabel.toLowerCase()) {
            case "email verification" -> "Verify your PALPEER email";
            case "password reset" -> "Reset your PALPEER password";
            default -> "Your PALPEER verification code";
        };

        String html = EmailLayout.wrap(
                "Your PALPEER code is " + code,
                subject,
                EmailLayout.heading(subject)
                        + EmailLayout.paragraph(
                                "Use this one-time code to complete your "
                                        + purposeLabel
                                        + ". It expires in 10 minutes.")
                        + EmailLayout.otpCodeBox(code)
                        + EmailLayout.mutedNote(
                                "If you didn’t request this, you can safely ignore this email.")
                        + EmailLayout.primaryButton("Open Palpeer", EmailBrand.SITE_URL));

        String text =
                """
                PALPEER — %s

                Your %s code is: %s

                This code expires in 10 minutes. If you did not request it, ignore this email.

                %s
                """
                        .formatted(subject, purposeLabel, code, EmailBrand.SITE_URL);

        return new RenderedEmail(subject, html, text);
    }

    public static RenderedEmail welcome(String email) {
        String subject = "Welcome to PALPEER";
        String safeEmail = email == null || email.isBlank() ? "your account" : email.trim();

        String html = EmailLayout.wrap(
                "Welcome to PALPEER — " + EmailBrand.TAGLINE,
                subject,
                EmailLayout.heading("Welcome to PALPEER")
                        + EmailLayout.paragraph(
                                "Thanks for joining. You're signed up as "
                                        + safeEmail
                                        + ".")
                        + EmailLayout.paragraph(
                                "Negotiate competitive P2P rates with verified peers, or settle instantly with InstantEX — "
                                        + EmailBrand.TAGLINE
                                        + ", instantly.")
                        + EmailLayout.primaryButton("Open Palpeer", EmailBrand.SITE_URL)
                        + EmailLayout.mutedNote(
                                "Need a hand getting started? Reply to this email or write "
                                        + EmailBrand.SUPPORT_EMAIL
                                        + "."));

        String text =
                """
                PALPEER — Welcome

                Thanks for joining. You're signed up as %s.

                Negotiate competitive P2P rates with verified peers, or settle instantly with InstantEX — %s, instantly.

                %s

                Support: %s
                """
                        .formatted(
                                safeEmail,
                                EmailBrand.TAGLINE,
                                EmailBrand.SITE_URL,
                                EmailBrand.SUPPORT_EMAIL);

        return new RenderedEmail(subject, html, text);
    }

    public static RenderedEmail notification(String title, String body) {
        return notification(title, body, null, null);
    }

    public static RenderedEmail notification(
            String title, String body, String ctaLabel, String ctaUrl) {
        StringBuilder inner = new StringBuilder();
        inner.append(EmailLayout.heading(title == null ? "PALPEER" : title));
        if (body != null && !body.isBlank()) {
            for (String paragraph : body.split("\\n\\n")) {
                String trimmed = paragraph.trim();
                if (!trimmed.isEmpty()) {
                    inner.append(EmailLayout.paragraph(trimmed.replace('\n', ' ')));
                }
            }
        }
        if (ctaLabel != null && ctaUrl != null && !ctaLabel.isBlank() && !ctaUrl.isBlank()) {
            inner.append(EmailLayout.primaryButton(ctaLabel, ctaUrl));
        } else {
            inner.append(EmailLayout.primaryButton("Open Palpeer", EmailBrand.SITE_URL));
        }
        inner.append(EmailLayout.mutedNote(EmailBrand.TAGLINE + " — instantly."));

        String safeTitle = title == null || title.isBlank() ? "PALPEER notification" : title;
        String html = EmailLayout.wrap(safeTitle, safeTitle, inner.toString());
        String text =
                """
                PALPEER

                %s

                %s

                %s
                """
                        .formatted(
                                safeTitle,
                                body == null ? "" : body,
                                ctaUrl == null || ctaUrl.isBlank() ? EmailBrand.SITE_URL : ctaUrl);

        return new RenderedEmail(safeTitle, html, text);
    }
}
