package com.palpeer.user.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

/**
 * Platform user credentials and verification flags.
 * Fields limited to the Phase 1 verified contract.
 */
@Getter
@Setter
@Entity
@Table(
        name = "users",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_users_email", columnNames = "email"),
                @UniqueConstraint(name = "uk_users_phone", columnNames = "phone")
        }
)
public class User extends BaseEntity {

    @Column(name = "email", nullable = false, length = 320)
    private String email;

    /** Null for Google-only accounts that have not added a phone yet. */
    @Column(name = "phone", length = 32)
    private String phone;

    /** Null for Google-only accounts (password login is unavailable). */
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    /** Google OpenID `sub` claim when the account is linked to Google Sign-In. */
    @Column(name = "google_sub", length = 255)
    private String googleSub;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private UserStatus status;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    @Column(name = "phone_verified", nullable = false)
    private boolean phoneVerified;
}
