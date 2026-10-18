package com.palpeer.security.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "pin_security_policy")
public class PinSecurityPolicy {

    @Id
    @Column(name = "id", nullable = false)
    private Short id = 1;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "max_wrong_attempts", nullable = false)
    private int maxWrongAttempts = 5;

    @Column(name = "lockout_hours", nullable = false, precision = 10, scale = 2)
    private BigDecimal lockoutHours = new BigDecimal("0.25");

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
        if (id == null) {
            id = 1;
        }
    }
}
