package com.palpeer.auth.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * One-time token emailed after a new-device login. The raw token is never stored; only its hash.
 * Password/PIN are never placed in the email link — the confirm endpoint re-checks them.
 */
@Getter
@Setter
@Entity
@Table(name = "account_suspend_tokens")
public class AccountSuspendToken extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "token_hash", nullable = false, length = 128, unique = true)
    private String tokenHash;

    @Column(name = "device_identifier", length = 128)
    private String deviceIdentifier;

    @Column(name = "device_name", length = 120)
    private String deviceName;

    @Column(name = "platform", length = 40)
    private String platform;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed", nullable = false)
    private boolean consumed;

    @Column(name = "consumed_at")
    private Instant consumedAt;
}
