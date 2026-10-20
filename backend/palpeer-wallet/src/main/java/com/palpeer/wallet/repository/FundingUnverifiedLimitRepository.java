package com.palpeer.wallet.repository;

import com.palpeer.wallet.domain.FundingUnverifiedLimit;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FundingUnverifiedLimitRepository extends JpaRepository<FundingUnverifiedLimit, UUID> {

    Optional<FundingUnverifiedLimit> findByCurrencyCodeIgnoreCase(String currencyCode);
}
