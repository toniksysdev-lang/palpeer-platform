package com.palpeer.wallet.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "pool_fund_thresholds",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uq_pool_fund_thresholds_provider_ccy",
                        columnNames = {"provider", "currency_code"}))
public class PoolFundThreshold extends BaseEntity {

    @Column(name = "provider", nullable = false, length = 40)
    private String provider;

    @Column(name = "currency_code", nullable = false, length = 3)
    private String currencyCode;

    @Column(name = "threshold_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal thresholdAmount;

    /** App user IDs of admin operators to email when the threshold is hit. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "pool_fund_threshold_notify_admins",
            joinColumns = @JoinColumn(name = "threshold_id"))
    @Column(name = "admin_user_id", nullable = false)
    private Set<UUID> notifyAdminUserIds = new HashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(
            name = "pool_fund_threshold_notify_phones",
            joinColumns = @JoinColumn(name = "threshold_id"))
    @Column(name = "phone", nullable = false, length = 32)
    private Set<String> notifyPhones = new LinkedHashSet<>();

    public void replaceNotifyAdmins(Set<UUID> adminUserIds) {
        notifyAdminUserIds.clear();
        if (adminUserIds != null) {
            notifyAdminUserIds.addAll(adminUserIds.stream().filter(id -> id != null).toList());
        }
    }

    public void replaceNotifyPhones(List<String> phones) {
        notifyPhones.clear();
        if (phones == null) {
            return;
        }
        for (String phone : phones) {
            if (phone != null && !phone.isBlank()) {
                notifyPhones.add(phone.trim());
            }
        }
    }
}
