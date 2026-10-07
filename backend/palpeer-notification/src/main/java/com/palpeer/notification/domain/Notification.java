package com.palpeer.notification.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Persisted notification for a user (in-app inbox and/or push).
 * CONTRACT_PENDING (P12-04): category catalog and deep-link reference model.
 */
@Getter
@Setter
@Entity
@Table(name = "notifications")
public class Notification extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "body", nullable = false, length = 2000)
    private String body;

    @Column(name = "category", length = 80)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 20)
    private NotificationChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private NotificationStatus status;

    @Column(name = "reference_type", length = 80)
    private String referenceType;

    @Column(name = "reference_id")
    private UUID referenceId;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "failure_reason", length = 500)
    private String failureReason;
}
