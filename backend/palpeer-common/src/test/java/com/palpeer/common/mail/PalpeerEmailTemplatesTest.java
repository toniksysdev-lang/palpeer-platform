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
        assertTrue(email.html().contains("alt=\"PALPEER\""));
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
    void welcomeTemplateUsesBrandAndIncludesEmail() {
        var email = PalpeerEmailTemplates.welcome("new.user@example.com");

        assertTrue(email.subject().toLowerCase().contains("welcome"));
        assertTrue(email.html().contains("Welcome to PALPEER"));
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
                "https://api.example.com/api/v1/auth/account-suspend?token=abc",
                "support@palpeer.com");

        assertTrue(email.subject().toLowerCase().contains("new device"));
        assertTrue(email.html().contains("If this was you"));
        assertTrue(email.html().contains("Suspend my account"));
        assertTrue(email.html().contains("account-suspend?token=abc"));
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
                        "a@b.co", "phone", "now", "https://x/y?token=z", EmailBrand.SUPPORT_EMAIL)
                .html()
                .contains(EmailBrand.LOGO_CID_SRC));
    }
}
