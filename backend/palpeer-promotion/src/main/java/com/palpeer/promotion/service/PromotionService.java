package com.palpeer.promotion.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.notification.domain.NotificationChannel;
import com.palpeer.notification.service.NotificationService;
import com.palpeer.notification.web.dto.CreateNotificationRequest;
import com.palpeer.promotion.domain.Bonus;
import com.palpeer.promotion.domain.BonusStatus;
import com.palpeer.promotion.domain.Promotion;
import com.palpeer.promotion.domain.Referral;
import com.palpeer.promotion.domain.ReferralStatus;
import com.palpeer.promotion.repository.BonusRepository;
import com.palpeer.promotion.repository.PromotionRepository;
import com.palpeer.promotion.repository.ReferralRepository;
import com.palpeer.promotion.web.dto.ApplyReferralRequest;
import com.palpeer.promotion.web.dto.BonusResponse;
import com.palpeer.promotion.web.dto.CreatePromotionRequest;
import com.palpeer.promotion.web.dto.PromotionResponse;
import com.palpeer.promotion.web.dto.ReferralResponse;
import com.palpeer.user.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final ReferralRepository referralRepository;
    private final BonusRepository bonusRepository;
    private final CurrencyService currencyService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AuditRecorder auditRecorder;

    @Transactional
    public PromotionResponse createPromotion(CreatePromotionRequest request) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (promotionRepository.existsByCodeIgnoreCase(code)) {
            throw new BusinessException("PROMOTION_CODE_EXISTS", "Promotion code already exists", HttpStatus.CONFLICT);
        }
        if (request.bonusAmount() != null) {
            if (request.bonusCurrencyCode() == null || request.bonusCurrencyCode().isBlank()) {
                throw new BusinessException(
                        "PROMOTION_CURRENCY_REQUIRED",
                        "bonusCurrencyCode required when bonusAmount is set",
                        HttpStatus.BAD_REQUEST);
            }
            currencyService.requireExists(request.bonusCurrencyCode().trim().toUpperCase(Locale.ROOT));
        }

        Promotion promotion = new Promotion();
        promotion.setCode(code);
        promotion.setTitle(request.title().trim());
        promotion.setDescription(trimToNull(request.description()));
        promotion.setPromotionType(request.promotionType());
        promotion.setActive(true);
        promotion.setStartsAt(request.startsAt());
        promotion.setEndsAt(request.endsAt());
        promotion.setBonusAmount(request.bonusAmount());
        promotion.setBonusCurrencyCode(
                request.bonusCurrencyCode() == null
                        ? null
                        : request.bonusCurrencyCode().trim().toUpperCase(Locale.ROOT));
        promotionRepository.save(promotion);
        auditRecorder.record(AuditRecord.builder("ADMIN_PROMOTION_CREATE")
                .entity("Promotion:" + promotion.getId())
                .newValue("code=" + promotion.getCode() + ";type=" + promotion.getPromotionType())
                .build());
        return toPromotion(promotion);
    }

    @Transactional(readOnly = true)
    public List<PromotionResponse> listActive() {
        Instant now = Instant.now();
        return promotionRepository.findByActiveTrueOrderByCreatedAtDesc().stream()
                .filter(p -> isCurrentlyActive(p, now))
                .map(this::toPromotion)
                .toList();
    }

    /**
     * Ensure the user has an OPEN referral code (create if missing).
     * CONTRACT_PENDING (P14-02): code format / expiry.
     */
    @Transactional
    public ReferralResponse myReferralCode(UUID userId) {
        return referralRepository.findByReferrerUserIdAndRefereeUserIdIsNull(userId)
                .map(this::toReferral)
                .orElseGet(() -> {
                    Referral referral = new Referral();
                    referral.setReferrerUserId(userId);
                    referral.setReferralCode(generateCode());
                    referral.setStatus(ReferralStatus.OPEN);
                    referralRepository.save(referral);
                    return toReferral(referral);
                });
    }

    @Transactional(readOnly = true)
    public List<ReferralResponse> myReferrals(UUID userId) {
        return referralRepository.findByReferrerUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toReferral)
                .toList();
    }

    @Transactional
    public ReferralResponse applyReferral(UUID refereeUserId, ApplyReferralRequest request) {
        if (referralRepository.existsByRefereeUserId(refereeUserId)) {
            throw new BusinessException(
                    "REFERRAL_ALREADY_APPLIED",
                    "User already applied a referral code",
                    HttpStatus.CONFLICT);
        }

        Referral referral = referralRepository
                .findByReferralCodeIgnoreCase(request.referralCode().trim())
                .orElseThrow(() -> new ResourceNotFoundException("Referral code not found"));

        if (referral.getStatus() != ReferralStatus.OPEN || referral.getRefereeUserId() != null) {
            throw new BusinessException("REFERRAL_NOT_OPEN", "Referral code is not available", HttpStatus.CONFLICT);
        }
        if (referral.getReferrerUserId().equals(refereeUserId)) {
            throw new BusinessException("REFERRAL_SELF", "Cannot apply your own referral code", HttpStatus.BAD_REQUEST);
        }

        referral.setRefereeUserId(refereeUserId);
        referral.setStatus(ReferralStatus.COMPLETED);
        referralRepository.save(referral);

        // Optional bonus from active REFERRAL promotion with amount — PENDING only (no ledger yet)
        promotionRepository.findByActiveTrueOrderByCreatedAtDesc().stream()
                .filter(p -> p.getPromotionType() == com.palpeer.promotion.domain.PromotionType.REFERRAL)
                .filter(p -> isCurrentlyActive(p, Instant.now()))
                .filter(p -> p.getBonusAmount() != null && p.getBonusCurrencyCode() != null)
                .findFirst()
                .ifPresent(promo -> {
                    referral.setPromotionId(promo.getId());
                    referralRepository.save(referral);
                    createPendingBonus(referral.getReferrerUserId(), promo, referral.getId(), "Referral bonus");
                    createPendingBonus(refereeUserId, promo, referral.getId(), "Referred signup bonus");
                });

        notifyReferral(referral);
        return toReferral(referral);
    }

    @Transactional(readOnly = true)
    public Page<BonusResponse> myBonuses(UUID userId, Pageable pageable) {
        return bonusRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable).map(this::toBonus);
    }

    @Transactional(readOnly = true)
    public Page<ReferralResponse> adminListReferrals(
            ReferralStatus status,
            String referralCode,
            UUID referrerUserId,
            UUID refereeUserId,
            Pageable pageable) {
        String code = referralCode == null || referralCode.isBlank() ? null : referralCode.trim();
        return referralRepository
                .findAll(
                        (root, query, cb) -> {
                            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
                            if (status != null) {
                                predicates.add(cb.equal(root.get("status"), status));
                            }
                            if (code != null) {
                                predicates.add(cb.equal(cb.lower(root.get("referralCode")), code.toLowerCase(Locale.ROOT)));
                            }
                            if (referrerUserId != null) {
                                predicates.add(cb.equal(root.get("referrerUserId"), referrerUserId));
                            }
                            if (refereeUserId != null) {
                                predicates.add(cb.equal(root.get("refereeUserId"), refereeUserId));
                            }
                            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
                        },
                        pageable)
                .map(this::toReferral);
    }

    @Transactional(readOnly = true)
    public ReferralResponse adminGetReferral(UUID id) {
        Referral referral = referralRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Referral not found"));
        return toReferral(referral);
    }

    @Transactional(readOnly = true)
    public Page<BonusResponse> adminListBonuses(
            BonusStatus status, UUID userId, UUID referralId, Pageable pageable) {
        return bonusRepository.adminSearch(status, userId, referralId, pageable).map(this::toBonus);
    }

    private void createPendingBonus(UUID userId, Promotion promo, UUID referralId, String reason) {
        Bonus bonus = new Bonus();
        bonus.setUserId(userId);
        bonus.setPromotionId(promo.getId());
        bonus.setReferralId(referralId);
        bonus.setAmount(promo.getBonusAmount());
        bonus.setCurrencyCode(promo.getBonusCurrencyCode());
        bonus.setStatus(BonusStatus.PENDING);
        bonus.setReason(reason);
        bonusRepository.save(bonus);
    }

    private void notifyReferral(Referral referral) {
        try {
            userRepository.findById(referral.getReferrerUserId()).ifPresent(referrer ->
                    notificationService.create(
                            referrer.getId(),
                            new CreateNotificationRequest(
                                    "Referral completed",
                                    "Someone joined using your referral code " + referral.getReferralCode(),
                                    "REFERRAL",
                                    NotificationChannel.EMAIL,
                                    "REFERRAL",
                                    referral.getId())));
        } catch (RuntimeException ex) {
            // Do not roll back referral completion if email fails
            log.warn("Referral email notify failed for {}: {}", referral.getId(), ex.getMessage());
        }
    }

    private static boolean isCurrentlyActive(Promotion p, Instant now) {
        if (p.getStartsAt() != null && now.isBefore(p.getStartsAt())) {
            return false;
        }
        if (p.getEndsAt() != null && now.isAfter(p.getEndsAt())) {
            return false;
        }
        return p.isActive();
    }

    private static String generateCode() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase(Locale.ROOT);
        return "REF" + suffix;
    }

    private PromotionResponse toPromotion(Promotion p) {
        return new PromotionResponse(
                p.getId(),
                p.getCode(),
                p.getTitle(),
                p.getDescription(),
                p.getPromotionType(),
                p.isActive(),
                p.getStartsAt(),
                p.getEndsAt(),
                p.getBonusAmount(),
                p.getBonusCurrencyCode(),
                p.getCreatedAt());
    }

    private ReferralResponse toReferral(Referral r) {
        return new ReferralResponse(
                r.getId(),
                r.getReferrerUserId(),
                r.getRefereeUserId(),
                r.getReferralCode(),
                r.getStatus(),
                r.getPromotionId(),
                r.getCreatedAt());
    }

    private BonusResponse toBonus(Bonus b) {
        return new BonusResponse(
                b.getId(),
                b.getUserId(),
                b.getPromotionId(),
                b.getReferralId(),
                b.getAmount(),
                b.getCurrencyCode(),
                b.getStatus(),
                b.getReason(),
                b.getLedgerEntryId(),
                b.getCreatedAt());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
