package com.palpeer.auth.spi;

import java.util.UUID;

/**
 * Port for verifying a user's transaction PIN without coupling auth → security.
 * Implemented in {@code palpeer-security}.
 */
public interface TransactionPinMatcher {

    boolean hasPin(UUID userId);

    boolean matches(UUID userId, String rawPin);
}
