package com.palpeer.kyc.repository;

import com.palpeer.kyc.domain.Selfie;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SelfieRepository extends JpaRepository<Selfie, UUID> {

    List<Selfie> findByKycCaseId(UUID kycCaseId);

    Optional<Selfie> findFirstByKycCaseIdOrderByCreatedAtDesc(UUID kycCaseId);

    long countByKycCaseId(UUID kycCaseId);
}
