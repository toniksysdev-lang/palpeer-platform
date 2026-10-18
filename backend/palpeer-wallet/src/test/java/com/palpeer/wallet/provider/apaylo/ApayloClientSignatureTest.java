package com.palpeer.wallet.provider.apaylo;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class ApayloClientSignatureTest {

    @Test
    void buildSignature_matchesDocsAlgorithm() throws Exception {
        String apiKey = "key";
        String secret = "secret";
        LocalDate date = LocalDate.of(2026, 10, 17);
        String expected = Base64.getEncoder()
                .encodeToString(MessageDigest.getInstance("SHA-512")
                        .digest((apiKey + secret + "2026-10-17").getBytes(StandardCharsets.UTF_8)));
        assertEquals(expected, ApayloClient.buildSignature(apiKey, secret, date));
    }

    @Test
    void joinUrl_keepsApayloApiPathPrefix() {
        String base = "https://sandboxapi.apaylo.com/sandboxapi.apaylo.com/api";
        assertEquals(
                base + "/Merchant/RequestInteracEtransferEmail",
                ApayloClient.joinUrl(base, "/Merchant/RequestInteracEtransferEmail"));
        assertEquals(
                base + "/Merchant/GetBalance",
                ApayloClient.joinUrl(base, "Merchant/GetBalance"));
    }

    @Test
    void customerName_stripsEmailUnsafeCharacters() {
        assertEquals("Jane Doe", ApayloPaymentRail.customerName("Jane", "Doe"));
        assertEquals("PALPEER Customer", ApayloPaymentRail.customerName(null, null));
        assertEquals(
                "O'Brien example.com",
                ApayloPaymentRail.sanitizeCustomerName("O'Brien@example.com"));
    }

    @Test
    void description_rejectsUuidHyphens() {
        assertEquals("PALPEER wallet funding", ApayloPaymentRail.sanitizeDescription("PALPEER wallet funding"));
        assertEquals(
                "PALPEER wallet funding a1b2c3d4 e5f6 7890 abcd ef1234567890",
                ApayloPaymentRail.sanitizeDescription(
                        "PALPEER wallet funding a1b2c3d4-e5f6-7890-abcd-ef1234567890"));
        assertEquals("PALPEER payment", ApayloPaymentRail.sanitizeDescription("x"));
    }
}
