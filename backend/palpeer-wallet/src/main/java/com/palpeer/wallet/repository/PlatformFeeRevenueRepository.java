package com.palpeer.wallet.repository;

import com.palpeer.wallet.domain.PlatformFeeRevenue;
import com.palpeer.wallet.domain.PlatformFeeSourceType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface PlatformFeeRevenueRepository
        extends JpaRepository<PlatformFeeRevenue, UUID>, JpaSpecificationExecutor<PlatformFeeRevenue> {

    boolean existsBySourceTypeAndReferenceTypeAndReferenceId(
            PlatformFeeSourceType sourceType, String referenceType, UUID referenceId);
}
