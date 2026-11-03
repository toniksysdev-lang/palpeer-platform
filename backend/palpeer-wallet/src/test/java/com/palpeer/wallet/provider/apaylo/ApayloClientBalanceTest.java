package com.palpeer.wallet.provider.apaylo;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class ApayloClientBalanceTest {

    @Test
    void chooseUsableBalance_prefersNonNegativeAvailable() {
        assertThat(ApayloClient.chooseUsableBalance(new BigDecimal("10.00"), new BigDecimal("17.00")))
                .isEqualByComparingTo("10.00");
    }

    @Test
    void chooseUsableBalance_fallsBackToActualWhenAvailableNegative() {
        assertThat(ApayloClient.chooseUsableBalance(new BigDecimal("-1483.00"), new BigDecimal("17.00")))
                .isEqualByComparingTo("17.00");
    }

    @Test
    void chooseUsableBalance_keepsNegativeAvailableWhenActualMissing() {
        assertThat(ApayloClient.chooseUsableBalance(new BigDecimal("-5.00"), null))
                .isEqualByComparingTo("-5.00");
    }
}
