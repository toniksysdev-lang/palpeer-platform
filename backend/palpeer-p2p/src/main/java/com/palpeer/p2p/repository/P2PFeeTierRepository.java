package com.palpeer.p2p.repository;

import com.palpeer.p2p.domain.P2PFeeTier;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface P2PFeeTierRepository extends JpaRepository<P2PFeeTier, UUID> {

    List<P2PFeeTier> findAllByOrderByBaseCurrencyCodeAscQuoteCurrencyCodeAscMinAmountAsc();

    List<P2PFeeTier> findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndActiveTrueOrderByMinAmountAsc(
            String baseCurrencyCode, String quoteCurrencyCode);

    List<P2PFeeTier> findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCase(
            String baseCurrencyCode, String quoteCurrencyCode);
}
