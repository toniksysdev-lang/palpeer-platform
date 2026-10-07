package com.palpeer.currency.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

/**
 * Supported currency.
 * Verified fields: code, symbol, precision.
 */
@Getter
@Setter
@Entity
@Table(
        name = "currencies",
        uniqueConstraints = @UniqueConstraint(name = "uk_currencies_code", columnNames = "code")
)
public class Currency extends BaseEntity {

    @Column(name = "code", nullable = false, length = 10)
    private String code;

    @Column(name = "symbol", nullable = false, length = 10)
    private String symbol;

    /**
     * Number of decimal places for amounts in this currency.
     */
    @Column(name = "precision", nullable = false)
    private int precision;
}
