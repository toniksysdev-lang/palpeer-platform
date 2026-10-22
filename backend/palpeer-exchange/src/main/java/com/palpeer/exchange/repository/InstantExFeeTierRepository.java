package com.palpeer.exchange.repository;

import com.palpeer.exchange.domain.InstantExFeeTier;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InstantExFeeTierRepository extends JpaRepository<InstantExFeeTier, UUID> {

    List<InstantExFeeTier> findAllByOrderByBaseCurrencyCodeAscQuoteCurrencyCodeAscMinAmountAsc();

    List<InstantExFeeTier> findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
            String baseCurrencyCode, String quoteCurrencyCode);

    List<InstantExFeeTier> findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCase(
            String baseCurrencyCode, String quoteCurrencyCode);
}
