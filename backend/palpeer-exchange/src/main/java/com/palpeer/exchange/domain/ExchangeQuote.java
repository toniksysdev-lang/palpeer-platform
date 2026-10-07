package com.palpeer.exchange.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "exchange_quotes")
public class ExchangeQuote extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "source_wallet_id", nullable = false)
    private UUID sourceWalletId;

    @Column(name = "target_wallet_id", nullable = false)
    private UUID targetWalletId;

    @Column(name = "source_currency_code", nullable = false, length = 10)
    private String sourceCurrencyCode;

    @Column(name = "target_currency_code", nullable = false, length = 10)
    private String targetCurrencyCode;

    @Column(name = "source_amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal sourceAmount;

    @Column(name = "target_amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal targetAmount;

    @Column(name = "applied_rate", nullable = false, precision = 28, scale = 12)
    private BigDecimal appliedRate;

    /**
     * CONTRACT_PENDING (P7-01): buy vs sell rate selection rule.
     */
    @Column(name = "rate_side", nullable = false, length = 10)
    private String rateSide;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ExchangeQuoteStatus status;
}
