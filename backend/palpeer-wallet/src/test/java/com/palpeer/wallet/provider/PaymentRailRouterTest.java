package com.palpeer.wallet.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.palpeer.wallet.provider.korapay.KorapayPaymentRail;
import com.palpeer.wallet.provider.kuda.KudaPaymentRail;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PaymentRailRouterTest {

    @Mock private PaymentRailProvider korapay;
    @Mock private PaymentRailProvider kuda;

    @Test
    void requireForWithdrawal_prefersKorapayWhenEnabled() {
        when(korapay.isEnabled()).thenReturn(true);
        when(korapay.providerName()).thenReturn(KorapayPaymentRail.NAME);
        when(korapay.supportedCurrencies()).thenReturn(Set.of("NGN"));

        PaymentRailRouter router = new PaymentRailRouter(List.of(korapay, kuda));

        assertThat(router.requireForWithdrawal("NGN").providerName()).isEqualTo(KorapayPaymentRail.NAME);
    }

    @Test
    void requireForWithdrawal_fallsBackToKudaWhenKorapayDisabled() {
        when(korapay.isEnabled()).thenReturn(false);
        when(kuda.isEnabled()).thenReturn(true);
        when(kuda.providerName()).thenReturn(KudaPaymentRail.NAME);
        when(kuda.supportedCurrencies()).thenReturn(Set.of("NGN"));

        PaymentRailRouter router = new PaymentRailRouter(List.of(korapay, kuda));

        assertThat(router.requireForWithdrawal("NGN").providerName()).isEqualTo(KudaPaymentRail.NAME);
    }
}
