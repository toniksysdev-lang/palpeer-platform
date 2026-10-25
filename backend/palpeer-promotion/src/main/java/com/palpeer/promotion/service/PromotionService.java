package com.palpeer.promotion.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.settings.PhoneCountryResolver;
import com.palpeer.common.settings.RegistrationCorridorCurrencies;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.service.LedgerPostingRequest;
import com.palpeer.ledger.service.LedgerService;
import com.palpeer.notification.domain.NotificationChannel;
import com.palpeer.notification.service.NotificationService;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.notification.web.dto.CreateNotificationRequest;
import com.palpeer.promotion.domain.Bonus;
import com.palpeer.promotion.domain.BonusStatus;
import com.palpeer.promotion.domain.Promotion;
import com.palpeer.promotion.domain.Referral;
import com.palpeer.promotion.domain.ReferralStatus;
import com.palpeer.promotion.repository.BonusRepository;
import com.palpeer.promotion.repository.PromotionRepository;
import com.palpeer.promotion.repository.ReferralRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.promotion.web.dto.ApplyReferralRequest;
import com.palpeer.promotion.web.dto.BonusResponse;
import com.palpeer.promotion.web.dto.CreatePromotionRequest;
import com.palpeer.promotion.web.dto.P2PFeePromotionDiscount;
import com.palpeer.promotion.web.dto.PromotionResponse;
import com.palpeer.promotion.web.dto.ReferralResponse;
import com.palpeer.promotion.web.dto.UpdatePromotionCampaignRequest;
import com.palpeer.promotion.web.dto.UpdatePromotionRequest;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
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
    private final PromotionEligibilityEvaluator eligibilityEvaluator;
    private final WalletRepository walletRepository;
    private final LedgerService ledgerService;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;

    @Transactional
    public PromotionResponse createPromotion(CreatePromotionRequest request) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (promotionRepository.existsByCodeIgnoreCase(code)) {
            throw new BusinessException("PROMOTION_CODE_EXISTS", "Promotion code already exists", HttpStatus.CONFLICT);
        }
        String currenciesCsv = normalizeBonusCurrencies(request.bonusCurrencyCode());
        if (request.bonusAmount() != null && (currenciesCsv == null || currenciesCsv.isBlank())) {
            throw new BusinessException(
                    "PROMOTION_CURRENCY_REQUIRED",
                    "bonusCurrencyCode required when bonusAmount is set",
                    HttpStatus.BAD_REQUEST);
        }
        if (currenciesCsv != null) {
            for (String currency : splitCurrencies(currenciesCsv)) {
                currencyService.requireExists(currency);
            }
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
        promotion.setBonusCurrencyCode(currenciesCsv);
        promotion.setEligibilityJson(trimToNull(request.eligibilityJson()));
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

        // Optional bonus from active REFERRAL promotion — phone-country wallet currency
        promotionRepository.findByActiveTrueOrderByCreatedAtDesc().stream()
                .filter(p -> p.getPromotionType() == com.palpeer.promotion.domain.PromotionType.REFERRAL)
                .filter(p -> isCurrentlyActive(p, Instant.now()))
                .filter(p -> p.getBonusAmount() != null && p.getBonusCurrencyCode() != null)
                .findFirst()
                .ifPresent(promo -> {
                    if (!evaluateEligibility(refereeUserId, promo)) {
                        return;
                    }
                    referral.setPromotionId(promo.getId());
                    referralRepository.save(referral);
                    // Invitee bonus is always granted when eligible.
                    creditReferralBonusToPhoneWallet(
                            refereeUserId, promo, referral.getId(), "Referred signup bonus", true);
                    boolean deferReferrer = eligibilityEvaluator.referrerBonusRequiresInviteeTrade(promo)
                            && !eligibilityEvaluator.hasQualifyingTrade(refereeUserId);
                    creditReferralBonusToPhoneWallet(
                            referral.getReferrerUserId(),
                            promo,
                            referral.getId(),
                            deferReferrer
                                    ? "Referral bonus (pending invitee InstantEx or P2P)"
                                    : "Referral bonus",
                            !deferReferrer);
                });

        notifyReferral(referral);
        return toReferral(referral);
    }

    /**
     * When an invitee completes InstantEX or P2P, grant any PENDING referrer bonuses waiting on that
     * trade.
     */
    @Transactional
    public int grantPendingReferrerBonusesForInvitee(UUID inviteeUserId) {
        if (inviteeUserId == null) {
            return 0;
        }
        Referral referral = referralRepository.findByRefereeUserId(inviteeUserId).orElse(null);
        if (referral == null || referral.getStatus() != ReferralStatus.COMPLETED) {
            return 0;
        }
        List<Bonus> pending = bonusRepository.findByReferralIdAndUserIdAndStatus(
                referral.getId(), referral.getReferrerUserId(), BonusStatus.PENDING);
        int granted = 0;
        for (Bonus bonus : pending) {
            settlePendingBonusToWallet(bonus);
            granted++;
        }
        return granted;
    }

    @Transactional(readOnly = true)
    public Page<BonusResponse> myBonuses(UUID userId, Pageable pageable) {
        return bonusRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable).map(this::toBonus);
    }

    @Transactional(readOnly = true)
    public List<com.palpeer.promotion.web.dto.BonusCurrencySummary> myBonusSummary(UUID userId) {
        Map<String, BigDecimal> unused = new java.util.LinkedHashMap<>();
        Map<String, BigDecimal> used = new java.util.LinkedHashMap<>();
        for (Bonus bonus : bonusRepository.findByUserIdOrderByCreatedAtDesc(userId)) {
            if (bonus.getStatus() == BonusStatus.FAILED || bonus.getAmount() == null) {
                continue;
            }
            String rawCurrency = bonus.getCurrencyCode();
            if (rawCurrency == null || rawCurrency.isBlank()) {
                continue;
            }
            String currency = rawCurrency.trim().toUpperCase(Locale.ROOT);
            if (bonus.getStatus() == BonusStatus.PENDING) {
                unused.merge(currency, bonus.getAmount(), BigDecimal::add);
            } else if (bonus.getStatus() == BonusStatus.GRANTED || bonus.getStatus() == BonusStatus.CANCELLED) {
                used.merge(currency, bonus.getAmount(), BigDecimal::add);
            }
        }
        java.util.Set<String> currencies = new java.util.LinkedHashSet<>();
        currencies.addAll(unused.keySet());
        currencies.addAll(used.keySet());
        List<com.palpeer.promotion.web.dto.BonusCurrencySummary> rows = new java.util.ArrayList<>();
        for (String currency : currencies) {
            BigDecimal unusedAmt = unused.getOrDefault(currency, BigDecimal.ZERO);
            BigDecimal usedAmt = used.getOrDefault(currency, BigDecimal.ZERO);
            rows.add(new com.palpeer.promotion.web.dto.BonusCurrencySummary(
                    currency, unusedAmt.add(usedAmt), unusedAmt, usedAmt));
        }
        rows.sort(java.util.Comparator.comparing(com.palpeer.promotion.web.dto.BonusCurrencySummary::currencyCode));
        return rows;
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

    @Transactional(readOnly = true)
    public PromotionResponse adminGetPromotion(UUID promotionId) {
        return toPromotion(requirePromotion(promotionId));
    }

    @Transactional
    public PromotionResponse updatePromotion(UUID promotionId, UpdatePromotionRequest request) {
        Promotion promotion = requirePromotion(promotionId);
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (promotionRepository.existsByCodeIgnoreCaseAndIdNot(code, promotionId)) {
            throw new BusinessException(
                    "PROMOTION_CODE_EXISTS", "Promotion code already exists", HttpStatus.CONFLICT);
        }
        String currenciesCsv = normalizeBonusCurrencies(request.bonusCurrencyCode());
        if (request.bonusAmount() != null && (currenciesCsv == null || currenciesCsv.isBlank())) {
            throw new BusinessException(
                    "PROMOTION_CURRENCY_REQUIRED",
                    "bonusCurrencyCode required when bonusAmount is set",
                    HttpStatus.BAD_REQUEST);
        }
        if (currenciesCsv != null) {
            for (String currency : splitCurrencies(currenciesCsv)) {
                currencyService.requireExists(currency);
            }
        }

        promotion.setCode(code);
        promotion.setTitle(request.title().trim());
        promotion.setDescription(trimToNull(request.description()));
        promotion.setPromotionType(request.promotionType());
        promotion.setActive(Boolean.TRUE.equals(request.active()));
        promotion.setStartsAt(request.startsAt());
        promotion.setEndsAt(request.endsAt());
        promotion.setBonusAmount(request.bonusAmount());
        promotion.setBonusCurrencyCode(currenciesCsv);
        if (request.eligibilityJson() != null) {
            promotion.setEligibilityJson(trimToNull(request.eligibilityJson()));
        }
        promotionRepository.save(promotion);
        auditRecorder.record(AuditRecord.builder("ADMIN_PROMOTION_UPDATE")
                .entity("Promotion:" + promotionId)
                .newValue("code="
                        + promotion.getCode()
                        + ";active="
                        + promotion.isActive()
                        + ";type="
                        + promotion.getPromotionType())
                .build());
        return toPromotion(promotion);
    }

    @Transactional
    public PromotionResponse updateCampaignRules(UUID promotionId, UpdatePromotionCampaignRequest request) {
        Promotion promotion = requirePromotion(promotionId);
        promotion.setFormulaJson(trimToNull(request.formulaJson()));
        promotion.setEligibilityJson(trimToNull(request.eligibilityJson()));
        promotionRepository.save(promotion);
        auditRecorder.record(AuditRecord.builder("ADMIN_PROMOTION_CAMPAIGN_UPDATE")
                .entity("Promotion:" + promotionId)
                .newValue("formula=" + (promotion.getFormulaJson() != null) + ";eligibility="
                        + (promotion.getEligibilityJson() != null))
                .build());
        return toPromotion(promotion);
    }

    public boolean evaluateEligibility(UUID userId, Promotion promotion) {
        return eligibilityEvaluator.evaluateEligibility(userId, promotion);
    }

    @Transactional
    public BonusResponse adminSettleBonus(UUID bonusId) {
        Bonus bonus = bonusRepository
                .findById(bonusId)
                .orElseThrow(() -> new ResourceNotFoundException("Bonus not found"));
        if (bonus.getStatus() != BonusStatus.PENDING) {
            throw new BusinessException(
                    "BONUS_NOT_PENDING",
                    "Only PENDING bonuses can be settled",
                    HttpStatus.CONFLICT);
        }
        Wallet wallet = walletRepository
                .findByUserIdAndCurrencyCodeIgnoreCase(bonus.getUserId(), bonus.getCurrencyCode())
                .orElseThrow(() -> new BusinessException(
                        "BONUS_WALLET_MISSING",
                        "User has no wallet for " + bonus.getCurrencyCode(),
                        HttpStatus.UNPROCESSABLE_ENTITY));

        LedgerEntry entry = ledgerService.post(new LedgerPostingRequest(
                wallet.getId(),
                LedgerEntryType.CREDIT,
                bonus.getAmount(),
                "bonus-settle:" + bonus.getId(),
                "BONUS",
                bonus.getId().toString(),
                bonus.getReason() != null ? bonus.getReason() : "Promotion bonus"));

        bonus.setStatus(BonusStatus.GRANTED);
        bonus.setLedgerEntryId(entry.getId());
        bonusRepository.save(bonus);
        auditRecorder.record(AuditRecord.builder("ADMIN_BONUS_SETTLE")
                .entity("Bonus:" + bonusId)
                .userRef(bonus.getUserId())
                .newValue("ledgerEntryId=" + entry.getId())
                .build());
        return toBonus(bonus);
    }

    @Transactional
    public BonusResponse adminCancelBonus(UUID bonusId) {
        Bonus bonus = bonusRepository
                .findById(bonusId)
                .orElseThrow(() -> new ResourceNotFoundException("Bonus not found"));
        if (bonus.getStatus() != BonusStatus.PENDING) {
            throw new BusinessException(
                    "BONUS_NOT_PENDING",
                    "Only PENDING bonuses can be cancelled",
                    HttpStatus.CONFLICT);
        }
        bonus.setStatus(BonusStatus.CANCELLED);
        bonusRepository.save(bonus);
        auditRecorder.record(AuditRecord.builder("ADMIN_BONUS_CANCEL")
                .entity("Bonus:" + bonusId)
                .userRef(bonus.getUserId())
                .build());
        return toBonus(bonus);
    }

    /**
     * Preview how much of a P2P platform fee can be covered by an explicitly entered promotion code
     * and (optionally) the caller's PENDING bonus credit in the fee currency.
     *
     * <p>Promotions are never auto-applied: {@code promotionCode} must match an active, eligible
     * campaign. When the code is blank, only pending bonus credit (if opted in) can reduce the fee.
     *
     * @param applyPendingBonus when false, pending credit is reported but not included in the
     *     discount — the buyer must opt in before settle.
     */
    @Transactional(readOnly = true)
    public P2PFeePromotionDiscount previewP2PFeeDiscount(
            UUID userId, String feeCurrencyCode, BigDecimal feeAmount, boolean applyPendingBonus) {
        return previewP2PFeeDiscount(userId, feeCurrencyCode, feeAmount, applyPendingBonus, null);
    }

    @Transactional(readOnly = true)
    public P2PFeePromotionDiscount previewP2PFeeDiscount(
            UUID userId,
            String feeCurrencyCode,
            BigDecimal feeAmount,
            boolean applyPendingBonus,
            String promotionCode) {
        if (userId == null || feeAmount == null || feeAmount.signum() <= 0) {
            return new P2PFeePromotionDiscount(
                    feeAmount,
                    BigDecimal.ZERO,
                    feeAmount,
                    feeCurrencyCode,
                    null,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO);
        }
        String feeCurrency = feeCurrencyCode.trim().toUpperCase(Locale.ROOT);
        Instant now = Instant.now();
        BigDecimal pendingCredit = pendingBonusCredit(userId, feeCurrency);
        String promoCode = null;
        BigDecimal promoOff = BigDecimal.ZERO;
        if (promotionCode != null && !promotionCode.isBlank()) {
            String requestedCode = promotionCode.trim().toUpperCase(Locale.ROOT);
            Optional<Promotion> matched = promotionRepository.findByCodeIgnoreCase(requestedCode);
            if (matched.isPresent()) {
                Promotion promo = matched.get();
                if (isCurrentlyActive(promo, now)
                        && promotionSupportsCurrency(promo, feeCurrency)
                        && eligibilityEvaluator.evaluateEligibility(userId, promo)) {
                    BigDecimal off = promotionFeeOffset(promo, feeAmount);
                    if (off.signum() > 0) {
                        promoOff = off;
                        promoCode = promo.getCode();
                    }
                }
            }
        }
        BigDecimal bonusOff = applyPendingBonus ? pendingCredit : BigDecimal.ZERO;
        BigDecimal discount = promoOff.add(bonusOff).min(feeAmount).max(BigDecimal.ZERO);
        BigDecimal after = feeAmount.subtract(discount).max(BigDecimal.ZERO);
        return new P2PFeePromotionDiscount(
                feeAmount, discount, after, feeCurrency, promoCode, pendingCredit, promoOff.min(feeAmount));
    }

    /**
     * Applies the fee discount for settlement: optionally consumes PENDING bonus credit (oldest
     * first) up to the discount amount and returns the net fee to charge.
     */
    @Transactional
    public BigDecimal applyP2PFeeDiscount(
            UUID userId, String feeCurrencyCode, BigDecimal feeAmount, boolean applyPendingBonus) {
        return applyP2PFeeDiscount(userId, feeCurrencyCode, feeAmount, applyPendingBonus, null);
    }

    @Transactional
    public BigDecimal applyP2PFeeDiscount(
            UUID userId,
            String feeCurrencyCode,
            BigDecimal feeAmount,
            boolean applyPendingBonus,
            String promotionCode) {
        P2PFeePromotionDiscount preview =
                previewP2PFeeDiscount(
                        userId, feeCurrencyCode, feeAmount, applyPendingBonus, promotionCode);
        if (preview.discountAmount() == null || preview.discountAmount().signum() <= 0) {
            return feeAmount;
        }
        BigDecimal remainingBonusUse = applyPendingBonus
                ? preview
                        .discountAmount()
                        .subtract(preview.promotionOffset() == null ? BigDecimal.ZERO : preview.promotionOffset())
                        .max(BigDecimal.ZERO)
                : BigDecimal.ZERO;
        if (remainingBonusUse.signum() > 0) {
            List<Bonus> pending = bonusRepository.findPendingByUserAndCurrency(
                    userId, BonusStatus.PENDING, feeCurrencyCode.trim().toUpperCase(Locale.ROOT));
            for (Bonus bonus : pending) {
                if (remainingBonusUse.signum() <= 0) {
                    break;
                }
                BigDecimal use = bonus.getAmount().min(remainingBonusUse);
                if (use.compareTo(bonus.getAmount()) >= 0) {
                    bonus.setStatus(BonusStatus.CANCELLED);
                    bonus.setReason("Applied to P2P platform fee");
                    bonus.setAmount(bonus.getAmount()); // keep original for audit trail
                } else {
                    bonus.setAmount(bonus.getAmount().subtract(use));
                    bonus.setReason("Partially applied to P2P platform fee");
                }
                bonusRepository.save(bonus);
                remainingBonusUse = remainingBonusUse.subtract(use);
            }
        }
        auditRecorder.record(AuditRecord.builder("P2P_FEE_PROMO_APPLIED")
                .entity("User:" + userId)
                .userRef(userId)
                .newValue("feeCurrency="
                        + feeCurrencyCode
                        + ";original="
                        + preview.originalFeeAmount()
                        + ";discount="
                        + preview.discountAmount()
                        + ";promo="
                        + preview.promotionCode()
                        + ";applyPendingBonus="
                        + applyPendingBonus)
                .build());
        return preview.feeAfterDiscount();
    }

    private Promotion requirePromotion(UUID promotionId) {
        return promotionRepository
                .findById(promotionId)
                .orElseThrow(() -> new ResourceNotFoundException("Promotion not found"));
    }

    /**
     * Creates a referral bonus in the user's phone-country wallet currency. When
     * {@code grantImmediately} is true, credits the wallet; otherwise leaves PENDING until the
     * invitee completes InstantEX or P2P.
     */
    private void creditReferralBonusToPhoneWallet(
            UUID userId, Promotion promo, UUID referralId, String reason, boolean grantImmediately) {
        if (promo.getBonusAmount() == null || promo.getBonusAmount().signum() <= 0) {
            return;
        }
        String currency = resolveReferralBonusCurrency(userId, promo);
        if (currency == null) {
            log.warn("Skipping referral bonus for user {}: no phone/profile currency matched promo {}",
                    userId, promo.getCode());
            return;
        }
        try {
            currencyService.requireExists(currency);
        } catch (RuntimeException ex) {
            log.warn("Skipping referral bonus for user {}: currency {} not configured", userId, currency);
            return;
        }

        Bonus bonus = new Bonus();
        bonus.setUserId(userId);
        bonus.setPromotionId(promo.getId());
        bonus.setReferralId(referralId);
        bonus.setAmount(promo.getBonusAmount());
        bonus.setCurrencyCode(currency);
        bonus.setStatus(BonusStatus.PENDING);
        bonus.setReason(reason);
        bonusRepository.save(bonus);

        if (grantImmediately) {
            settlePendingBonusToWallet(bonus);
        }
    }

    private void settlePendingBonusToWallet(Bonus bonus) {
        if (bonus.getStatus() != BonusStatus.PENDING) {
            return;
        }
        Wallet wallet = requireOrCreateWallet(bonus.getUserId(), bonus.getCurrencyCode());
        String reason = bonus.getReason() != null ? bonus.getReason() : "Promotion bonus";
        if (reason.contains("(pending invitee")) {
            reason = "Referral bonus";
            bonus.setReason(reason);
        }
        LedgerEntry entry = ledgerService.post(new LedgerPostingRequest(
                wallet.getId(),
                LedgerEntryType.CREDIT,
                bonus.getAmount(),
                "bonus-referral:" + bonus.getId(),
                "BONUS",
                bonus.getId().toString(),
                reason));
        bonus.setStatus(BonusStatus.GRANTED);
        bonus.setLedgerEntryId(entry.getId());
        bonusRepository.save(bonus);
        auditRecorder.record(AuditRecord.builder("REFERRAL_BONUS_GRANTED")
                .entity("Bonus:" + bonus.getId())
                .userRef(bonus.getUserId())
                .newValue("currency="
                        + bonus.getCurrencyCode()
                        + ";walletId="
                        + wallet.getId()
                        + ";ledgerEntryId="
                        + entry.getId())
                .build());
    }

    private String resolveReferralBonusCurrency(UUID userId, Promotion promo) {
        String fromPhoneOrProfile = RegistrationCorridorCurrencies.currencyForIso2(iso2ForUser(userId));
        if (fromPhoneOrProfile != null) {
            return fromPhoneOrProfile;
        }
        return primaryBonusCurrency(promo);
    }

    private String iso2ForUser(UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user != null && user.getPhone() != null && !user.getPhone().isBlank()) {
            String fromPhone = PhoneCountryResolver.iso2FromE164(user.getPhone());
            if (fromPhone != null) {
                return fromPhone;
            }
        }
        Object country = entityManager
                .createNativeQuery("SELECT country_of_residence FROM profiles WHERE user_id = :userId")
                .setParameter("userId", userId)
                .getResultStream()
                .findFirst()
                .orElse(null);
        return PhoneCountryResolver.normalizeIso2(country == null ? null : country.toString());
    }

    private Wallet requireOrCreateWallet(UUID userId, String currencyCode) {
        return walletRepository
                .findByUserIdAndCurrencyCodeIgnoreCase(userId, currencyCode)
                .orElseGet(() -> {
                    Wallet wallet = new Wallet();
                    wallet.setUserId(userId);
                    wallet.setCurrencyCode(currencyCode);
                    wallet.setAvailableBalance(BigDecimal.ZERO);
                    wallet.setPendingBalance(BigDecimal.ZERO);
                    return walletRepository.save(wallet);
                });
    }

    private BigDecimal pendingBonusCredit(UUID userId, String feeCurrency) {
        return bonusRepository
                .findPendingByUserAndCurrency(userId, BonusStatus.PENDING, feeCurrency)
                .stream()
                .map(Bonus::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal promotionFeeOffset(Promotion promo, BigDecimal fee) {
        BigDecimal fromFormula = formulaOffset(promo.getFormulaJson(), fee);
        if (fromFormula != null && fromFormula.signum() > 0) {
            return fromFormula.min(fee);
        }
        if (promo.getBonusAmount() != null && promo.getBonusAmount().signum() > 0) {
            return promo.getBonusAmount().min(fee);
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal formulaOffset(String formulaJson, BigDecimal fee) {
        if (formulaJson == null || formulaJson.isBlank()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(formulaJson);
            String type = node.path("type").asText("").trim().toUpperCase(Locale.ROOT);
            if (!node.has("value") || node.get("value").isNull()) {
                return null;
            }
            BigDecimal value = new BigDecimal(node.get("value").asText().trim());
            if (value.signum() <= 0) {
                return BigDecimal.ZERO;
            }
            if ("PERCENT".equals(type)) {
                return fee.multiply(value)
                        .divide(BigDecimal.valueOf(100), 12, RoundingMode.HALF_EVEN)
                        .min(fee);
            }
            // FLAT (default)
            return value.min(fee);
        } catch (Exception ex) {
            log.warn("Invalid promotion formula JSON: {}", ex.getMessage());
            return null;
        }
    }

    private static boolean promotionSupportsCurrency(Promotion promo, String feeCurrency) {
        List<String> codes = splitCurrencies(promo.getBonusCurrencyCode());
        return codes.isEmpty() || codes.contains(feeCurrency);
    }

    private static String primaryBonusCurrency(Promotion promo) {
        List<String> codes = splitCurrencies(promo.getBonusCurrencyCode());
        return codes.isEmpty() ? null : codes.get(0);
    }

    private static String normalizeBonusCurrencies(String raw) {
        List<String> codes = splitCurrencies(raw);
        if (codes.isEmpty()) {
            return null;
        }
        return String.join(",", codes);
    }

    private static List<String> splitCurrencies(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split("[,\\s]+"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> s.toUpperCase(Locale.ROOT))
                .distinct()
                .collect(Collectors.toList());
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

    /** 8-character codes: {@code REF} + 5 hex chars (e.g. {@code REF1A2B3}). */
    private static String generateCode() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 5).toUpperCase(Locale.ROOT);
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
                p.getFormulaJson(),
                p.getEligibilityJson(),
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
