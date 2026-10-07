package com.palpeer.card.domain;

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

/**
 * Issued card metadata. Never stores full PAN — lastFour only.
 * CONTRACT_PENDING (P13-04): virtual vs physical, funding wallet rules.
 */
@Getter
@Setter
@Entity
@Table(
        name = "cards",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_cards_provider_card",
                columnNames = {"provider_name", "provider_card_id"}
        )
)
public class Card extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "wallet_id")
    private UUID walletId;

    @Column(name = "provider_name", nullable = false, length = 80)
    private String providerName;

    @Column(name = "provider_card_id", nullable = false, length = 120)
    private String providerCardId;

    @Column(name = "last_four", nullable = false, length = 4)
    private String lastFour;

    @Column(name = "brand", length = 40)
    private String brand;

    @Column(name = "currency_code", nullable = false, length = 10)
    private String currencyCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private CardStatus status;

    @Column(name = "expiry_month")
    private Short expiryMonth;

    @Column(name = "expiry_year")
    private Short expiryYear;

    @Column(name = "cardholder_name", length = 120)
    private String cardholderName;
}
