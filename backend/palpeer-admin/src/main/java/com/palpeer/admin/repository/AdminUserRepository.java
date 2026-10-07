package com.palpeer.admin.repository;

import com.palpeer.admin.domain.AdminUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminUserRepository extends JpaRepository<AdminUser, UUID> {

    Optional<AdminUser> findByUserIdAndEnabledTrue(UUID userId);

    Optional<AdminUser> findByUserId(UUID userId);

    boolean existsByUserId(UUID userId);

    long countByEnabledTrue();
}
