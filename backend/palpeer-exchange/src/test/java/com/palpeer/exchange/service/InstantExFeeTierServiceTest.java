package com.palpeer.exchange.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.palpeer.currency.service.CurrencyService;
import com.palpeer.exchange.domain.InstantExFeeTier;
import com.palpeer.exchange.domain.InstantExFeeType;
import com.palpeer.exchange.repository.InstantExFeeTierRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InstantExFeeTierServiceTest {

    @Mock
    private InstantExFeeTierRepository repository;

    @Mock
    private CurrencyService currencyService;

    private InstantExFeeTierService service;

    @BeforeEach
    void setUp() {
        service = new InstantExFeeTierService(repository, currencyService);
    }

    @Test
    void resolveFee_appliesPercentageOnDirectPair() {
        InstantExFeeTier tier = percentageTier("CAD", "NGN", "1.5", "0", null);
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "CAD", "NGN"))
                .thenReturn(List.of(tier));

        BigDecimal fee =
                service.resolveFee("CAD", "NGN", new BigDecimal("100.00"), new BigDecimal("1050"));

        assertThat(fee).isEqualByComparingTo("1.500000000000");
    }

    @Test
    void resolveFee_appliesSameCadNgnTierOnReverseNgnToCad() {
        InstantExFeeTier tier = percentageTier("CAD", "NGN", "1.5", "0", null);
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "NGN", "CAD"))
                .thenReturn(List.of());
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "CAD", "NGN"))
                .thenReturn(List.of(tier));

        // NGN→CAD at 0.000952 CAD per NGN; 1.5% of 105000 NGN = 1575 NGN
        BigDecimal fee = service.resolveFee(
                "NGN", "CAD", new BigDecimal("105000"), new BigDecimal("0.000952380952"));

        assertThat(fee).isEqualByComparingTo("1575.000000000000");
    }

    @Test
    void resolveFee_convertsFixedFeeOnReverseDirection() {
        InstantExFeeTier tier = fixedTier("CAD", "NGN", "5", "0", null);
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "NGN", "CAD"))
                .thenReturn(List.of());
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "CAD", "NGN"))
                .thenReturn(List.of(tier));

        // 5 CAD / 0.001 CAD-per-NGN = 5000 NGN
        BigDecimal fee =
                service.resolveFee("NGN", "CAD", new BigDecimal("100000"), new BigDecimal("0.001"));

        assertThat(fee).isEqualByComparingTo("5000.000000000000");
    }

    @Test
    void resolveFee_matchesReverseRangeUsingCadEquivalent() {
        InstantExFeeTier tier = percentageTier("CAD", "NGN", "2", "50", "200");
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "NGN", "CAD"))
                .thenReturn(List.of());
        when(repository
                        .findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
                                "CAD", "NGN"))
                .thenReturn(List.of(tier));

        // 100000 NGN * 0.001 = 100 CAD → inside 50–200
        BigDecimal fee =
                service.resolveFee("NGN", "CAD", new BigDecimal("100000"), new BigDecimal("0.001"));

        assertThat(fee).isEqualByComparingTo("2000.000000000000");
    }

    private static InstantExFeeTier percentageTier(
            String base, String quote, String pct, String min, String max) {
        InstantExFeeTier tier = new InstantExFeeTier();
        tier.setBaseCurrencyCode(base);
        tier.setQuoteCurrencyCode(quote);
        tier.setFeeType(InstantExFeeType.PERCENTAGE);
        tier.setFeeValue(new BigDecimal(pct));
        tier.setMinAmount(new BigDecimal(min));
        tier.setMaxAmount(max == null ? null : new BigDecimal(max));
        tier.setActive(true);
        return tier;
    }

    private static InstantExFeeTier fixedTier(
            String base, String quote, String fixed, String min, String max) {
        InstantExFeeTier tier = new InstantExFeeTier();
        tier.setBaseCurrencyCode(base);
        tier.setQuoteCurrencyCode(quote);
        tier.setFeeType(InstantExFeeType.FIXED);
        tier.setFeeValue(new BigDecimal(fixed));
        tier.setMinAmount(new BigDecimal(min));
        tier.setMaxAmount(max == null ? null : new BigDecimal(max));
        tier.setActive(true);
        return tier;
    }
}
