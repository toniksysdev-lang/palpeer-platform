package com.palpeer.promotion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.notification.service.NotificationService;
import com.palpeer.promotion.domain.Promotion;
import com.palpeer.promotion.domain.PromotionType;
import com.palpeer.promotion.domain.Referral;
import com.palpeer.promotion.domain.ReferralStatus;
import com.palpeer.promotion.repository.BonusRepository;
import com.palpeer.promotion.repository.PromotionRepository;
import com.palpeer.promotion.repository.ReferralRepository;
import com.palpeer.promotion.web.dto.ApplyReferralRequest;
import com.palpeer.promotion.web.dto.CreatePromotionRequest;
import com.palpeer.promotion.web.dto.ReferralResponse;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
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
                "welcome", "Welcome", null, PromotionType.SIGNUP, null, null, null, null));

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
                        null)))
                .isInstanceOf(BusinessException.class);
    }
}
