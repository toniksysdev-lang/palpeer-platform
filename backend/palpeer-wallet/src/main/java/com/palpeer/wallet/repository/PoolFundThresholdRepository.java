package com.palpeer.wallet.repository;

import com.palpeer.wallet.domain.PoolFundThreshold;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PoolFundThresholdRepository extends JpaRepository<PoolFundThreshold, UUID> {

    Optional<PoolFundThreshold> findByProviderIgnoreCaseAndCurrencyCodeIgnoreCase(
            String provider, String currencyCode);
}
