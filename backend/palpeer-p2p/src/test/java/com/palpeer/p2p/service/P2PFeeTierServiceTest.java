package com.palpeer.p2p.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.palpeer.currency.service.CurrencyService;
import com.palpeer.p2p.domain.P2PFeeTier;
import com.palpeer.p2p.domain.P2PFeeType;
import com.palpeer.p2p.repository.P2PFeeTierRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class P2PFeeTierServiceTest {

    @Mock
    private P2PFeeTierRepository repository;

    @Mock
    private CurrencyService currencyService;

    private P2PFeeTierService service;

    @BeforeEach
    void setUp() {
        service = new P2PFeeTierService(repository, currencyService);
    }

    @Test
    void resolveFee_appliesPercentageOnDirectPair() {
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "CAD", "NGN"))
                .thenReturn(List.of(percentageTier("CAD", "NGN", "2", "0", null)));

        BigDecimal fee =
                service.resolveFee("CAD", "NGN", new BigDecimal("100"), new BigDecimal("1500"));

        assertThat(fee).isEqualByComparingTo("2.000000000000");
    }

    @Test
    void resolveFee_appliesCadNgnTierWhenRequestIsNgnCad() {
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "NGN", "CAD"))
                .thenReturn(List.of());
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "CAD", "NGN"))
                .thenReturn(List.of(percentageTier("CAD", "NGN", "2", "0", null)));

        // Sell 100000 NGN for CAD at 0.001 CAD/NGN → 2% of NGN base = 2000 NGN
        BigDecimal fee =
                service.resolveFee("NGN", "CAD", new BigDecimal("100000"), new BigDecimal("0.001"));

        assertThat(fee).isEqualByComparingTo("2000.000000000000");
    }

    @Test
    void resolveFee_convertsFixedFeeOnInverseRequestPair() {
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "NGN", "CAD"))
                .thenReturn(List.of());
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "CAD", "NGN"))
                .thenReturn(List.of(fixedTier("CAD", "NGN", "5", "0", null)));

        BigDecimal fee =
                service.resolveFee("NGN", "CAD", new BigDecimal("100000"), new BigDecimal("0.001"));

        assertThat(fee).isEqualByComparingTo("5000.000000000000");
    }

    private static P2PFeeTier percentageTier(
            String base, String quote, String pct, String min, String max) {
        P2PFeeTier tier = new P2PFeeTier();
        tier.setBaseCurrencyCode(base);
        tier.setQuoteCurrencyCode(quote);
        tier.setFeeType(P2PFeeType.PERCENTAGE);
        tier.setFeeValue(new BigDecimal(pct));
        tier.setMinAmount(new BigDecimal(min));
        tier.setMaxAmount(max == null ? null : new BigDecimal(max));
        tier.setActive(true);
        return tier;
    }

    private static P2PFeeTier fixedTier(
            String base, String quote, String fixed, String min, String max) {
        P2PFeeTier tier = new P2PFeeTier();
        tier.setBaseCurrencyCode(base);
        tier.setQuoteCurrencyCode(quote);
        tier.setFeeType(P2PFeeType.FIXED);
        tier.setFeeValue(new BigDecimal(fixed));
        tier.setMinAmount(new BigDecimal(min));
        tier.setMaxAmount(max == null ? null : new BigDecimal(max));
        tier.setActive(true);
        return tier;
    }
}
