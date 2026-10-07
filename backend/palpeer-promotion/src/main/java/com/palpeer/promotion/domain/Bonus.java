package com.palpeer.promotion.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "bonuses")
public class Bonus extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "promotion_id")
    private UUID promotionId;

    @Column(name = "referral_id")
    private UUID referralId;

    @Column(name = "amount", nullable = false, precision = 28, scale = 12)
    private BigDecimal amount;

    @Column(name = "currency_code", nullable = false, length = 10)
    private String currencyCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private BonusStatus status;

    @Column(name = "reason", length = 200)
    private String reason;

    /** Reserved for ledger CREDIT when P14-03 settlement is confirmed. */
    @Column(name = "ledger_entry_id")
    private UUID ledgerEntryId;
}
