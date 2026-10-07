package com.palpeer.admin.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "admin_permissions",
        uniqueConstraints = @UniqueConstraint(name = "uk_admin_permissions_code", columnNames = "code")
)
public class Permission extends BaseEntity {

    @Column(name = "code", nullable = false, length = 80)
    private String code;

    @Column(name = "description", length = 255)
    private String description;
}
