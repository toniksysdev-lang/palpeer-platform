package com.palpeer.wallet.domain;

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
        name = "funding_unverified_limits",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uq_funding_unverified_limits_ccy",
                        columnNames = {"currency_code"}))
public class FundingUnverifiedLimit extends BaseEntity {

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    /** Lifetime SUCCESS funding ceiling while KYC is not APPROVED. */
    @Column(name = "max_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal maxAmount;
}
