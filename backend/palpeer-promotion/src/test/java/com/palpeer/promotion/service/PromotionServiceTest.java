package com.palpeer.promotion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.notification.service.NotificationService;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.service.LedgerPostingRequest;
import com.palpeer.ledger.service.LedgerService;
import com.palpeer.promotion.domain.Bonus;
import com.palpeer.promotion.domain.BonusStatus;
import com.palpeer.promotion.domain.Promotion;
import com.palpeer.promotion.domain.PromotionType;
import com.palpeer.promotion.domain.Referral;
import com.palpeer.promotion.domain.ReferralStatus;
import com.palpeer.promotion.repository.BonusRepository;
import com.palpeer.promotion.repository.PromotionRepository;
import com.palpeer.promotion.repository.ReferralRepository;
import com.palpeer.promotion.web.dto.ApplyReferralRequest;
import com.palpeer.promotion.web.dto.CreatePromotionRequest;
import com.palpeer.promotion.web.dto.P2PFeePromotionDiscount;
import com.palpeer.promotion.web.dto.ReferralResponse;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.repository.WalletRepository;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PromotionServiceTest {

    @Mock private PromotionRepository promotionRepository;
    @Mock private ReferralRepository referralRepository;
    @Mock private BonusRepository bonusRepository;
    @Mock private CurrencyService currencyService;
    @Mock private UserRepository userRepository;
    @Mock private NotificationService notificationService;
    @Mock private com.palpeer.common.audit.AuditRecorder auditRecorder;
    @Mock private PromotionEligibilityEvaluator eligibilityEvaluator;
    @Mock private WalletRepository walletRepository;
    @Mock private LedgerService ledgerService;
    @Mock private com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock private EntityManager entityManager;

    @InjectMocks private PromotionService promotionService;

    @Test
    void createPromotion_normalizesCode() {
        when(promotionRepository.existsByCodeIgnoreCase("WELCOME")).thenReturn(false);
        when(promotionRepository.save(any(Promotion.class))).thenAnswer(inv -> {
            Promotion p = inv.getArgument(0);
            p.setId(UUID.randomUUID());
            return p;
        });

        var response = promotionService.createPromotion(new CreatePromotionRequest(
                "welcome", "Welcome", null, PromotionType.SIGNUP, null, null, null, null, null));

        assertThat(response.code()).isEqualTo("WELCOME");
        assertThat(response.active()).isTrue();
    }

    @Test
    void myReferralCode_createsWhenMissing() {
        UUID userId = UUID.randomUUID();
        when(referralRepository.findByReferrerUserIdAndRefereeUserIdIsNull(userId)).thenReturn(Optional.empty());
        when(referralRepository.save(any(Referral.class))).thenAnswer(inv -> {
            Referral r = inv.getArgument(0);
            r.setId(UUID.randomUUID());
            return r;
        });

        ReferralResponse response = promotionService.myReferralCode(userId);

        assertThat(response.referralCode()).startsWith("REF");
        assertThat(response.referralCode()).hasSize(8);
        assertThat(response.status()).isEqualTo(ReferralStatus.OPEN);
    }

    @Test
    void applyReferral_completesAndNotifies() {
        UUID referrer = UUID.randomUUID();
        UUID referee = UUID.randomUUID();
        Referral open = new Referral();
        open.setId(UUID.randomUUID());
        open.setReferrerUserId(referrer);
        open.setReferralCode("REFABC");
        open.setStatus(ReferralStatus.OPEN);

        when(referralRepository.existsByRefereeUserId(referee)).thenReturn(false);
        when(referralRepository.findByReferralCodeIgnoreCase("REFABC")).thenReturn(Optional.of(open));
        when(referralRepository.save(any(Referral.class))).thenAnswer(inv -> inv.getArgument(0));
        when(promotionRepository.findByActiveTrueOrderByCreatedAtDesc()).thenReturn(List.of());
        User referrerUser = new User();
        referrerUser.setId(referrer);
        referrerUser.setEmail("a@b.com");
        when(userRepository.findById(referrer)).thenReturn(Optional.of(referrerUser));

        ReferralResponse response = promotionService.applyReferral(referee, new ApplyReferralRequest("REFABC"));

        assertThat(response.status()).isEqualTo(ReferralStatus.COMPLETED);
        assertThat(response.refereeUserId()).isEqualTo(referee);
        verify(notificationService).create(any(), any());
    }

    @Test
    void applyReferral_creditsPhoneCountryWalletsWhenReferralPromoActive() {
        UUID referrer = UUID.randomUUID();
        UUID referee = UUID.randomUUID();
        Referral open = new Referral();
        open.setId(UUID.randomUUID());
        open.setReferrerUserId(referrer);
        open.setReferralCode("REFBONUS");
        open.setStatus(ReferralStatus.OPEN);

        Promotion promo = new Promotion();
        promo.setId(UUID.randomUUID());
        promo.setCode("REF10");
        promo.setPromotionType(PromotionType.REFERRAL);
        promo.setActive(true);
        promo.setBonusAmount(new BigDecimal("10.00"));
        promo.setBonusCurrencyCode("USD,NGN,CAD");

        when(referralRepository.existsByRefereeUserId(referee)).thenReturn(false);
        when(referralRepository.findByReferralCodeIgnoreCase("REFBONUS")).thenReturn(Optional.of(open));
        when(referralRepository.save(any(Referral.class))).thenAnswer(inv -> inv.getArgument(0));
        when(promotionRepository.findByActiveTrueOrderByCreatedAtDesc()).thenReturn(List.of(promo));
        when(eligibilityEvaluator.evaluateEligibility(referee, promo)).thenReturn(true);
        when(bonusRepository.save(any(Bonus.class))).thenAnswer(inv -> {
            Bonus b = inv.getArgument(0);
            if (b.getId() == null) {
                b.setId(UUID.randomUUID());
            }
            return b;
        });

        User referrerUser = new User();
        referrerUser.setId(referrer);
        referrerUser.setEmail("a@b.com");
        referrerUser.setPhone("+15062100661");
        User refereeUser = new User();
        refereeUser.setId(referee);
        refereeUser.setEmail("b@c.com");
        refereeUser.setPhone("+2348012345678");
        when(userRepository.findById(referrer)).thenReturn(Optional.of(referrerUser));
        when(userRepository.findById(referee)).thenReturn(Optional.of(refereeUser));

        Wallet cadWallet = new Wallet();
        cadWallet.setId(UUID.randomUUID());
        cadWallet.setUserId(referrer);
        cadWallet.setCurrencyCode("CAD");
        Wallet ngnWallet = new Wallet();
        ngnWallet.setId(UUID.randomUUID());
        ngnWallet.setUserId(referee);
        ngnWallet.setCurrencyCode("NGN");
        when(walletRepository.findByUserIdAndCurrencyCodeIgnoreCase(referrer, "CAD"))
                .thenReturn(Optional.of(cadWallet));
        when(walletRepository.findByUserIdAndCurrencyCodeIgnoreCase(referee, "NGN"))
                .thenReturn(Optional.of(ngnWallet));
        lenient().doNothing().when(currencyService).requireExists(anyString());
        when(ledgerService.post(any(LedgerPostingRequest.class))).thenAnswer(inv -> {
            LedgerEntry entry = new LedgerEntry();
            entry.setId(UUID.randomUUID());
            return entry;
        });

        promotionService.applyReferral(referee, new ApplyReferralRequest("REFBONUS"));

        verify(walletRepository).findByUserIdAndCurrencyCodeIgnoreCase(referrer, "CAD");
        verify(walletRepository).findByUserIdAndCurrencyCodeIgnoreCase(referee, "NGN");

        ArgumentCaptor<LedgerPostingRequest> ledger = ArgumentCaptor.forClass(LedgerPostingRequest.class);
        verify(ledgerService, org.mockito.Mockito.times(2)).post(ledger.capture());
        assertThat(ledger.getAllValues())
                .extracting(LedgerPostingRequest::walletId)
                .containsExactlyInAnyOrder(cadWallet.getId(), ngnWallet.getId());
        assertThat(ledger.getAllValues()).allSatisfy(post -> {
            assertThat(post.entryType()).isEqualTo(LedgerEntryType.CREDIT);
            assertThat(post.amount()).isEqualByComparingTo("10.00");
        });
    }

    @Test
    void previewP2PFeeDiscount_pendingBonusOnlyWhenOptedIn() {
        UUID userId = UUID.randomUUID();
        Bonus pending = new Bonus();
        pending.setAmount(new BigDecimal("0.75"));
        pending.setCurrencyCode("USD");
        pending.setStatus(BonusStatus.PENDING);
        when(bonusRepository.findPendingByUserAndCurrency(userId, BonusStatus.PENDING, "USD"))
                .thenReturn(List.of(pending));

        P2PFeePromotionDiscount without = promotionService.previewP2PFeeDiscount(
                userId, "USD", new BigDecimal("1.50"), false);
        assertThat(without.pendingBonusCredit()).isEqualByComparingTo("0.75");
        assertThat(without.discountAmount()).isEqualByComparingTo("0");
        assertThat(without.feeAfterDiscount()).isEqualByComparingTo("1.50");

        P2PFeePromotionDiscount with = promotionService.previewP2PFeeDiscount(
                userId, "USD", new BigDecimal("1.50"), true);
        assertThat(with.discountAmount()).isEqualByComparingTo("0.75");
        assertThat(with.feeAfterDiscount()).isEqualByComparingTo("0.75");
    }

    @Test
    void previewP2PFeeDiscount_requiresExplicitPromotionCode() {
        UUID userId = UUID.randomUUID();
        Promotion promo = new Promotion();
        promo.setCode("FEE50");
        promo.setActive(true);
        promo.setBonusAmount(new BigDecimal("0.50"));
        promo.setBonusCurrencyCode("USD");
        when(bonusRepository.findPendingByUserAndCurrency(userId, BonusStatus.PENDING, "USD"))
                .thenReturn(List.of());
        when(promotionRepository.findByCodeIgnoreCase("FEE50")).thenReturn(Optional.of(promo));
        when(eligibilityEvaluator.evaluateEligibility(userId, promo)).thenReturn(true);

        P2PFeePromotionDiscount auto = promotionService.previewP2PFeeDiscount(
                userId, "USD", new BigDecimal("1.50"), false, null);
        assertThat(auto.discountAmount()).isEqualByComparingTo("0");
        assertThat(auto.promotionCode()).isNull();

        P2PFeePromotionDiscount applied = promotionService.previewP2PFeeDiscount(
                userId, "USD", new BigDecimal("1.50"), false, "fee50");
        assertThat(applied.discountAmount()).isEqualByComparingTo("0.50");
        assertThat(applied.promotionCode()).isEqualTo("FEE50");
        assertThat(applied.feeAfterDiscount()).isEqualByComparingTo("1.00");
    }

    @Test
    void applyReferral_rejectsSelf() {
        UUID userId = UUID.randomUUID();
        Referral open = new Referral();
        open.setReferrerUserId(userId);
        open.setReferralCode("REFSELF");
        open.setStatus(ReferralStatus.OPEN);

        when(referralRepository.existsByRefereeUserId(userId)).thenReturn(false);
        when(referralRepository.findByReferralCodeIgnoreCase("REFSELF")).thenReturn(Optional.of(open));

        assertThatThrownBy(() -> promotionService.applyReferral(userId, new ApplyReferralRequest("REFSELF")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("own referral");
    }

    @Test
    void applyReferral_rejectsAlreadyApplied() {
        UUID referee = UUID.randomUUID();
        when(referralRepository.existsByRefereeUserId(referee)).thenReturn(true);

        assertThatThrownBy(() -> promotionService.applyReferral(referee, new ApplyReferralRequest("REFX")))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("already applied");
    }

    @Test
    void createPromotion_requiresCurrencyWhenAmountSet() {
        when(promotionRepository.existsByCodeIgnoreCase("BONUS")).thenReturn(false);

        assertThatThrownBy(() -> promotionService.createPromotion(new CreatePromotionRequest(
                        "BONUS",
                        "Bonus",
                        null,
                        PromotionType.REFERRAL,
                        null,
                        null,
                        new BigDecimal("10.00"),
                        null,
                        null)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void updatePromotion_updatesFields() {
        UUID id = UUID.randomUUID();
        Promotion existing = new Promotion();
        existing.setId(id);
        existing.setCode("OLD");
        existing.setTitle("Old title");
        existing.setPromotionType(PromotionType.CAMPAIGN);
        existing.setActive(true);
        when(promotionRepository.findById(id)).thenReturn(Optional.of(existing));
        when(promotionRepository.existsByCodeIgnoreCaseAndIdNot("NEWCODE", id)).thenReturn(false);
        when(promotionRepository.save(any(Promotion.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = promotionService.updatePromotion(
                id,
                new com.palpeer.promotion.web.dto.UpdatePromotionRequest(
                        "newcode",
                        "New title",
                        "Updated",
                        PromotionType.SIGNUP,
                        true,
                        null,
                        null,
                        null,
                        null,
                        null));

        assertThat(response.code()).isEqualTo("NEWCODE");
        assertThat(response.title()).isEqualTo("New title");
        assertThat(response.promotionType()).isEqualTo(PromotionType.SIGNUP);
        assertThat(existing.getCode()).isEqualTo("NEWCODE");
    }

    @Test
    void myBonusSummary_groupsUnusedAndUsedByCurrency() {
        UUID userId = UUID.randomUUID();
        Bonus pending = new Bonus();
        pending.setCurrencyCode("ngn");
        pending.setAmount(new BigDecimal("100.50"));
        pending.setStatus(BonusStatus.PENDING);
        Bonus granted = new Bonus();
        granted.setCurrencyCode("NGN");
        granted.setAmount(new BigDecimal("25.00"));
        granted.setStatus(BonusStatus.GRANTED);
        Bonus failed = new Bonus();
        failed.setCurrencyCode("NGN");
        failed.setAmount(new BigDecimal("9.00"));
        failed.setStatus(BonusStatus.FAILED);
        when(bonusRepository.findByUserIdOrderByCreatedAtDesc(userId))
                .thenReturn(List.of(pending, granted, failed));

        var rows = promotionService.myBonusSummary(userId);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).currencyCode()).isEqualTo("NGN");
        assertThat(rows.get(0).totalAmount()).isEqualByComparingTo("125.50");
        assertThat(rows.get(0).unusedAmount()).isEqualByComparingTo("100.50");
        assertThat(rows.get(0).usedAmount()).isEqualByComparingTo("25.00");
    }
}
