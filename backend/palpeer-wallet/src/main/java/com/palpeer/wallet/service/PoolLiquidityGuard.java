package com.palpeer.wallet.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.provider.PaymentRailProvider;
import com.palpeer.wallet.provider.PaymentRailRouter;
import com.palpeer.wallet.web.dto.PoolFundsBalanceResponse.ProviderBalance;
import java.math.BigDecimal;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * Blocks wallet withdrawals that would exceed the treasury pool for the payout rail.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PoolLiquidityGuard {

    private final PoolFundsService poolFundsService;
    private final PaymentRailRouter paymentRailRouter;

    public void assertSufficientPool(String currencyCode, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            return;
        }
        if (!paymentRailRouter.hasEnabledRail(currencyCode)) {
            // Manual/operator path without a rail — do not block on pool here.
            return;
        }
        PaymentRailProvider rail = paymentRailRouter.requireForWithdrawal(currencyCode);
        BigDecimal available = availableForProvider(rail.providerName(), currencyCode);
        if (available.compareTo(amount) < 0) {
            log.warn(
                    "Withdrawal blocked: amount={} {} exceeds pool available={} for provider={}",
                    amount,
                    currencyCode,
                    available,
                    rail.providerName());
            throw new BusinessException(
                    "INTERNAL_PAYMENT_ERROR",
                    "Internal Payment Error, please contact support",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
    }

    public BigDecimal availableForProvider(String provider, String currencyCode) {
        ProviderBalance card = poolFundsService.findProviderBalance(provider, currencyCode);
        if (card == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal live = card.liveBalance();
        if (live != null) {
            return live;
        }
        return card.balance() == null ? BigDecimal.ZERO : card.balance();
    }

    public static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
