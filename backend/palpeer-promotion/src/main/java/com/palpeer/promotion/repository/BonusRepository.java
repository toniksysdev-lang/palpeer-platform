package com.palpeer.promotion.repository;

import com.palpeer.promotion.domain.Bonus;
import com.palpeer.promotion.domain.BonusStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface BonusRepository extends JpaRepository<Bonus, UUID>, JpaSpecificationExecutor<Bonus> {

    Page<Bonus> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<Bonus> findByUserIdOrderByCreatedAtDesc(UUID userId);

    List<Bonus> findByReferralIdAndUserIdAndStatus(UUID referralId, UUID userId, BonusStatus status);

    List<Bonus> findByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, BonusStatus status);

    @Query("""
            SELECT b FROM Bonus b
            WHERE b.userId = :userId
              AND b.status = :status
              AND UPPER(b.currencyCode) = UPPER(:currencyCode)
            ORDER BY b.createdAt ASC
            """)
    List<Bonus> findPendingByUserAndCurrency(
            @Param("userId") UUID userId,
            @Param("status") BonusStatus status,
            @Param("currencyCode") String currencyCode);

    @Query("""
            SELECT b FROM Bonus b
            WHERE b.userId = :userId
              AND b.status = :status
              AND b.createdAt >= :from
              AND b.createdAt <= :to
            ORDER BY b.createdAt DESC
            """)
    List<Bonus> findByUserIdAndStatusAndCreatedAtBetween(
            @Param("userId") UUID userId,
            @Param("status") BonusStatus status,
            @Param("from") Instant from,
            @Param("to") Instant to);

    Page<Bonus> findByUserIdAndStatusAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
            UUID userId, BonusStatus status, Instant from, Instant to, Pageable pageable);

    @Query("""
            SELECT b FROM Bonus b
            WHERE (:status IS NULL OR b.status = :status)
              AND (:userId IS NULL OR b.userId = :userId)
              AND (:referralId IS NULL OR b.referralId = :referralId)
            """)
    Page<Bonus> adminSearch(
            @Param("status") BonusStatus status,
            @Param("userId") UUID userId,
            @Param("referralId") UUID referralId,
            Pageable pageable);
}
