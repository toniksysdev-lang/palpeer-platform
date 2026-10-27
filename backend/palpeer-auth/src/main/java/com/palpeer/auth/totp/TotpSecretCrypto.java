package com.palpeer.auth.totp;

import com.palpeer.auth.config.AuthProperties;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/** AES-GCM encryption for TOTP secrets at rest (key derived from JWT secret). */
@Component
public class TotpSecretCrypto {

    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public TotpSecretCrypto(AuthProperties authProperties) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] material = digest.digest(
                    (authProperties.getJwt().getSecret() + "|admin-mfa-totp")
                            .getBytes(StandardCharsets.UTF_8));
            this.key = new SecretKeySpec(material, "AES");
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to derive MFA encryption key", ex);
        }
    }

    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            ByteBuffer buf = ByteBuffer.allocate(iv.length + ciphertext.length);
            buf.put(iv);
            buf.put(ciphertext);
            return Base64.getEncoder().encodeToString(buf.array());
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to encrypt TOTP secret", ex);
        }
    }

    public String decrypt(String encoded) {
        try {
            byte[] all = Base64.getDecoder().decode(encoded);
            ByteBuffer buf = ByteBuffer.wrap(all);
            byte[] iv = new byte[GCM_IV_LENGTH];
            buf.get(iv);
            byte[] ciphertext = new byte[buf.remaining()];
            buf.get(ciphertext);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to decrypt TOTP secret", ex);
        }
    }
}
