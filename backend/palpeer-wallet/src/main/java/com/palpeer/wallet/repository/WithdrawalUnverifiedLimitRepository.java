package com.palpeer.wallet.repository;

import com.palpeer.wallet.domain.WithdrawalUnverifiedLimit;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WithdrawalUnverifiedLimitRepository extends JpaRepository<WithdrawalUnverifiedLimit, UUID> {

    Optional<WithdrawalUnverifiedLimit> findByCurrencyCodeIgnoreCase(String currencyCode);
}
