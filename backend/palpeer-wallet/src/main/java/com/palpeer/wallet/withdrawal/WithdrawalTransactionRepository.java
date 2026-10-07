package com.palpeer.wallet.withdrawal;

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
public interface WithdrawalTransactionRepository
        extends JpaRepository<WithdrawalTransaction, UUID>, JpaSpecificationExecutor<WithdrawalTransaction> {

    Optional<WithdrawalTransaction> findByIdempotencyKey(String idempotencyKey);

    Optional<WithdrawalTransaction> findByIdAndUserId(UUID id, UUID userId);

    List<WithdrawalTransaction> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<WithdrawalTransaction> findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
            UUID userId, Instant from, Instant to, Pageable pageable);

    List<WithdrawalTransaction> findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(
            UUID userId, Instant from, Instant to);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from WithdrawalTransaction w where w.id = :id and w.userId = :userId")
    Optional<WithdrawalTransaction> findByIdAndUserIdForUpdate(@Param("id") UUID id, @Param("userId") UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from WithdrawalTransaction w where w.id = :id")
    Optional<WithdrawalTransaction> findByIdForUpdate(@Param("id") UUID id);

    Optional<WithdrawalTransaction> findByProviderNameAndProviderReference(String providerName, String providerReference);
}
