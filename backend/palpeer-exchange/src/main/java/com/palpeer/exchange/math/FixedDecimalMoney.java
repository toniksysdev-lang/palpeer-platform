package com.palpeer.exchange.math;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Fixed-decimal FX helpers. Rounding mode is provisional (P7-02).
 */
public final class FixedDecimalMoney {

    /** CONTRACT_PENDING (P7-02): confirm rounding mode for FX. */
    public static final RoundingMode FX_ROUNDING = RoundingMode.HALF_EVEN;

    private FixedDecimalMoney() {
    }

    public static BigDecimal scaleAmount(BigDecimal amount, int precision) {
        if (amount == null) {
            throw new IllegalArgumentException("amount required");
        }
        if (precision < 0) {
            throw new IllegalArgumentException("precision must be >= 0");
        }
        return amount.setScale(precision, FX_ROUNDING);
    }

    /**
     * target = source * rate, scaled to targetPrecision.
     */
    public static BigDecimal convertSourceToTarget(BigDecimal sourceAmount, BigDecimal rate, int targetPrecision) {
        return scaleAmount(sourceAmount.multiply(rate), targetPrecision);
    }

    /**
     * source = target / rate, scaled to sourcePrecision.
     */
    public static BigDecimal convertTargetToSource(BigDecimal targetAmount, BigDecimal rate, int sourcePrecision) {
        if (rate.compareTo(BigDecimal.ZERO) == 0) {
            throw new IllegalArgumentException("rate must be non-zero");
        }
        return scaleAmount(targetAmount.divide(rate, sourcePrecision + 8, FX_ROUNDING), sourcePrecision);
    }
}
