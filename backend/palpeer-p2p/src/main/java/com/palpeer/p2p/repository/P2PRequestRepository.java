package com.palpeer.p2p.repository;

import com.palpeer.p2p.domain.P2PRequest;
import com.palpeer.p2p.domain.P2PStatus;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface P2PRequestRepository extends JpaRepository<P2PRequest, UUID>, JpaSpecificationExecutor<P2PRequest> {

    Optional<P2PRequest> findByIdAndUserId(UUID id, UUID userId);

    List<P2PRequest> findByStatusOrderByCreatedAtDesc(P2PStatus status);

    List<P2PRequest> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Query("""
            select r.id from P2PRequest r
            where r.status = com.palpeer.p2p.domain.P2PStatus.OPEN
              and r.expiresAt is not null and r.expiresAt <= :now
            """)
    List<UUID> findOpenIdsExpiredBy(@Param("now") Instant now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from P2PRequest r where r.id = :id")
    Optional<P2PRequest> findByIdForUpdate(@Param("id") UUID id);
}
