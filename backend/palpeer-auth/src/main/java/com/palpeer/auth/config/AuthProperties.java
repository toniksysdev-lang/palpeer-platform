package com.palpeer.auth.config;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Auth/JWT configuration.
 *
 * CONTRACT_PENDING: production TTLs, OTP length/TTL/max-attempts, and secret management
 * were not specified. Values are externalized for confirmation.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.security")
public class AuthProperties {

    private final Jwt jwt = new Jwt();
    private final Otp otp = new Otp();
    private final Google google = new Google();

    @Getter
    @Setter
    public static class Jwt {
        /** HMAC secret; must be overridden via env in non-dev. */
        private String secret = "CHANGE_ME_PALPEER_DEV_JWT_SECRET_AT_LEAST_32_CHARS";
        private Duration accessTokenTtl = Duration.ofMinutes(15);
        private Duration refreshTokenTtl = Duration.ofDays(14);
        /** Refresh TTL when the client requests remember-me / Remember session. */
        private Duration refreshTokenTtlRemembered = Duration.ofDays(30);
        private String issuer = "palpeer";
    }

    @Getter
    @Setter
    public static class Otp {
        private int length = 6;
        private Duration ttl = Duration.ofMinutes(10);
        private int maxAttempts = 5;
        /** When true, plaintext OTP is returned on register/resend for local autofill (never enable in prod). */
        private boolean logCode = false;
    }

    @Getter
    @Setter
    public static class Google {
        /**
         * Comma-separated OAuth client IDs allowed as ID-token audiences
         * (Web + Android + iOS). Empty disables Google Sign-In.
         */
        private String clientIds = "";
    }
}
