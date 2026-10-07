package com.palpeer.common.mail;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class PalpeerEmailTemplatesTest {

    @Test
    void otpTemplateUsesBrandColorsAndEscapesCode() {
        var email = PalpeerEmailTemplates.otp("email verification", "517200");

        assertTrue(email.subject().toLowerCase().contains("verify"));
        assertTrue(email.html().contains(EmailBrand.BG));
        assertTrue(email.html().contains(EmailBrand.PRIMARY));
        assertTrue(email.html().contains("517200"));
        assertTrue(email.html().contains("PALPEER"));
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
        assertTrue(email.text().contains("new.user@example.com"));
    }
}
