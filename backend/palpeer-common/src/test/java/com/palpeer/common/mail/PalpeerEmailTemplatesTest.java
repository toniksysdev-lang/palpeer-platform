package com.palpeer.common.mail;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class PalpeerEmailTemplatesTest {

    @Test
    void emailVerificationTemplateUsesBrandLayoutAndRegistrationCopy() {
        var email = PalpeerEmailTemplates.emailVerification("517200");

        assertTrue(email.subject().toLowerCase().contains("verify"));
        assertTrue(email.html().contains("Confirm your email"));
        assertTrue(email.html().contains("finish creating your account"));
        assertTrue(email.html().contains(EmailBrand.BG));
        assertTrue(email.html().contains(EmailBrand.PRIMARY));
        assertTrue(email.html().contains("517200"));
        assertTrue(email.html().contains(EmailBrand.LOGO_CID_SRC));
        assertTrue(email.html().contains("alt=\"Palpeer\""));
        assertTrue(email.subject().contains("Palpeer"));
        assertFalse(email.subject().equals(email.subject().toUpperCase()));
        assertTrue(email.text().contains("517200"));
        assertTrue(email.text().toLowerCase().contains("signing up"));
        assertFalse(email.html().contains("<script"));
    }

    @Test
    void otpEmailVerificationDelegatesToRegistrationTemplate() {
        var viaOtp = PalpeerEmailTemplates.otp("email verification", "517200");
        var direct = PalpeerEmailTemplates.emailVerification("517200");

        assertTrue(viaOtp.subject().equals(direct.subject()));
        assertTrue(viaOtp.html().equals(direct.html()));
        assertTrue(viaOtp.text().equals(direct.text()));
    }

    @Test
    void otpTemplateUsesBrandColorsAndEscapesCode() {
        var email = PalpeerEmailTemplates.otp("password reset", "517200");

        assertTrue(email.subject().toLowerCase().contains("reset"));
        assertTrue(email.html().contains(EmailBrand.BG));
        assertTrue(email.html().contains(EmailBrand.PRIMARY));
        assertTrue(email.html().contains("517200"));
        assertTrue(email.html().contains(EmailBrand.LOGO_CID_SRC));
        assertTrue(email.text().contains("517200"));
        assertFalse(email.html().contains("<script"));
    }

    @Test
    void notificationTemplateEscapesUserContent() {
        var email = PalpeerEmailTemplates.notification(
                "Funds arrived", "You received <b>100</b> CAD.\n\nThanks for using Palpeer.");

        assertTrue(email.html().contains("Funds arrived"));
        assertTrue(email.html().contains("&lt;b&gt;100&lt;/b&gt;"));
        assertTrue(email.html().contains(EmailBrand.PRIMARY));
        assertTrue(email.html().contains(EmailBrand.LOGO_CID_SRC));
        assertTrue(email.text().contains("You received <b>100</b> CAD."));
    }

    @Test
    void openAppCtaUsesHttpsBridgeNotCustomScheme() {
        var email = PalpeerEmailTemplates.notification("Hi", "Body");

        assertTrue(email.html().contains(EmailBrand.APP_OPEN_CTA));
        assertTrue(EmailBrand.APP_OPEN_URL.startsWith("https://"));
        assertTrue(email.html().contains("href=\"" + EmailBrand.APP_OPEN_URL + "\""));
        assertTrue(email.text().contains(EmailBrand.APP_OPEN_URL));
        // Gmail/Outlook disable custom-scheme hrefs — must not be the button target.
        assertFalse(email.html().contains("href=\"palpeer://"));
        assertFalse(email.html().contains(">Open Palpeer\n"));
    }

    @Test
    void walletFundingTemplateUsesDedicatedSubjectAndEscapesBody() {
        var email = PalpeerEmailTemplates.walletFunding(
                "Funding successful", "Your funding of <b>50</b> CAD has been credited.");

        assertTrue(email.subject().startsWith("Palpeer — "));
        assertTrue(email.subject().contains("Funding successful"));
        assertTrue(email.html().contains("Wallet funding"));
        assertTrue(email.html().contains("&lt;b&gt;50&lt;/b&gt;"));
        assertTrue(email.html().contains(EmailBrand.SUPPORT_EMAIL));
        assertTrue(email.text().contains("Funding successful"));
    }

    @Test
    void walletWithdrawalTemplateUsesDedicatedSubject() {
        var email = PalpeerEmailTemplates.walletWithdrawal(
                "Withdrawal initiated", "Your withdrawal of 100 NGN is pending.");

        assertTrue(email.subject().contains("Withdrawal initiated"));
        assertTrue(email.html().contains("Wallet withdrawal"));
        assertTrue(email.html().contains("100 NGN"));
        assertTrue(email.text().contains("pending"));
    }

    @Test
    void welcomeTemplateUsesBrandAndIncludesEmail() {
        var email = PalpeerEmailTemplates.welcome("new.user@example.com");

        assertTrue(email.subject().toLowerCase().contains("welcome"));
        assertTrue(email.html().contains("Welcome to Palpeer"));
        assertTrue(email.html().contains("new.user@example.com"));
        assertTrue(email.html().contains(EmailBrand.PRIMARY));
        assertTrue(email.html().contains(EmailBrand.BG));
        assertTrue(email.html().contains(EmailBrand.LOGO_CID_SRC));
        assertTrue(email.text().contains("new.user@example.com"));
    }

    @Test
    void newDeviceLoginWarnsAndIncludesSuspendLinkWithoutSecrets() {
        var email = PalpeerEmailTemplates.newDeviceLogin(
                "user@example.com",
                "Pixel 8 · android",
                "2026-10-18 10:00 UTC",
                "https://api.example.com/secure/account-lock/abc123",
                "support@palpeer.com");

        assertTrue(email.subject().toLowerCase().contains("new device"));
        assertTrue(email.html().contains("If this was you"));
        assertTrue(email.html().contains("Suspend my account"));
        assertTrue(email.html().contains("/secure/account-lock/abc123"));
        assertFalse(email.html().contains("/api/v1/"));
        assertFalse(email.html().contains("?token="));
        assertTrue(email.html().contains("support@palpeer.com"));
        assertFalse(email.html().toLowerCase().contains("password="));
        assertFalse(email.text().toLowerCase().contains("pin="));
    }

    @Test
    void allTemplatesIncludeHeaderLogo() {
        assertTrue(PalpeerEmailTemplates.emailVerification("1").html().contains(EmailBrand.LOGO_CID_SRC));
        assertTrue(PalpeerEmailTemplates.otp("password reset", "2").html().contains(EmailBrand.LOGO_CID_SRC));
        assertTrue(PalpeerEmailTemplates.welcome("a@b.co").html().contains(EmailBrand.LOGO_CID_SRC));
        assertTrue(PalpeerEmailTemplates.notification("Hi", "Body").html().contains(EmailBrand.LOGO_CID_SRC));
        assertTrue(PalpeerEmailTemplates.newDeviceLogin(
                        "a@b.co", "phone", "now", "https://x/secure/account-lock/z", EmailBrand.SUPPORT_EMAIL)
                .html()
                .contains(EmailBrand.LOGO_CID_SRC));
    }
}
