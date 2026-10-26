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
        // Title case subjects — ALL-CAPS subjects are a common spam-filter signal.
        String subject = "Verify your Palpeer email";

        String html = EmailLayout.wrap(
                "Your Palpeer verification code is " + code,
                subject,
                EmailLayout.heading("Confirm your email")
                        + EmailLayout.paragraph(
                                "Thanks for signing up for Palpeer. Enter this one-time code in the"
                                        + " app to verify your email and finish creating your"
                                        + " account.")
                        + EmailLayout.otpCodeBox(code)
                        + EmailLayout.paragraph(
                                "The code expires in 10 minutes. For your security, don’t share it"
                                        + " with anyone.")
                        + EmailLayout.mutedNote(
                                "If you didn’t create a Palpeer account, you can safely ignore this"
                                        + " email.")
                        + EmailLayout.primaryButton(EmailBrand.APP_OPEN_CTA, EmailBrand.APP_OPEN_URL));

        String text =
                """
                Palpeer — Verify your email

                Thanks for signing up. Enter this code in the app to verify your email:

                %s

                This code expires in 10 minutes. If you did not create a Palpeer account, ignore this email.

                %s
                """
                        .formatted(code, EmailBrand.APP_OPEN_URL);

        return new RenderedEmail(subject, html, text);
    }

    public static RenderedEmail otp(String purposeLabel, String code) {
        String normalized = purposeLabel == null ? "" : purposeLabel.toLowerCase();
        if (normalized.equals("email verification")) {
            return emailVerification(code);
        }

        String subject = switch (normalized) {
            case "password reset" -> "Reset your Palpeer password";
            default -> "Your Palpeer verification code";
        };

        String html = EmailLayout.wrap(
                "Your Palpeer code is " + code,
                subject,
                EmailLayout.heading(subject)
                        + EmailLayout.paragraph(
                                "Use this one-time code to complete your "
                                        + purposeLabel
                                        + ". It expires in 10 minutes.")
                        + EmailLayout.otpCodeBox(code)
                        + EmailLayout.mutedNote(
                                "If you didn’t request this, you can safely ignore this email.")
                        + EmailLayout.primaryButton(EmailBrand.APP_OPEN_CTA, EmailBrand.APP_OPEN_URL));

        String text =
                """
                Palpeer — %s

                Your %s code is: %s

                This code expires in 10 minutes. If you did not request it, ignore this email.

                %s
                """
                        .formatted(subject, purposeLabel, code, EmailBrand.APP_OPEN_URL);

        return new RenderedEmail(subject, html, text);
    }

    public static RenderedEmail welcome(String email) {
        String subject = "Welcome to Palpeer";
        String safeEmail = email == null || email.isBlank() ? "your account" : email.trim();

        String html = EmailLayout.wrap(
                "Welcome to Palpeer — " + EmailBrand.TAGLINE,
                subject,
                EmailLayout.heading("Welcome to Palpeer")
                        + EmailLayout.paragraph(
                                "Thanks for joining. You're signed up as "
                                        + safeEmail
                                        + ".")
                        + EmailLayout.paragraph(
                                "Negotiate competitive P2P rates with verified peers, or settle instantly with InstantEX — "
                                        + EmailBrand.TAGLINE
                                        + ", instantly.")
                        + EmailLayout.primaryButton(EmailBrand.APP_OPEN_CTA, EmailBrand.APP_OPEN_URL)
                        + EmailLayout.mutedNote(
                                "Need a hand getting started? Reply to this email or write "
                                        + EmailBrand.SUPPORT_EMAIL
                                        + "."));

        String text =
                """
                Palpeer — Welcome

                Thanks for joining. You're signed up as %s.

                Negotiate competitive P2P rates with verified peers, or settle instantly with InstantEX — %s, instantly.

                %s

                Support: %s
                """
                        .formatted(
                                safeEmail,
                                EmailBrand.TAGLINE,
                                EmailBrand.APP_OPEN_URL,
                                EmailBrand.SUPPORT_EMAIL);

        return new RenderedEmail(subject, html, text);
    }

    /**
     * New-device sign-in alert. Warns that if this was them they can ignore it; otherwise contact
     * support or use the account-lock link (opaque path key only — never password/PIN or API
     * query params in the URL).
     */
    public static RenderedEmail newDeviceLogin(
            String email,
            String deviceLabel,
            String whenLabel,
            String suspendUrl,
            String supportEmail) {
        String subject = "New device signed in to your Palpeer account";
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
                Palpeer — New device sign-in

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
        inner.append(EmailLayout.heading(title == null ? "Palpeer" : title));
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
            inner.append(EmailLayout.primaryButton(EmailBrand.APP_OPEN_CTA, EmailBrand.APP_OPEN_URL));
        }
        inner.append(EmailLayout.mutedNote(EmailBrand.TAGLINE + " — instantly."));

        String safeTitle = title == null || title.isBlank() ? "Palpeer notification" : title;
        String html = EmailLayout.wrap(safeTitle, safeTitle, inner.toString());
        String text =
                """
                Palpeer

                %s

                %s

                %s
                """
                        .formatted(
                                safeTitle,
                                body == null ? "" : body,
                                ctaUrl == null || ctaUrl.isBlank() ? EmailBrand.APP_OPEN_URL : ctaUrl);

        return new RenderedEmail(safeTitle, html, text);
    }

    /**
     * Wallet funding update (initiated / awaiting payment / credited / failed / reversed).
     */
    public static RenderedEmail walletFunding(String title, String body) {
        return walletMovement("Wallet funding", title, body, "Open Palpeer wallet");
    }

    /**
     * Wallet withdrawal update (initiated / sent / failed / reversed).
     */
    public static RenderedEmail walletWithdrawal(String title, String body) {
        return walletMovement("Wallet withdrawal", title, body, "Open Palpeer wallet");
    }

    private static RenderedEmail walletMovement(
            String kindLabel, String title, String body, String ctaLabel) {
        String safeTitle = title == null || title.isBlank() ? kindLabel : title.trim();
        String subject = "Palpeer — " + safeTitle;

        StringBuilder inner = new StringBuilder();
        inner.append(EmailLayout.heading(safeTitle));
        inner.append(EmailLayout.paragraph(
                kindLabel
                        + " update on your Palpeer account. Details are below — open the app for the"
                        + " latest status."));
        if (body != null && !body.isBlank()) {
            for (String paragraph : body.split("\\n\\n")) {
                String trimmed = paragraph.trim();
                if (!trimmed.isEmpty()) {
                    inner.append(EmailLayout.paragraph(trimmed.replace('\n', ' ')));
                }
            }
        }
        inner.append(EmailLayout.primaryButton(ctaLabel, EmailBrand.APP_OPEN_URL));
        inner.append(EmailLayout.mutedNote(
                "If you did not request this movement, contact "
                        + EmailBrand.SUPPORT_EMAIL
                        + " right away."));

        String html = EmailLayout.wrap(subject, subject, inner.toString());
        String text =
                """
                Palpeer — %s

                %s

                %s

                If you did not request this, contact %s.

                %s
                """
                        .formatted(
                                safeTitle,
                                kindLabel + " update on your Palpeer account.",
                                body == null ? "" : body,
                                EmailBrand.SUPPORT_EMAIL,
                                EmailBrand.APP_OPEN_URL);

        return new RenderedEmail(subject, html, text);
    }
}
