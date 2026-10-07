package com.palpeer.common.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

/**
 * Immutable-style audit trail record for security, admin, and financial changes.
 */
@Getter
@Setter
@Entity
@Table(name = "audit_logs")
public class AuditEntity extends BaseEntity {

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "device", length = 255)
    private String device;

    @Column(name = "user_ref", length = 100)
    private String userRef;

    @Column(name = "action", nullable = false, length = 100)
    private String action;

    @Column(name = "entity", length = 100)
    private String entity;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;
}
