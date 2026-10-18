package com.palpeer.wallet.withdrawal;

import com.palpeer.wallet.funding.MoneyMovementStatus;
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

    List<WithdrawalTransaction> findByWalletIdOrderByCreatedAtDesc(UUID walletId, Pageable pageable);

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

    /**
     * Successful withdrawal totals keyed by provider + currency.
     * Rows: [providerName (nullable), currencyCode, sum(amount)].
     */
    @Query("""
            select w.providerName, w.currencyCode, coalesce(sum(w.amount), 0)
            from WithdrawalTransaction w
            where w.status = :status
            group by w.providerName, w.currencyCode
            """)
    List<Object[]> sumAmountByProviderAndCurrency(@Param("status") MoneyMovementStatus status);

    @Query("""
            select coalesce(sum(w.amount), 0)
            from WithdrawalTransaction w
            where w.userId = :userId
              and upper(w.currencyCode) = upper(:currencyCode)
              and w.status = :status
            """)
    java.math.BigDecimal sumAmountByUserCurrencyAndStatus(
            @Param("userId") UUID userId,
            @Param("currencyCode") String currencyCode,
            @Param("status") MoneyMovementStatus status);
}
