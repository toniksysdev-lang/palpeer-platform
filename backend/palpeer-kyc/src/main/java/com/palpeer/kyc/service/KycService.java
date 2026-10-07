package com.palpeer.kyc.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.storage.ObjectStorage;
import com.palpeer.common.storage.StoreObjectRequest;
import com.palpeer.common.storage.StoredObject;
import com.palpeer.kyc.domain.KycCase;
import com.palpeer.kyc.domain.KycDocument;
import com.palpeer.kyc.domain.KycStatus;
import com.palpeer.kyc.domain.Selfie;
import com.palpeer.kyc.provider.KycVerificationProvider;
import com.palpeer.kyc.repository.KycCaseRepository;
import com.palpeer.kyc.repository.KycDocumentRepository;
import com.palpeer.kyc.repository.SelfieRepository;
import com.palpeer.kyc.web.dto.AdminKycCaseDetailResponse;
import com.palpeer.kyc.web.dto.KycDocumentResponse;
import com.palpeer.kyc.web.dto.KycFileContent;
import com.palpeer.kyc.web.dto.KycProgressResponse;
import com.palpeer.kyc.web.dto.KycStatusResponse;
import com.palpeer.kyc.web.dto.KycVerificationResponse;
import com.palpeer.kyc.web.dto.SelfieResponse;
import com.palpeer.kyc.web.dto.StartKycVerificationRequest;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class KycService {

    /**
     * CONTRACT_PENDING (P2-08): upload-allowed statuses.
     * Provisional: only open / in-progress / rejected cases accept uploads.
     */
    private static final Set<KycStatus> UPLOAD_ALLOWED = EnumSet.of(
            KycStatus.NOT_STARTED,
            KycStatus.IN_PROGRESS,
            KycStatus.REJECTED
    );

    private final KycCaseRepository kycCaseRepository;
    private final KycDocumentRepository kycDocumentRepository;
    private final SelfieRepository selfieRepository;
    private final ObjectStorage objectStorage;
    private final AuditRecorder auditRecorder;
    private final KycVerificationProvider kycVerificationProvider;
    private final UserRepository userRepository;

    @Transactional
    public KycDocumentResponse uploadDocument(UUID userId, String documentType, MultipartFile file) {
        validateFile(file);
        if (documentType == null || documentType.isBlank()) {
            throw new BusinessException("DOCUMENT_TYPE_REQUIRED", "documentType is required", HttpStatus.BAD_REQUEST);
        }

        KycCase kycCase = getOrCreateCase(userId);
        assertUploadAllowed(kycCase);

        StoredObject stored = storeWithRollbackCleanup(userId, "documents", file);
        KycDocument document = new KycDocument();
        document.setKycCaseId(kycCase.getId());
        document.setDocumentType(documentType.trim().toUpperCase());
        document.setStorageKey(stored.storageKey());
        document.setContentType(stored.contentType());
        document.setOriginalFilename(safeFilename(file));
        document.setSizeBytes(stored.sizeBytes());
        kycDocumentRepository.save(document);

        markInProgress(kycCase);
        return toDocumentResponse(document);
    }

    @Transactional
    public SelfieResponse uploadSelfie(UUID userId, MultipartFile file) {
        validateFile(file);
        KycCase kycCase = getOrCreateCase(userId);
        assertUploadAllowed(kycCase);

        StoredObject stored = storeWithRollbackCleanup(userId, "selfies", file);
        Selfie selfie = new Selfie();
        selfie.setKycCaseId(kycCase.getId());
        selfie.setStorageKey(stored.storageKey());
        selfie.setContentType(stored.contentType());
        selfie.setOriginalFilename(safeFilename(file));
        selfie.setSizeBytes(stored.sizeBytes());
        selfieRepository.save(selfie);

        markInProgress(kycCase);
        return toSelfieResponse(selfie);
    }

    @Transactional(readOnly = true)
    public KycStatusResponse getStatus(UUID userId) {
        return kycCaseRepository.findByUserId(userId)
                .map(KycService::toStatusResponse)
                .orElseGet(() -> new KycStatusResponse(null, userId, KycStatus.NOT_STARTED, null, null, null));
    }

    @Transactional(readOnly = true)
    public KycProgressResponse getProgress(UUID userId) {
        Optional<KycCase> existing = kycCaseRepository.findByUserId(userId);
        if (existing.isEmpty()) {
            return new KycProgressResponse(null, KycStatus.NOT_STARTED, false, 0, false, 0);
        }
        KycCase kycCase = existing.get();
        long documents = kycDocumentRepository.countByKycCaseId(kycCase.getId());
        long selfies = selfieRepository.countByKycCaseId(kycCase.getId());
        return new KycProgressResponse(
                kycCase.getId(),
                kycCase.getStatus(),
                documents > 0,
                documents,
                selfies > 0,
                selfies
        );
    }

    /**
     * Submit uploaded artifacts to ComplyCube for document/identity checks.
     * Requires COMPLYCUBE_ENABLED=true and at least one document uploaded.
     */
    @Transactional
    public KycVerificationResponse startVerification(UUID userId, StartKycVerificationRequest request) {
        if (!kycVerificationProvider.isEnabled()) {
            throw new BusinessException(
                    "KYC_PROVIDER_DISABLED",
                    "ComplyCube is disabled — set COMPLYCUBE_ENABLED=true and COMPLYCUBE_API_KEY",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        KycCase kycCase = getOrCreateCase(userId);
        assertUploadAllowed(kycCase);

        KycDocument document = kycDocumentRepository.findFirstByKycCaseIdOrderByCreatedAtDesc(kycCase.getId())
                .orElseThrow(() -> new BusinessException(
                        "KYC_DOCUMENT_REQUIRED",
                        "Upload a KYC document before starting verification",
                        HttpStatus.BAD_REQUEST));
        Selfie selfie = selfieRepository.findFirstByKycCaseIdOrderByCreatedAtDesc(kycCase.getId()).orElse(null);

        String clientId = kycCase.getProviderClientId();
        if (clientId == null || clientId.isBlank()) {
            clientId = kycVerificationProvider.ensureClient(new KycVerificationProvider.EnsureClientRequest(
                    userId.toString(),
                    user.getEmail(),
                    user.getPhone(),
                    request.firstName().trim(),
                    request.lastName().trim(),
                    blankToNull(request.dateOfBirth())
            ));
            kycCase.setProviderName(kycVerificationProvider.providerName());
            kycCase.setProviderClientId(clientId);
        }

        String providerDocumentId = document.getProviderDocumentId();
        if (providerDocumentId == null || providerDocumentId.isBlank()) {
            providerDocumentId = kycVerificationProvider.createDocument(
                    clientId,
                    document.getDocumentType(),
                    request.issuingCountry());
            byte[] bytes = readAll(document.getStorageKey());
            kycVerificationProvider.uploadDocumentImage(
                    providerDocumentId, "front", document.getOriginalFilename(), bytes);
            document.setProviderDocumentId(providerDocumentId);
            kycDocumentRepository.save(document);
        }

        String checkId;
        if (selfie != null) {
            String livePhotoId = selfie.getProviderLivePhotoId();
            if (livePhotoId == null || livePhotoId.isBlank()) {
                livePhotoId = kycVerificationProvider.uploadLivePhoto(
                        clientId, selfie.getOriginalFilename(), readAll(selfie.getStorageKey()));
                selfie.setProviderLivePhotoId(livePhotoId);
                selfieRepository.save(selfie);
            }
            checkId = kycVerificationProvider.createIdentityCheck(clientId, providerDocumentId, livePhotoId);
        } else {
            checkId = kycVerificationProvider.createDocumentCheck(clientId, providerDocumentId);
        }

        kycCase.setProviderCheckId(checkId);
        kycCase.setStatus(KycStatus.UNDER_REVIEW);
        kycCase.setRejectionReason(null);
        kycCaseRepository.save(kycCase);
        auditRecorder.record(AuditRecord.builder("KYC_PROVIDER_SUBMIT")
                .entity("KycCase:" + kycCase.getId())
                .userRef(userId)
                .newValue("provider=" + kycCase.getProviderName() + ";checkId=" + checkId)
                .build());
        return new KycVerificationResponse(
                kycCase.getId(),
                kycCase.getStatus(),
                kycCase.getProviderName(),
                kycCase.getProviderClientId(),
                kycCase.getProviderCheckId());
    }

    @Transactional
    public void applyProviderCheckResult(String checkId, String result, String status) {
        KycCase kycCase = kycCaseRepository.findByProviderCheckId(checkId)
                .orElseThrow(() -> new ResourceNotFoundException("KYC case not found for check " + checkId));
        String normalized = (result == null ? status : result);
        if (normalized == null) {
            return;
        }
        String value = normalized.trim().toLowerCase(Locale.ROOT);
        String old = String.valueOf(kycCase.getStatus());
        if (value.contains("clear") || value.equals("complete") || value.equals("approved") || value.equals("pass")) {
            kycCase.setStatus(KycStatus.APPROVED);
            kycCase.setRejectionReason(null);
        } else if (value.contains("reject") || value.contains("consider") || value.equals("fail") || value.contains("attention")) {
            kycCase.setStatus(KycStatus.REJECTED);
            kycCase.setRejectionReason("Provider result: " + normalized);
        } else {
            kycCase.setStatus(KycStatus.UNDER_REVIEW);
        }
        kycCaseRepository.save(kycCase);
        auditRecorder.record(AuditRecord.builder("KYC_PROVIDER_WEBHOOK")
                .entity("KycCase:" + kycCase.getId())
                .userRef(kycCase.getUserId())
                .oldValue("status=" + old)
                .newValue("status=" + kycCase.getStatus() + ";providerResult=" + normalized)
                .build());
    }

    private byte[] readAll(String storageKey) {
        try (InputStream in = objectStorage.open(storageKey)) {
            return in.readAllBytes();
        } catch (Exception ex) {
            throw new BusinessException("KYC_STORAGE_READ_FAILED", "Failed to read uploaded KYC file", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private static String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    /** Admin: page KYC cases, optionally filtered by status and/or userId. */
    @Transactional(readOnly = true)
    public Page<KycStatusResponse> listCases(KycStatus status, UUID userId, Pageable pageable) {
        Specification<KycCase> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        return kycCaseRepository.findAll(spec, pageable).map(KycService::toStatusResponse);
    }

    /** Admin: case detail with artifact metadata (no storage keys / provider ids). */
    @Transactional(readOnly = true)
    public AdminKycCaseDetailResponse adminGetCase(UUID caseId) {
        KycCase kycCase = requireCase(caseId);
        List<AdminKycCaseDetailResponse.Document> documents = kycDocumentRepository
                .findByKycCaseIdOrderByCreatedAtAsc(caseId).stream()
                .map(d -> new AdminKycCaseDetailResponse.Document(
                        d.getId(),
                        d.getDocumentType(),
                        d.getContentType(),
                        d.getOriginalFilename(),
                        d.getSizeBytes(),
                        d.getCreatedAt()))
                .toList();
        AdminKycCaseDetailResponse.Selfie selfie = selfieRepository
                .findFirstByKycCaseIdOrderByCreatedAtDesc(caseId)
                .map(s -> new AdminKycCaseDetailResponse.Selfie(
                        s.getId(),
                        s.getContentType(),
                        s.getOriginalFilename(),
                        s.getSizeBytes(),
                        s.getCreatedAt()))
                .orElse(null);
        return new AdminKycCaseDetailResponse(
                kycCase.getId(),
                kycCase.getUserId(),
                kycCase.getStatus(),
                kycCase.getRejectionReason(),
                kycCase.getCreatedAt(),
                kycCase.getUpdatedAt(),
                documents,
                selfie);
    }

    /** Admin: raw document bytes. 404 unless the document belongs to the case. Audited. */
    @Transactional
    public KycFileContent adminDocumentContent(UUID caseId, UUID documentId, UUID actorId) {
        KycCase kycCase = requireCase(caseId);
        KycDocument document = kycDocumentRepository.findByIdAndKycCaseId(documentId, caseId)
                .orElseThrow(() -> new ResourceNotFoundException("KYC document not found"));
        byte[] bytes = readAll(document.getStorageKey());
        auditRecorder.record(AuditRecord.builder("ADMIN_KYC_DOCUMENT_VIEW")
                .entity("KycDocument:" + document.getId())
                .userRef(kycCase.getUserId())
                .newValue("caseId=" + caseId + ";documentId=" + documentId + ";actor=" + actorId)
                .build());
        return new KycFileContent(document.getContentType(), document.getOriginalFilename(), bytes);
    }

    /** Admin: latest selfie bytes. 404 if the case has no selfie. Audited. */
    @Transactional
    public KycFileContent adminSelfieContent(UUID caseId, UUID actorId) {
        KycCase kycCase = requireCase(caseId);
        Selfie selfie = selfieRepository.findFirstByKycCaseIdOrderByCreatedAtDesc(caseId)
                .orElseThrow(() -> new ResourceNotFoundException("KYC selfie not found"));
        byte[] bytes = readAll(selfie.getStorageKey());
        auditRecorder.record(AuditRecord.builder("ADMIN_KYC_SELFIE_VIEW")
                .entity("Selfie:" + selfie.getId())
                .userRef(kycCase.getUserId())
                .newValue("caseId=" + caseId + ";selfieId=" + selfie.getId() + ";actor=" + actorId)
                .build());
        return new KycFileContent(selfie.getContentType(), selfie.getOriginalFilename(), bytes);
    }

    private KycCase requireCase(UUID caseId) {
        return kycCaseRepository.findById(caseId)
                .orElseThrow(() -> new ResourceNotFoundException("KYC case not found"));
    }

    private static KycStatusResponse toStatusResponse(KycCase c) {
        return new KycStatusResponse(
                c.getId(), c.getUserId(), c.getStatus(), c.getRejectionReason(), c.getCreatedAt(), c.getUpdatedAt());
    }

    /**
     * Admin review transition.
     * CONTRACT_PENDING (P2-04/P2-05): full workflow matrix.
     * Provisional: only APPROVED / REJECTED / UNDER_REVIEW / SUBMITTED allowed from admin.
     */
    @Transactional
    public KycStatusResponse review(UUID caseId, KycStatus targetStatus, String rejectionReason) {
        Set<KycStatus> allowed = EnumSet.of(
                KycStatus.SUBMITTED, KycStatus.UNDER_REVIEW, KycStatus.APPROVED, KycStatus.REJECTED);
        if (!allowed.contains(targetStatus)) {
            throw new BusinessException(
                    "KYC_INVALID_REVIEW_STATUS",
                    "Admin may set status to SUBMITTED, UNDER_REVIEW, APPROVED, or REJECTED",
                    HttpStatus.BAD_REQUEST);
        }
        KycCase kycCase = kycCaseRepository.findById(caseId)
                .orElseThrow(() -> new com.palpeer.common.exception.ResourceNotFoundException("KYC case not found"));
        String oldValue = "status=" + kycCase.getStatus();
        if (targetStatus == KycStatus.REJECTED) {
            if (rejectionReason == null || rejectionReason.isBlank()) {
                throw new BusinessException(
                        "KYC_REJECTION_REASON_REQUIRED",
                        "rejectionReason required when rejecting",
                        HttpStatus.BAD_REQUEST);
            }
            kycCase.setRejectionReason(rejectionReason.trim());
        } else {
            kycCase.setRejectionReason(null);
        }
        kycCase.setStatus(targetStatus);
        kycCaseRepository.save(kycCase);
        auditRecorder.record(AuditRecord.builder("ADMIN_KYC_REVIEW")
                .entity("KycCase:" + kycCase.getId())
                .userRef(kycCase.getUserId())
                .oldValue(oldValue)
                .newValue("status=" + kycCase.getStatus()
                        + (kycCase.getRejectionReason() == null ? "" : ";reason=" + kycCase.getRejectionReason()))
                .build());
        return toStatusResponse(kycCase);
    }

    private KycCase getOrCreateCase(UUID userId) {
        return kycCaseRepository.findByUserId(userId).orElseGet(() -> {
            KycCase created = new KycCase();
            created.setUserId(userId);
            created.setStatus(KycStatus.NOT_STARTED);
            return kycCaseRepository.save(created);
        });
    }

    private void assertUploadAllowed(KycCase kycCase) {
        if (!UPLOAD_ALLOWED.contains(kycCase.getStatus())) {
            throw new BusinessException(
                    "KYC_UPLOAD_NOT_ALLOWED",
                    "Uploads are not allowed in status " + kycCase.getStatus(),
                    HttpStatus.CONFLICT);
        }
    }

    private void markInProgress(KycCase kycCase) {
        if (kycCase.getStatus() == KycStatus.NOT_STARTED || kycCase.getStatus() == KycStatus.REJECTED) {
            kycCase.setStatus(KycStatus.IN_PROGRESS);
            kycCase.setRejectionReason(null);
            kycCaseRepository.save(kycCase);
        }
    }

    /**
     * Persists the blob and registers a compensating delete if the surrounding TX rolls back.
     */
    private StoredObject storeWithRollbackCleanup(UUID userId, String category, MultipartFile file) {
        String contentType = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        StoredObject stored = objectStorage.store(new StoreObjectRequest(
                "kyc/" + userId + "/" + category,
                safeFilename(file),
                contentType,
                file.getSize(),
                file::getInputStream
        ));

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            String key = stored.storageKey();
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status == STATUS_ROLLED_BACK) {
                        objectStorage.delete(key);
                    }
                }
            });
        }
        return stored;
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("FILE_REQUIRED", "File is required", HttpStatus.BAD_REQUEST);
        }
    }

    private static String safeFilename(MultipartFile file) {
        String name = file.getOriginalFilename();
        return name == null || name.isBlank() ? "upload.bin" : name;
    }

    private KycDocumentResponse toDocumentResponse(KycDocument document) {
        return new KycDocumentResponse(
                document.getId(),
                document.getKycCaseId(),
                document.getDocumentType(),
                document.getContentType(),
                document.getOriginalFilename(),
                document.getSizeBytes()
        );
    }

    private SelfieResponse toSelfieResponse(Selfie selfie) {
        return new SelfieResponse(
                selfie.getId(),
                selfie.getKycCaseId(),
                selfie.getContentType(),
                selfie.getOriginalFilename(),
                selfie.getSizeBytes()
        );
    }
}
