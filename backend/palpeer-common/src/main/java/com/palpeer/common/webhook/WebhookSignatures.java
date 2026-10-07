package com.palpeer.common.webhook;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * HMAC-SHA256 verification for inbound provider webhooks.
 * Fails closed: a missing secret or signature never verifies.
 */
public final class WebhookSignatures {

    private WebhookSignatures() {
    }

    public static boolean hmacSha256Matches(String secret, String rawBody, String providedSignature) {
        if (secret == null || secret.isBlank() || providedSignature == null || providedSignature.isBlank()) {
            return false;
        }
        String provided = providedSignature.trim();
        if (provided.regionMatches(true, 0, "sha256=", 0, 7)) {
            provided = provided.substring(7);
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal((rawBody == null ? "" : rawBody).getBytes(StandardCharsets.UTF_8));
            byte[] expected = HexFormat.of().formatHex(digest).getBytes(StandardCharsets.US_ASCII);
            byte[] actual = provided.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII);
            return MessageDigest.isEqual(expected, actual);
        } catch (Exception ex) {
            return false;
        }
    }
}
