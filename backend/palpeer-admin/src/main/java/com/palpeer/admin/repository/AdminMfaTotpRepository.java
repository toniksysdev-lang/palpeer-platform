package com.palpeer.admin.repository;

import com.palpeer.admin.domain.AdminMfaTotp;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminMfaTotpRepository extends JpaRepository<AdminMfaTotp, UUID> {

    Optional<AdminMfaTotp> findByUserId(UUID userId);

    boolean existsByUserIdAndEnabledTrue(UUID userId);
}
