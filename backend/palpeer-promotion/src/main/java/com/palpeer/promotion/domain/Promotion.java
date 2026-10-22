package com.palpeer.promotion.domain;

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

@Getter
@Setter
@Entity
@Table(
        name = "promotions",
        uniqueConstraints = @UniqueConstraint(name = "uk_promotions_code", columnNames = "code")
)
public class Promotion extends BaseEntity {

    @Column(name = "code", nullable = false, length = 40)
    private String code;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "description", length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "promotion_type", nullable = false, length = 40)
    private PromotionType promotionType;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(name = "starts_at")
    private Instant startsAt;

    @Column(name = "ends_at")
    private Instant endsAt;

    @Column(name = "bonus_amount", precision = 28, scale = 12)
    private BigDecimal bonusAmount;

    /** One or more ISO codes, comma-separated (e.g. CAD,NGN). */
    @Column(name = "bonus_currency_code", length = 200)
    private String bonusCurrencyCode;

    /** JSON campaign formula (e.g. type FLAT|PERCENT, value). */
    @Column(name = "formula_json", columnDefinition = "TEXT")
    private String formulaJson;

    /** JSON eligibility rules (minKycLevel, minCompletedOrders, countries CSV). */
    @Column(name = "eligibility_json", columnDefinition = "TEXT")
    private String eligibilityJson;
}
