package com.palpeer.currency.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

/**
 * Exchange rate quote.
 * Verified fields: buyRate, sellRate, effectiveDate.
 *
 * CONTRACT_PENDING (P4-01): pair model — provisional base/quote currency codes
 * until product confirms (e.g. vs USD only, or arbitrary pairs).
 */
@Getter
@Setter
@Entity
@Table(
        name = "exchange_rates",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_exchange_rates_pair_channel_effective",
                columnNames = {"base_currency_code", "quote_currency_code", "channel", "effective_date"}
        )
)
public class ExchangeRate extends BaseEntity {

    @Column(name = "base_currency_code", nullable = false, length = 10)
    private String baseCurrencyCode;

    @Column(name = "quote_currency_code", nullable = false, length = 10)
    private String quoteCurrencyCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel", nullable = false, length = 16)
    private RateChannel channel = RateChannel.SWAP;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", nullable = false, length = 16)
    private RateApprovalStatus approvalStatus = RateApprovalStatus.APPROVED;

    @Column(name = "buy_rate", nullable = false, precision = 28, scale = 12)
    private BigDecimal buyRate;

    @Column(name = "sell_rate", nullable = false, precision = 28, scale = 12)
    private BigDecimal sellRate;

    @Column(name = "effective_date", nullable = false)
    private Instant effectiveDate;
}
