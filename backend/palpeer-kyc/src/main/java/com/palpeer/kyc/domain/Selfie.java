package com.palpeer.kyc.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Basic;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@Entity
@Table(name = "kyc_selfies")
public class Selfie extends BaseEntity {

    @Column(name = "kyc_case_id", nullable = false)
    private UUID kycCaseId;

    @Column(name = "storage_key", nullable = false, length = 512)
    private String storageKey;

    @Column(name = "content_type", nullable = false, length = 120)
    private String contentType;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    /** Durable copy for environments where local disk is ephemeral (e.g. Render). */
    @JdbcTypeCode(SqlTypes.BINARY)
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "payload")
    private byte[] payload;

    @Column(name = "provider_live_photo_id", length = 120)
    private String providerLivePhotoId;
}
