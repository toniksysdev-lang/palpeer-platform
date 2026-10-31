package com.palpeer.kyc.repository;

import com.palpeer.kyc.domain.KycCase;
import com.palpeer.kyc.domain.KycStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface KycCaseRepository extends JpaRepository<KycCase, UUID>, JpaSpecificationExecutor<KycCase> {

    Optional<KycCase> findByUserId(UUID userId);

    Optional<KycCase> findByProviderCheckId(String providerCheckId);

    Optional<KycCase> findByProviderClientId(String providerClientId);

    List<KycCase> findByStatusOrderByUpdatedAtAsc(KycStatus status);
}
