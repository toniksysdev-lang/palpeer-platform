package com.palpeer.p2p.repository;

import com.palpeer.p2p.domain.P2PRateBounds;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface P2PRateBoundsRepository extends JpaRepository<P2PRateBounds, UUID> {

    List<P2PRateBounds> findAllByOrderByBaseCurrencyCodeAscQuoteCurrencyCodeAsc();

    Optional<P2PRateBounds> findByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCase(
            String baseCurrencyCode, String quoteCurrencyCode);
}
