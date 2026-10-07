package com.palpeer.promotion.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "referrals",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_referrals_code", columnNames = "referral_code"),
                @UniqueConstraint(name = "uk_referrals_referee", columnNames = "referee_user_id")
        }
)
public class Referral extends BaseEntity {

    @Column(name = "referrer_user_id", nullable = false)
    private UUID referrerUserId;

    @Column(name = "referee_user_id")
    private UUID refereeUserId;

    @Column(name = "referral_code", nullable = false, length = 40)
    private String referralCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ReferralStatus status;

    @Column(name = "promotion_id")
    private UUID promotionId;
}
