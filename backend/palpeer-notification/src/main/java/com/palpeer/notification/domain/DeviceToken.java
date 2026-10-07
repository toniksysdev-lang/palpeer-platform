package com.palpeer.notification.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Push notification device token.
 * Distinct from security {@code Device} (biometric / trusted-device).
 */
@Getter
@Setter
@Entity
@Table(
        name = "device_tokens",
        uniqueConstraints = @UniqueConstraint(name = "uk_device_tokens_token", columnNames = "token")
)
public class DeviceToken extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "token", nullable = false, length = 512)
    private String token;

    @Enumerated(EnumType.STRING)
    @Column(name = "platform", nullable = false, length = 40)
    private DeviceTokenPlatform platform;

    @Column(name = "device_identifier", length = 255)
    private String deviceIdentifier;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;
}
