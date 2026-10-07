package com.palpeer.exchange.repository;

import com.palpeer.exchange.domain.ExchangeTransaction;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface ExchangeTransactionRepository
        extends JpaRepository<ExchangeTransaction, UUID>, JpaSpecificationExecutor<ExchangeTransaction> {

    Optional<ExchangeTransaction> findByIdempotencyKey(String idempotencyKey);

    Optional<ExchangeTransaction> findByIdAndUserId(UUID id, UUID userId);

    List<ExchangeTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<ExchangeTransaction> findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
            UUID userId, Instant from, Instant to, Pageable pageable);

    List<ExchangeTransaction> findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(
            UUID userId, Instant from, Instant to);
}
