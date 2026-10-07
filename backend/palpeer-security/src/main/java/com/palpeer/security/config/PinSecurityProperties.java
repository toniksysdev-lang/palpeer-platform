package com.palpeer.security.config;

import java.time.Duration;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Transaction PIN brute-force protection.
 * CONTRACT_PENDING (P3-01): production attempt limit and lockout duration.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "palpeer.security.pin")
public class PinSecurityProperties {

    /** Consecutive wrong PINs (or wrong reset answers) before the PIN locks. */
    private int maxAttempts = 5;

    private Duration lockoutDuration = Duration.ofMinutes(15);
}
