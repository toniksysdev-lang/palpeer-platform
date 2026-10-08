package com.palpeer.wallet.funding;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface FundingTransactionRepository
        extends JpaRepository<FundingTransaction, UUID>, JpaSpecificationExecutor<FundingTransaction> {

    Optional<FundingTransaction> findByIdempotencyKey(String idempotencyKey);

    Optional<FundingTransaction> findByIdAndUserId(UUID id, UUID userId);

    List<FundingTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<FundingTransaction> findByWalletIdOrderByCreatedAtDesc(UUID walletId, Pageable pageable);

    List<FundingTransaction> findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
            UUID userId, Instant from, Instant to, Pageable pageable);

    List<FundingTransaction> findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(
            UUID userId, Instant from, Instant to);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from FundingTransaction f where f.id = :id and f.userId = :userId")
    Optional<FundingTransaction> findByIdAndUserIdForUpdate(@Param("id") UUID id, @Param("userId") UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select f from FundingTransaction f where f.id = :id")
    Optional<FundingTransaction> findByIdForUpdate(@Param("id") UUID id);

    Optional<FundingTransaction> findByProviderNameAndProviderReference(String providerName, String providerReference);
}
