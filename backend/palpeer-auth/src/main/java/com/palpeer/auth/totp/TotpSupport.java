package com.palpeer.auth.totp;

import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * RFC 6238 TOTP (SHA-1, 30s step, 6 digits) plus Base32 helpers for authenticator apps.
 */
public final class TotpSupport {

    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    private TotpSupport() {}

    public static String generateSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return encodeBase32(bytes);
    }

    public static String otpAuthUri(String issuer, String accountName, String secret) {
        String label = url(issuer) + ":" + url(accountName);
        return "otpauth://totp/"
                + label
                + "?secret="
                + secret
                + "&issuer="
                + url(issuer)
                + "&algorithm=SHA1&digits=6&period=30";
    }

    public static boolean verify(String base32Secret, String code, Instant now, int windowSteps) {
        if (base32Secret == null || code == null) {
            return false;
        }
        String trimmed = code.trim();
        if (!trimmed.matches("\\d{6}")) {
            return false;
        }
        long counter = now.getEpochSecond() / 30L;
        byte[] key = decodeBase32(base32Secret);
        for (int i = -windowSteps; i <= windowSteps; i++) {
            String expected = hotp(key, counter + i);
            if (constantTimeEquals(expected, trimmed)) {
                return true;
            }
        }
        return false;
    }

    private static String hotp(byte[] key, long counter) {
        try {
            byte[] data = ByteBuffer.allocate(8).putLong(counter).array();
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] hash = mac.doFinal(data);
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24)
                    | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8)
                    | (hash[offset + 3] & 0xff);
            int otp = binary % 1_000_000;
            return String.format("%06d", otp);
        } catch (Exception ex) {
            throw new IllegalStateException("TOTP generation failed", ex);
        }
    }

    private static String encodeBase32(byte[] data) {
        StringBuilder sb = new StringBuilder((data.length * 8 + 4) / 5);
        int buffer = 0;
        int bitsLeft = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                sb.append(BASE32.charAt((buffer >> (bitsLeft - 5)) & 31));
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            sb.append(BASE32.charAt((buffer << (5 - bitsLeft)) & 31));
        }
        return sb.toString();
    }

    private static byte[] decodeBase32(String encoded) {
        String s = encoded.trim().toUpperCase().replace("=", "").replace(" ", "");
        ByteBuffer out = ByteBuffer.allocate((s.length() * 5) / 8);
        int buffer = 0;
        int bitsLeft = 0;
        for (int i = 0; i < s.length(); i++) {
            int val = BASE32.indexOf(s.charAt(i));
            if (val < 0) {
                throw new IllegalArgumentException("Invalid Base32 TOTP secret");
            }
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

    private static boolean constantTimeEquals(String a, String b) {
        if (a.length() != b.length()) {
            return false;
        }
        int r = 0;
        for (int i = 0; i < a.length(); i++) {
            r |= a.charAt(i) ^ b.charAt(i);
        }
        return r == 0;
    }

    private static String url(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
