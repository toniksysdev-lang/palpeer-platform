package com.palpeer.wallet.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "payment_virtual_accounts",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_pva_wallet_provider", columnNames = {"wallet_id", "provider_name"}),
                @UniqueConstraint(name = "uk_pva_tracking", columnNames = {"provider_name", "tracking_reference"})
        }
)
public class PaymentVirtualAccount extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "wallet_id", nullable = false)
    private UUID walletId;

    @Column(name = "currency_code", nullable = false, length = 10)
    private String currencyCode;

    @Column(name = "provider_name", nullable = false, length = 40)
    private String providerName;

    @Column(name = "tracking_reference", nullable = false, length = 120)
    private String trackingReference;

    @Column(name = "account_number", length = 40)
    private String accountNumber;

    @Column(name = "account_name", length = 160)
    private String accountName;

    @Column(name = "bank_code", length = 20)
    private String bankCode;

    @Column(name = "bank_name", length = 120)
    private String bankName;

    @Column(name = "active", nullable = false)
    private boolean active = true;
}
