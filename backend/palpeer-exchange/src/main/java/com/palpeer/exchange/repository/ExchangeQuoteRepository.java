package com.palpeer.exchange.repository;

import com.palpeer.exchange.domain.ExchangeQuote;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ExchangeQuoteRepository extends JpaRepository<ExchangeQuote, UUID> {

    Optional<ExchangeQuote> findByIdAndUserId(UUID id, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select q from ExchangeQuote q where q.id = :id and q.userId = :userId")
    Optional<ExchangeQuote> findByIdAndUserIdForUpdate(@Param("id") UUID id, @Param("userId") UUID userId);
}
