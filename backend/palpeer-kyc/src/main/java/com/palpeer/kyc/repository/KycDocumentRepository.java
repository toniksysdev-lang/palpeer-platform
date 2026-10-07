package com.palpeer.kyc.repository;

import com.palpeer.kyc.domain.KycDocument;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface KycDocumentRepository extends JpaRepository<KycDocument, UUID> {

    List<KycDocument> findByKycCaseId(UUID kycCaseId);

    List<KycDocument> findByKycCaseIdOrderByCreatedAtAsc(UUID kycCaseId);

    Optional<KycDocument> findByIdAndKycCaseId(UUID id, UUID kycCaseId);

    Optional<KycDocument> findFirstByKycCaseIdOrderByCreatedAtDesc(UUID kycCaseId);

    long countByKycCaseId(UUID kycCaseId);
}
