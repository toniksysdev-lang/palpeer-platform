package com.palpeer.security.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Transaction PIN credential (hashed).
 * Lockout state (failedAttempts / lockedUntil) is managed by PinAttemptGuard.
 * CONTRACT_PENDING (P3-01): PIN length/complexity and production lockout values.
 */
@Getter
@Setter
@Entity
@Table(
        name = "pin_credentials",
        uniqueConstraints = @UniqueConstraint(name = "uk_pin_credentials_user_id", columnNames = "user_id")
)
public class PinCredential extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "pin_hash", nullable = false, length = 255)
    private String pinHash;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts;

    @Column(name = "locked_until")
    private Instant lockedUntil;
}
