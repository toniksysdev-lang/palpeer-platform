package com.palpeer.kyc.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "kyc_cases",
        uniqueConstraints = @UniqueConstraint(name = "uk_kyc_cases_user_id", columnNames = "user_id")
)
public class KycCase extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private KycStatus status;

    /**
     * CONTRACT_PENDING (P2-05): rejection reason model not specified.
     */
    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    /** ComplyCube (or future) provider name. */
    @Column(name = "provider_name", length = 40)
    private String providerName;

    @Column(name = "provider_client_id", length = 120)
    private String providerClientId;

    @Column(name = "provider_check_id", length = 120)
    private String providerCheckId;
}
