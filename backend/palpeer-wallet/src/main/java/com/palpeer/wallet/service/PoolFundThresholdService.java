package com.palpeer.wallet.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.mail.EmailSender;
import com.palpeer.common.mail.PalpeerEmailTemplates;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.domain.PoolFundThreshold;
import com.palpeer.wallet.provider.PaymentRailProvider;
import com.palpeer.wallet.provider.PaymentRailRouter;
import com.palpeer.wallet.provider.apaylo.ApayloPaymentRail;
import com.palpeer.wallet.provider.korapay.KorapayPaymentRail;
import com.palpeer.wallet.provider.kuda.KudaPaymentRail;
import com.palpeer.wallet.repository.PoolFundThresholdRepository;
import com.palpeer.wallet.web.dto.PoolFundThresholdResponse;
import com.palpeer.wallet.web.dto.PoolFundsBalanceResponse;
import com.palpeer.wallet.web.dto.PoolFundsBalanceResponse.ProviderBalance;
import com.palpeer.wallet.web.dto.UpsertPoolFundThresholdRequest;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PoolFundThresholdService {

    private final PoolFundThresholdRepository repository;
    private final PoolFundsService poolFundsService;
    private final PoolLiquidityGuard poolLiquidityGuard;
    private final PaymentRailRouter paymentRailRouter;
    private final UserRepository userRepository;
    private final EmailSender emailSender;
    private final AuditRecorder auditRecorder;

    @Transactional(readOnly = true)
    public List<PoolFundThresholdResponse> listWithBalances() {
        PoolFundsBalanceResponse balances = poolFundsService.balances();
        List<ProviderBalance> pools = List.of(balances.apaylo(), balances.korapay(), balances.kuda());
        List<PoolFundThresholdResponse> rows = new ArrayList<>();
        for (ProviderBalance pool : pools) {
            if (pool == null) {
                continue;
            }
            Optional<PoolFundThreshold> saved = repository.findByProviderIgnoreCaseAndCurrencyCodeIgnoreCase(
                    pool.provider(), pool.currencyCode());
            BigDecimal current = currentBalance(pool);
            if (saved.isPresent()) {
                rows.add(toResponse(saved.get(), current));
            } else {
                rows.add(new PoolFundThresholdResponse(
                        null,
                        pool.provider(),
                        pool.currencyCode(),
                        null,
                        current,
                        false,
                        List.of(),
                        List.of(),
                        null));
            }
        }
        return rows;
    }

    @Transactional
    public PoolFundThresholdResponse upsert(UUID actorUserId, UpsertPoolFundThresholdRequest request) {
        String provider = normalizeProvider(request.provider());
        String currency = request.currencyCode().trim().toUpperCase(Locale.ROOT);
        assertKnownPool(provider, currency);

        PoolFundThreshold entity = repository
                .findByProviderIgnoreCaseAndCurrencyCodeIgnoreCase(provider, currency)
                .orElseGet(PoolFundThreshold::new);
        entity.setProvider(provider);
        entity.setCurrencyCode(currency);
        entity.setThresholdAmount(request.thresholdAmount());
        entity.replaceNotifyAdmins(
                request.notifyAdminUserIds() == null
                        ? Set.of()
                        : new HashSet<>(request.notifyAdminUserIds()));
        entity.replaceNotifyPhones(
                request.notifyPhones() == null ? List.of() : request.notifyPhones());
        repository.save(entity);

        auditRecorder.record(AuditRecord.builder("POOL_FUND_THRESHOLD_UPSERT")
                .entity("PoolFundThreshold:" + entity.getId())
                .userRef(actorUserId)
                .newValue("provider="
                        + provider
                        + ";currency="
                        + currency
                        + ";threshold="
                        + entity.getThresholdAmount()
                        + ";admins="
                        + entity.getNotifyAdminUserIds().size()
                        + ";phones="
                        + entity.getNotifyPhones().size())
                .build());

        BigDecimal current = poolLiquidityGuard.availableForProvider(provider, currency);
        return toResponse(entity, current);
    }

    /**
     * After a withdrawal settles, notify configured admins/phones when the pool is at or below
     * the configured threshold.
     */
    @Transactional(readOnly = true)
    public void notifyIfThresholdHit(String currencyCode) {
        if (!paymentRailRouter.hasEnabledRail(currencyCode)) {
            return;
        }
        PaymentRailProvider rail = paymentRailRouter.requireForWithdrawal(currencyCode);
        String provider = rail.providerName();
        Optional<PoolFundThreshold> opt =
                repository.findByProviderIgnoreCaseAndCurrencyCodeIgnoreCase(provider, currencyCode);
        if (opt.isEmpty()) {
            return;
        }
        PoolFundThreshold threshold = opt.get();
        BigDecimal current = poolLiquidityGuard.availableForProvider(provider, currencyCode);
        if (current.compareTo(threshold.getThresholdAmount()) > 0) {
            return;
        }
        String subject = "PALPEER pool fund threshold hit — " + provider + " " + currencyCode;
        String body = "Pool fund for "
                + provider
                + " ("
                + currencyCode
                + ") is "
                + current.toPlainString()
                + ", at or below the threshold of "
                + threshold.getThresholdAmount().toPlainString()
                + ".";
        for (UUID adminUserId : threshold.getNotifyAdminUserIds()) {
            userRepository.findById(adminUserId).map(User::getEmail).ifPresent(email -> {
                try {
                    var rendered = PalpeerEmailTemplates.notification(subject, body);
                    emailSender.send(email, rendered.subject(), rendered.text(), rendered.html());
                } catch (RuntimeException ex) {
                    log.warn("Pool threshold email failed to={}: {}", email, ex.getMessage());
                }
            });
        }
        for (String phone : threshold.getNotifyPhones()) {
            // SMS provider pending — log so ops can wire a rail without blocking withdraw settlement.
            log.warn(
                    "POOL THRESHOLD SMS placeholder [phone={}, provider={}, currency={}, balance={}, threshold={}]",
                    phone,
                    provider,
                    currencyCode,
                    current,
                    threshold.getThresholdAmount());
        }
    }

    private void assertKnownPool(String provider, String currency) {
        boolean known = (ApayloPaymentRail.NAME.equals(provider) && "CAD".equals(currency))
                || (KorapayPaymentRail.NAME.equals(provider) && "NGN".equals(currency))
                || (KudaPaymentRail.NAME.equals(provider) && "NGN".equals(currency));
        if (!known) {
            throw new BusinessException(
                    "POOL_THRESHOLD_UNKNOWN",
                    "Unknown pool fund provider/currency: " + provider + "/" + currency,
                    HttpStatus.BAD_REQUEST);
        }
    }

    private static String normalizeProvider(String provider) {
        if (provider == null || provider.isBlank()) {
            throw new BusinessException("POOL_THRESHOLD_UNKNOWN", "Provider is required", HttpStatus.BAD_REQUEST);
        }
        return provider.trim().toUpperCase(Locale.ROOT);
    }

    private static BigDecimal currentBalance(ProviderBalance pool) {
        if (pool.liveBalance() != null) {
            return pool.liveBalance();
        }
        return pool.balance() == null ? BigDecimal.ZERO : pool.balance();
    }

    private static PoolFundThresholdResponse toResponse(PoolFundThreshold entity, BigDecimal current) {
        boolean hit = entity.getThresholdAmount() != null
                && current != null
                && current.compareTo(entity.getThresholdAmount()) <= 0;
        return new PoolFundThresholdResponse(
                entity.getId(),
                entity.getProvider(),
                entity.getCurrencyCode(),
                entity.getThresholdAmount(),
                current,
                hit,
                List.copyOf(entity.getNotifyAdminUserIds()),
                List.copyOf(entity.getNotifyPhones()),
                entity.getUpdatedAt());
    }
}
