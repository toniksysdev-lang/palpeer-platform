package com.palpeer.common.mail;

/**
 * Beautiful dark-theme transactional templates matching palpeer.com.
 */
public final class PalpeerEmailTemplates {

    private PalpeerEmailTemplates() {}

    public record RenderedEmail(String subject, String html, String text) {}

    /**
     * Registration email-verification OTP — branded shell from {@link EmailLayout} /
     * {@link EmailBrand}.
     */
    public static RenderedEmail emailVerification(String code) {
        String subject = "Verify your PALPEER email";

        String html = EmailLayout.wrap(
                "Your PALPEER verification code is " + code,
                subject,
                EmailLayout.heading("Confirm your email")
                        + EmailLayout.paragraph(
                                "Thanks for signing up for PALPEER. Enter this one-time code in the"
                                        + " app to verify your email and finish creating your"
                                        + " account.")
                        + EmailLayout.otpCodeBox(code)
                        + EmailLayout.paragraph(
                                "The code expires in 10 minutes. For your security, don’t share it"
                                        + " with anyone.")
                        + EmailLayout.mutedNote(
                                "If you didn’t create a PALPEER account, you can safely ignore this"
                                        + " email.")
                        + EmailLayout.primaryButton("Open Palpeer", EmailBrand.SITE_URL));

        String text =
                """
                PALPEER — Verify your email

                Thanks for signing up. Enter this code in the app to verify your email:

                %s

                This code expires in 10 minutes. If you did not create a PALPEER account, ignore this email.

                %s
                """
                        .formatted(code, EmailBrand.SITE_URL);

        return new RenderedEmail(subject, html, text);
    }

    public static RenderedEmail otp(String purposeLabel, String code) {
        String normalized = purposeLabel == null ? "" : purposeLabel.toLowerCase();
        if (normalized.equals("email verification")) {
            return emailVerification(code);
        }

        String subject = switch (normalized) {
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

    /**
     * New-device sign-in alert. Warns that if this was them they can ignore it; otherwise contact
     * support or use the suspend link (token only — never password/PIN in the URL).
     */
    public static RenderedEmail newDeviceLogin(
            String email,
            String deviceLabel,
            String whenLabel,
            String suspendUrl,
            String supportEmail) {
        String subject = "New device signed in to your PALPEER account";
        String safeEmail = email == null || email.isBlank() ? "your account" : email.trim();
        String device = deviceLabel == null || deviceLabel.isBlank() ? "a new device" : deviceLabel.trim();
        String when = whenLabel == null || whenLabel.isBlank() ? "just now" : whenLabel.trim();
        String support =
                supportEmail == null || supportEmail.isBlank()
                        ? EmailBrand.SUPPORT_EMAIL
                        : supportEmail.trim();

        String html = EmailLayout.wrap(
                subject,
                subject,
                EmailLayout.heading("New device sign-in")
                        + EmailLayout.paragraph(
                                "Someone just signed in to "
                                        + safeEmail
                                        + " from "
                                        + device
                                        + " ("
                                        + when
                                        + "). For your security, that sign-in ends any other open"
                                        + " sessions on your account.")
                        + EmailLayout.paragraph(
                                "If this was you, you can ignore this email — no further action is"
                                        + " needed.")
                        + EmailLayout.paragraph(
                                "If this was not you, contact support immediately at "
                                        + support
                                        + ", or suspend the account now. You will be asked for your"
                                        + " email, password, and PIN to confirm. Never share those"
                                        + " secrets in email or chat.")
                        + EmailLayout.primaryButton("Suspend my account", suspendUrl)
                        + EmailLayout.mutedNote(
                                "This suspend link expires in 24 hours and can be used once."));

        String text =
                """
                PALPEER — New device sign-in

                Someone signed in to %s from %s (%s). Other sessions on your account were ended.

                If this was you, ignore this email.

                If this was not you, contact %s immediately, or open this one-time link to suspend
                your account (you will confirm with email, password, and PIN — those are never in
                the link itself):

                %s

                The link expires in 24 hours.
                """
                        .formatted(safeEmail, device, when, support, suspendUrl);

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
