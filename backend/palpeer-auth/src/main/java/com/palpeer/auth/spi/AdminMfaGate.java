package com.palpeer.auth.spi;

import java.util.UUID;

/**
 * Optional bridge so auth can detect admin TOTP without depending on the admin module.
 * Implemented in {@code palpeer-admin}.
 */
public interface AdminMfaGate {

    /** True when this user is an enabled admin with MFA fully enrolled (login challenge). */
    boolean isMfaRequired(UUID userId);

    /**
     * Validates a TOTP or a one-time recovery code. Recovery codes are consumed on success.
     */
    boolean verifySecondFactor(UUID userId, String code);
}
