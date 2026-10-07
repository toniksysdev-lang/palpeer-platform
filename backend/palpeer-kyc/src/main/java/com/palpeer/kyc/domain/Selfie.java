package com.palpeer.kyc.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

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

    @Column(name = "provider_live_photo_id", length = 120)
    private String providerLivePhotoId;
}
