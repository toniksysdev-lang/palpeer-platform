package com.palpeer.wallet.provider;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.wallet.provider.korapay.KorapayPaymentRail;
import com.palpeer.wallet.provider.kuda.KudaPaymentRail;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PaymentRailRouter {

    private final List<PaymentRailProvider> providers;

    /** Funding: prefer Korapay for NGN when enabled ({@code @Order}), else first enabled rail. */
    public PaymentRailProvider requireForCurrency(String currencyCode) {
        String code = normalize(currencyCode);
        return providers.stream()
                .filter(PaymentRailProvider::isEnabled)
                .filter(p -> p.supportedCurrencies().contains(code))
                .findFirst()
                .orElseThrow(() -> unavailable(code));
    }

    /**
     * Withdrawals: prefer Korapay for NGN when enabled, else Kuda; other currencies use the first
     * enabled non-Korapay rail for that currency.
     */
    public PaymentRailProvider requireForWithdrawal(String currencyCode) {
        String code = normalize(currencyCode);
        if ("NGN".equals(code)) {
            return providers.stream()
                    .filter(PaymentRailProvider::isEnabled)
                    .filter(p -> p.supportedCurrencies().contains(code))
                    .filter(p -> KorapayPaymentRail.NAME.equals(p.providerName())
                            || KudaPaymentRail.NAME.equals(p.providerName()))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(
                            "PAYMENT_RAIL_UNAVAILABLE",
                            "NGN withdrawals require Korapay or Kuda. Enable KORAPAY_ENABLED or KUDA_ENABLED.",
                            HttpStatus.SERVICE_UNAVAILABLE));
        }
        return providers.stream()
                .filter(PaymentRailProvider::isEnabled)
                .filter(p -> p.supportedCurrencies().contains(code))
                .filter(p -> !KorapayPaymentRail.NAME.equals(p.providerName()))
                .findFirst()
                .orElseThrow(() -> unavailable(code));
    }

    public boolean hasEnabledRail(String currencyCode) {
        String code = normalize(currencyCode);
        return providers.stream()
                .anyMatch(p -> p.isEnabled() && p.supportedCurrencies().contains(code));
    }

    private static String normalize(String currencyCode) {
        return currencyCode == null ? "" : currencyCode.trim().toUpperCase(Locale.ROOT);
    }

    private static BusinessException unavailable(String code) {
        return new BusinessException(
                "PAYMENT_RAIL_UNAVAILABLE",
                "No enabled payment rail for currency " + code
                        + " (CAD→Apaylo, NGN→Korapay/Kuda). Configure provider credentials or use manual process.",
                HttpStatus.SERVICE_UNAVAILABLE);
    }
}
