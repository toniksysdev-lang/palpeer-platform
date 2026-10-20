package com.palpeer.auth.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "phone_pre_verifications")
public class PhonePreVerification extends BaseEntity {

    @Column(name = "phone", nullable = false, length = 32, unique = true)
    private String phone;

    @Column(name = "verified_at", nullable = false)
    private Instant verifiedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}
