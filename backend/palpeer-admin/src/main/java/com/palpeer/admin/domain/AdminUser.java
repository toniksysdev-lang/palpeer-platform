package com.palpeer.admin.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Links a platform {@code User} to admin roles.
 * CONTRACT_PENDING (P15-02): separate admin credentials vs same user login.
 */
@Getter
@Setter
@Entity
@Table(
        name = "admin_users",
        uniqueConstraints = @UniqueConstraint(name = "uk_admin_users_user", columnNames = "user_id")
)
public class AdminUser extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "admin_user_roles",
            joinColumns = @JoinColumn(name = "admin_user_id"),
            inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();
}
