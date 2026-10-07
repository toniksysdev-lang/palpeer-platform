package com.palpeer.p2p.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "p2p_rate_bounds",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_p2p_rate_bounds_pair",
                columnNames = {"base_currency_code", "quote_currency_code"}
        )
)
public class P2PRateBounds extends BaseEntity {

    @Column(name = "base_currency_code", nullable = false, length = 10)
    private String baseCurrencyCode;

    @Column(name = "quote_currency_code", nullable = false, length = 10)
    private String quoteCurrencyCode;

    @Column(name = "min_rate", nullable = false, precision = 28, scale = 12)
    private BigDecimal minRate;

    @Column(name = "max_rate", nullable = false, precision = 28, scale = 12)
    private BigDecimal maxRate;
}
