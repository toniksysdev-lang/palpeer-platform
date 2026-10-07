package com.palpeer.p2p.domain;

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
@Table(name = "p2p_fee_tiers")
public class P2PFeeTier extends BaseEntity {

    @Column(name = "base_currency_code", nullable = false, length = 10)
    private String baseCurrencyCode;

    @Column(name = "quote_currency_code", nullable = false, length = 10)
    private String quoteCurrencyCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "fee_type", nullable = false, length = 16)
    private P2PFeeType feeType;

    @Column(name = "fee_value", nullable = false, precision = 28, scale = 12)
    private BigDecimal feeValue;

    /** Inclusive lower bound of the P2P request amount (base currency). */
    @Column(name = "min_amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal minAmount;

    /** Inclusive upper bound; null means no upper limit. */
    @Column(name = "max_amount", precision = 28, scale = 12)
    private BigDecimal maxAmount;

    @Column(name = "active", nullable = false)
    private boolean active = true;
}
