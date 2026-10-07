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
 * Registered device for biometric / trusted-device auth.
 * CONTRACT_PENDING (P3-03): biometric protocol (passkey, platform biometrics, etc.).
 */
@Getter
@Setter
@Entity
@Table(
        name = "devices",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_devices_user_device",
                columnNames = {"user_id", "device_identifier"}
        )
)
public class Device extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "device_identifier", nullable = false, length = 255)
    private String deviceIdentifier;

    @Column(name = "platform", length = 40)
    private String platform;

    @Column(name = "device_name", length = 120)
    private String deviceName;

    /**
     * Opaque biometric/public-key credential material from the client.
     * Not returned on list APIs.
     */
    @Column(name = "biometric_credential", nullable = false, length = 2000)
    private String biometricCredential;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;
}
