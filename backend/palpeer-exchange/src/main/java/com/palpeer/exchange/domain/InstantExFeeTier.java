package com.palpeer.exchange.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "instantex_fee_tiers")
public class InstantExFeeTier extends BaseEntity {

    @Column(name = "base_currency_code", nullable = false, length = 10)
    private String baseCurrencyCode;

    @Column(name = "quote_currency_code", nullable = false, length = 10)
    private String quoteCurrencyCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "fee_type", nullable = false, length = 16)
    private InstantExFeeType feeType;

    @Column(name = "fee_value", nullable = false, precision = 28, scale = 12)
    private BigDecimal feeValue;

    /** Inclusive lower bound of the source (base) amount. */
    @Column(name = "min_amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal minAmount;

    @Column(name = "max_amount", precision = 28, scale = 12)
    private BigDecimal maxAmount;

    @Column(name = "active", nullable = false)
    private boolean active = true;
}
