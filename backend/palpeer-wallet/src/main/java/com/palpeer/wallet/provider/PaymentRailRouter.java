package com.palpeer.wallet.provider;

import com.palpeer.common.exception.BusinessException;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PaymentRailRouter {

    private final List<PaymentRailProvider> providers;

    public PaymentRailProvider requireForCurrency(String currencyCode) {
        String code = currencyCode == null ? "" : currencyCode.trim().toUpperCase(Locale.ROOT);
        return providers.stream()
                .filter(PaymentRailProvider::isEnabled)
                .filter(p -> p.supportedCurrencies().contains(code))
                .findFirst()
                .orElseThrow(() -> new BusinessException(
                        "PAYMENT_RAIL_UNAVAILABLE",
                        "No enabled payment rail for currency " + code
                                + " (CAD→Apaylo, NGN→Kuda). Configure provider credentials or use manual process.",
                        HttpStatus.SERVICE_UNAVAILABLE));
    }

    public boolean hasEnabledRail(String currencyCode) {
        String code = currencyCode == null ? "" : currencyCode.trim().toUpperCase(Locale.ROOT);
        return providers.stream()
                .anyMatch(p -> p.isEnabled() && p.supportedCurrencies().contains(code));
    }
}
