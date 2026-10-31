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
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
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
        document.setPayload(multipartBytes(file));
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
        selfie.setPayload(multipartBytes(file));
        selfieRepository.save(selfie);

        markInProgress(kycCase);
        return toSelfieResponse(selfie);
    }

    @Transactional
    public KycStatusResponse getStatus(UUID userId) {
        Optional<KycCase> existing = kycCaseRepository.findByUserId(userId);
        if (existing.isEmpty()) {
            return new KycStatusResponse(null, userId, KycStatus.NOT_STARTED, null, null, null);
        }
        KycCase kycCase = existing.get();
        syncProviderCheckIfNeeded(kycCase);
        return toStatusResponse(kycCaseRepository.findById(kycCase.getId()).orElse(kycCase));
    }

    @Transactional
    public KycProgressResponse getProgress(UUID userId) {
        Optional<KycCase> existing = kycCaseRepository.findByUserId(userId);
        if (existing.isEmpty()) {
            return new KycProgressResponse(null, KycStatus.NOT_STARTED, false, 0, false, 0, List.of());
        }
        KycCase kycCase = existing.get();
        syncProviderCheckIfNeeded(kycCase);
        kycCase = kycCaseRepository.findById(kycCase.getId()).orElse(kycCase);
        long documents = kycDocumentRepository.countByKycCaseId(kycCase.getId());
        long selfies = selfieRepository.countByKycCaseId(kycCase.getId());
        List<KycDocument> uploaded = kycDocumentRepository.findByKycCaseIdOrderByCreatedAtAsc(kycCase.getId());
        // Distinct types, newest upload first (verification uses the latest document).
        List<String> documentTypes = new ArrayList<>();
        for (int i = uploaded.size() - 1; i >= 0; i--) {
            String type = uploaded.get(i).getDocumentType();
            if (type == null || type.isBlank()) {
                continue;
            }
            String normalized = type.trim().toUpperCase(Locale.ROOT);
            if (!documentTypes.contains(normalized)) {
                documentTypes.add(normalized);
            }
        }
        return new KycProgressResponse(
                kycCase.getId(),
                kycCase.getStatus(),
                documents > 0,
                documents,
                selfies > 0,
                selfies,
                List.copyOf(documentTypes)
        );
    }

    /**
     * When webhooks cannot reach localhost, poll ComplyCube while a case is under review.
     */
    private void syncProviderCheckIfNeeded(KycCase kycCase) {
        if (kycCase.getStatus() != KycStatus.UNDER_REVIEW) {
            return;
        }
        String checkId = kycCase.getProviderCheckId();
        if (checkId == null || checkId.isBlank() || !kycVerificationProvider.isEnabled()) {
            return;
        }
        kycVerificationProvider.getCheck(checkId).ifPresent(check ->
                applyProviderCheckResult(check.checkId(), check.result(), check.status()));
    }

    /**
     * Background / webhook-fallback sweep for Live ComplyCube: poll check outcomes for
     * {@code UNDER_REVIEW} cases so approvals land even when the dashboard webhook is delayed.
     */
    @Transactional
    public int reconcileUnderReviewProviderChecks(int limit) {
        if (!kycVerificationProvider.isEnabled()) {
            return 0;
        }
        int max = Math.max(1, Math.min(limit, 50));
        List<KycCase> pending = kycCaseRepository.findByStatusOrderByUpdatedAtAsc(KycStatus.UNDER_REVIEW);
        int updated = 0;
        for (KycCase listed : pending) {
            if (updated >= max) {
                break;
            }
            KycCase kycCase = kycCaseRepository.findById(listed.getId()).orElse(null);
            if (kycCase == null || kycCase.getStatus() != KycStatus.UNDER_REVIEW) {
                continue;
            }
            KycStatus before = kycCase.getStatus();
            try {
                syncProviderCheckIfNeeded(kycCase);
                KycCase after = kycCaseRepository.findById(kycCase.getId()).orElse(kycCase);
                if (after.getStatus() != before) {
                    updated++;
                    log.info(
                            "ComplyCube KYC reconciled via poll. caseId={} status {} -> {}",
                            after.getId(),
                            before,
                            after.getStatus());
                }
            } catch (RuntimeException ex) {
                log.warn("ComplyCube KYC reconcile skipped for {}: {}", listed.getId(), ex.getMessage());
            }
        }
        return updated;
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
                    "Identity verification isn't available right now. Please try again later.",
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
        // Live identity verification always needs a live photo (selfie) for ComplyCube identity_check.
        Selfie selfie = selfieRepository.findFirstByKycCaseIdOrderByCreatedAtDesc(kycCase.getId())
                .orElseThrow(() -> new BusinessException(
                        "KYC_SELFIE_REQUIRED",
                        "Take a live photo of your face before starting identity verification",
                        HttpStatus.BAD_REQUEST));

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
            byte[] bytes = readDocumentBytes(document);
            kycVerificationProvider.uploadDocumentImage(
                    providerDocumentId, "front", document.getOriginalFilename(), bytes);
            document.setProviderDocumentId(providerDocumentId);
            kycDocumentRepository.save(document);
        }

        String livePhotoId = selfie.getProviderLivePhotoId();
        if (livePhotoId == null || livePhotoId.isBlank()) {
            livePhotoId = kycVerificationProvider.uploadLivePhoto(
                    clientId, selfie.getOriginalFilename(), readSelfieBytes(selfie));
            selfie.setProviderLivePhotoId(livePhotoId);
            selfieRepository.save(selfie);
        }
        String checkId = kycVerificationProvider.createIdentityCheck(clientId, providerDocumentId, livePhotoId);

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
        // Prefer outcome (clear/attention/…) over status (pending/complete/failed).
        // ComplyCube status "complete" only means the check finished — not that it passed.
        String outcome = blankToNull(result);
        String providerStatus = blankToNull(status);
        String decisionSource = outcome != null ? outcome : providerStatus;
        if (decisionSource == null) {
            return;
        }
        String value = decisionSource.trim().toLowerCase(Locale.ROOT);
        String old = String.valueOf(kycCase.getStatus());
        KycStatus next;
        String rejectionReason = null;
        if (outcome != null) {
            if (value.equals("clear") || value.equals("approved") || value.equals("pass")) {
                next = KycStatus.APPROVED;
            } else if (value.contains("reject") || value.equals("fail") || value.equals("not_processed")) {
                next = KycStatus.REJECTED;
                rejectionReason = "Provider result: " + outcome;
            } else if (value.contains("attention") || value.contains("consider")) {
                // Needs human review in admin — keep UNDER_REVIEW with provider note.
                next = KycStatus.UNDER_REVIEW;
                rejectionReason = "Provider flagged for review: " + outcome;
            } else {
                next = KycStatus.UNDER_REVIEW;
            }
        } else if (value.equals("pending") || value.equals("in_progress") || value.equals("complete")) {
            // "complete" without an outcome yet — keep polling.
            next = KycStatus.UNDER_REVIEW;
        } else if (value.equals("failed") || value.contains("fail")) {
            next = KycStatus.REJECTED;
            rejectionReason = "Provider status: " + providerStatus;
        } else {
            next = KycStatus.UNDER_REVIEW;
        }
        if (next == kycCase.getStatus()
                && Objects.equals(rejectionReason, kycCase.getRejectionReason())) {
            return;
        }
        kycCase.setStatus(next);
        kycCase.setRejectionReason(rejectionReason);
        kycCaseRepository.save(kycCase);
        auditRecorder.record(AuditRecord.builder("KYC_PROVIDER_WEBHOOK")
                .entity("KycCase:" + kycCase.getId())
                .userRef(kycCase.getUserId())
                .oldValue("status=" + old)
                .newValue("status=" + kycCase.getStatus()
                        + ";providerResult=" + outcome
                        + ";providerStatus=" + providerStatus)
                .build());
    }

    private byte[] readDocumentBytes(KycDocument document) {
        if (document.getPayload() != null && document.getPayload().length > 0) {
            return document.getPayload();
        }
        return readFromObjectStorage(document.getStorageKey());
    }

    private byte[] readSelfieBytes(Selfie selfie) {
        if (selfie.getPayload() != null && selfie.getPayload().length > 0) {
            return selfie.getPayload();
        }
        return readFromObjectStorage(selfie.getStorageKey());
    }

    private byte[] readFromObjectStorage(String storageKey) {
        try (InputStream in = objectStorage.open(storageKey)) {
            return in.readAllBytes();
        } catch (Exception ex) {
            throw new BusinessException(
                    "KYC_STORAGE_READ_FAILED",
                    "Failed to read uploaded KYC file",
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    ex);
        }
    }

    private static byte[] multipartBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (Exception ex) {
            throw new BusinessException(
                    "STORAGE_WRITE_FAILED",
                    "Failed to read upload bytes",
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    ex);
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

    /** Admin: case detail with artifact + read-only ComplyCube live-check metadata. */
    @Transactional(readOnly = true)
    public AdminKycCaseDetailResponse adminGetCase(UUID caseId) {
        KycCase kycCase = requireCase(caseId);
        return toAdminDetail(kycCase, fetchProviderCheck(kycCase).orElse(null));
    }

    /**
     * Admin: refresh this case from ComplyCube (poll check outcome) and return the updated detail.
     */
    @Transactional
    public AdminKycCaseDetailResponse adminSyncProvider(UUID caseId) {
        KycCase kycCase = requireCase(caseId);
        String checkId = kycCase.getProviderCheckId();
        if (checkId == null || checkId.isBlank()) {
            throw new BusinessException(
                    "KYC_PROVIDER_CHECK_MISSING",
                    "This case has no ComplyCube check to sync yet",
                    HttpStatus.BAD_REQUEST);
        }
        if (!kycVerificationProvider.isEnabled()) {
            throw new BusinessException(
                    "KYC_PROVIDER_DISABLED",
                    "Identity verification provider is not configured",
                    HttpStatus.SERVICE_UNAVAILABLE);
        }
        var check = kycVerificationProvider.getCheck(checkId)
                .orElseThrow(() -> new BusinessException(
                        "KYC_PROVIDER_SYNC_FAILED",
                        "Could not load the ComplyCube check",
                        HttpStatus.BAD_GATEWAY));
        applyProviderCheckResult(check.checkId(), check.result(), check.status());
        kycCase = requireCase(caseId);
        auditRecorder.record(AuditRecord.builder("ADMIN_KYC_PROVIDER_SYNC")
                .entity("KycCase:" + kycCase.getId())
                .userRef(kycCase.getUserId())
                .newValue("checkId=" + check.checkId()
                        + ";status=" + check.status()
                        + ";outcome=" + check.result())
                .build());
        return toAdminDetail(kycCase, check);
    }

    private Optional<KycVerificationProvider.ProviderCheckResult> fetchProviderCheck(KycCase kycCase) {
        String checkId = kycCase.getProviderCheckId();
        if (checkId == null || checkId.isBlank() || !kycVerificationProvider.isEnabled()) {
            return Optional.empty();
        }
        return kycVerificationProvider.getCheck(checkId);
    }

    private AdminKycCaseDetailResponse toAdminDetail(
            KycCase kycCase,
            KycVerificationProvider.ProviderCheckResult check) {
        List<AdminKycCaseDetailResponse.Document> documents = kycDocumentRepository
                .findByKycCaseIdOrderByCreatedAtAsc(kycCase.getId()).stream()
                .map(d -> new AdminKycCaseDetailResponse.Document(
                        d.getId(),
                        d.getDocumentType(),
                        d.getContentType(),
                        d.getOriginalFilename(),
                        d.getSizeBytes(),
                        d.getCreatedAt()))
                .toList();
        Optional<Selfie> selfieEntity =
                selfieRepository.findFirstByKycCaseIdOrderByCreatedAtDesc(kycCase.getId());
        AdminKycCaseDetailResponse.Selfie selfie = selfieEntity
                .map(s -> new AdminKycCaseDetailResponse.Selfie(
                        s.getId(),
                        s.getContentType(),
                        s.getOriginalFilename(),
                        s.getSizeBytes(),
                        s.getCreatedAt(),
                        s.getProviderLivePhotoId() != null && !s.getProviderLivePhotoId().isBlank()))
                .orElse(null);
        boolean liveIdentity = selfieEntity.isPresent()
                && kycCase.getProviderCheckId() != null
                && !kycCase.getProviderCheckId().isBlank();
        return new AdminKycCaseDetailResponse(
                kycCase.getId(),
                kycCase.getUserId(),
                kycCase.getStatus(),
                kycCase.getRejectionReason(),
                kycCase.getCreatedAt(),
                kycCase.getUpdatedAt(),
                kycCase.getProviderName(),
                kycCase.getProviderClientId(),
                kycCase.getProviderCheckId(),
                check != null ? check.type() : (liveIdentity ? "identity_check" : null),
                check != null ? check.status() : null,
                check != null ? check.result() : null,
                check != null ? check.breakdown() : null,
                liveIdentity,
                documents,
                selfie);
    }

    /** Admin: raw document bytes. 404 unless the document belongs to the case. Audited. */
    @Transactional
    public KycFileContent adminDocumentContent(UUID caseId, UUID documentId, UUID actorId) {
        KycCase kycCase = requireCase(caseId);
        KycDocument document = kycDocumentRepository.findByIdAndKycCaseId(documentId, caseId)
                .orElseThrow(() -> new ResourceNotFoundException("KYC document not found"));
        byte[] bytes = readDocumentBytes(document);
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
        byte[] bytes = readSelfieBytes(selfie);
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
