package com.palpeer.auth.totp;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.ByteBuffer;
import java.time.Instant;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class TotpSupportTest {

    @Test
    void verifyAcceptsCurrentCode() throws Exception {
        String secret = TotpSupport.generateSecret();
        String code = currentCode(secret);
        assertTrue(TotpSupport.verify(secret, code, Instant.now(), 1));
        assertFalse(TotpSupport.verify(secret, "000000", Instant.now(), 0));
    }

    @Test
    void otpAuthUriIsGoogleAuthenticatorCompatible() {
        String secret = TotpSupport.generateSecret();
        String uri = TotpSupport.otpAuthUri("Palpeer Admin", "ops@palpeer.com", secret);
        assertTrue(uri.startsWith("otpauth://totp/"));
        assertTrue(uri.contains("secret=" + secret));
        assertTrue(uri.contains("algorithm=SHA1"));
        assertTrue(uri.contains("digits=6"));
        assertTrue(uri.contains("period=30"));
        assertTrue(uri.contains("issuer=Palpeer%20Admin"));
        assertTrue(uri.contains("Palpeer%20Admin:ops%40palpeer.com"));
    }

    @Test
    void otpAuthUriRejectsInvalidSecret() {
        assertThrows(
                IllegalArgumentException.class,
                () -> TotpSupport.otpAuthUri("Palpeer Admin", "ops@palpeer.com", "not@base32"));
    }

    private static String currentCode(String base32Secret) throws Exception {
        // Mirror TotpSupport hotp for a known-good code without exposing package-private helpers.
        byte[] key = decode(base32Secret);
        long counter = Instant.now().getEpochSecond() / 30L;
        byte[] data = ByteBuffer.allocate(8).putLong(counter).array();
        Mac mac = Mac.getInstance("HmacSHA1");
        mac.init(new SecretKeySpec(key, "HmacSHA1"));
        byte[] hash = mac.doFinal(data);
        int offset = hash[hash.length - 1] & 0x0f;
        int binary = ((hash[offset] & 0x7f) << 24)
                | ((hash[offset + 1] & 0xff) << 16)
                | ((hash[offset + 2] & 0xff) << 8)
                | (hash[offset + 3] & 0xff);
        return String.format("%06d", binary % 1_000_000);
    }

    private static byte[] decode(String encoded) {
        String alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        String s = encoded.trim().toUpperCase().replace("=", "");
        ByteBuffer out = ByteBuffer.allocate((s.length() * 5) / 8);
        int buffer = 0;
        int bitsLeft = 0;
        for (int i = 0; i < s.length(); i++) {
            int val = alphabet.indexOf(s.charAt(i));
            buffer = (buffer << 5) | val;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                out.put((byte) ((buffer >> (bitsLeft - 8)) & 0xff));
                bitsLeft -= 8;
            }
        }
        byte[] result = new byte[out.position()];
        out.rewind();
        out.get(result);
        return result;
    }
}
