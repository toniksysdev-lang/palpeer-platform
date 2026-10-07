package com.palpeer.exchange.math;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class FixedDecimalMoneyTest {

    @Test
    void convertSourceToTarget_scalesToPrecision() {
        BigDecimal result = FixedDecimalMoney.convertSourceToTarget(
                new BigDecimal("100.00"),
                new BigDecimal("1500.123456"),
                2);
        // 150012.3456 → not exact half; trailing 6 forces round-away → 150012.35
        assertThat(result).isEqualByComparingTo("150012.35");
    }

    @Test
    void scaleAmount_halfEven() {
        assertThat(FixedDecimalMoney.scaleAmount(new BigDecimal("1.235"), 2))
                .isEqualByComparingTo("1.24");
        assertThat(FixedDecimalMoney.scaleAmount(new BigDecimal("1.245"), 2))
                .isEqualByComparingTo("1.24");
    }

    @Test
    void convertTargetToSource_roundTripsApproximately() {
        BigDecimal rate = new BigDecimal("1500.00");
        BigDecimal source = FixedDecimalMoney.convertTargetToSource(
                new BigDecimal("150000.00"), rate, 2);
        assertThat(source).isEqualByComparingTo("100.00");
    }

    @Test
    void convertTargetToSource_rejectsZeroRate() {
        assertThatThrownBy(() -> FixedDecimalMoney.convertTargetToSource(
                        BigDecimal.TEN, BigDecimal.ZERO, 2))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
