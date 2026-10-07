package com.palpeer.promotion.repository;

import com.palpeer.promotion.domain.Bonus;
import com.palpeer.promotion.domain.BonusStatus;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface BonusRepository extends JpaRepository<Bonus, UUID> {

    Page<Bonus> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

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
