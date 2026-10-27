package com.palpeer.admin.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "admin_mfa_totp",
        uniqueConstraints = @UniqueConstraint(name = "uk_admin_mfa_totp_user", columnNames = "user_id"))
public class AdminMfaTotp extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "secret_ciphertext", nullable = false, columnDefinition = "TEXT")
    private String secretCiphertext;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "enabled_at")
    private Instant enabledAt;

    /** JSON array of SHA-256 hex digests for unused recovery codes. */
    @Column(name = "recovery_code_hashes", columnDefinition = "TEXT")
    private String recoveryCodeHashes;
}
