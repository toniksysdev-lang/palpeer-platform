package com.palpeer.p2p.repository;

import com.palpeer.p2p.domain.P2POrder;
import com.palpeer.p2p.domain.P2PStatus;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface P2POrderRepository extends JpaRepository<P2POrder, UUID>, JpaSpecificationExecutor<P2POrder> {

    Optional<P2POrder> findById(UUID id);

    List<P2POrder> findByRequestId(UUID requestId);

    List<P2POrder> findByRequesterIdOrAcceptorIdOrderByCreatedAtDesc(UUID requesterId, UUID acceptorId);

    @Query(
            """
            SELECT o FROM P2POrder o
            WHERE (o.requesterId = :userId AND o.requesterArchivedAt IS NULL)
               OR (o.acceptorId = :userId AND o.acceptorArchivedAt IS NULL)
            ORDER BY o.createdAt DESC
            """)
    List<P2POrder> findVisibleForUserOrderByCreatedAtDesc(@Param("userId") UUID userId);

    @Query(
            """
            SELECT o FROM P2POrder o
            WHERE (o.requesterId = :userId OR o.acceptorId = :userId)
              AND o.status IN :statuses
            ORDER BY o.createdAt DESC
            """)
    List<P2POrder> findByPartyUserIdAndStatusInOrderByCreatedAtDesc(
            @Param("userId") UUID userId,
            @Param("statuses") Collection<P2PStatus> statuses,
            Pageable pageable);

    @Query(
            """
            SELECT o FROM P2POrder o
            WHERE (o.requesterId = :userId OR o.acceptorId = :userId)
              AND o.status IN :statuses
              AND o.createdAt >= :from AND o.createdAt <= :to
            ORDER BY o.createdAt DESC
            """)
    List<P2POrder> findByPartyUserIdAndStatusInAndCreatedAtBetweenOrderByCreatedAtDesc(
            @Param("userId") UUID userId,
            @Param("statuses") Collection<P2PStatus> statuses,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);

    @Query(
            """
            SELECT o FROM P2POrder o
            WHERE (o.requesterId = :userId OR o.acceptorId = :userId)
              AND o.status IN :statuses
              AND o.createdAt >= :from AND o.createdAt <= :to
            """)
    List<P2POrder> findByPartyUserIdAndStatusInAndCreatedAtBetween(
            @Param("userId") UUID userId,
            @Param("statuses") Collection<P2PStatus> statuses,
            @Param("from") Instant from,
            @Param("to") Instant to);

    @Query(
            """
            SELECT o FROM P2POrder o
            WHERE o.id = :id AND (o.requesterId = :userId OR o.acceptorId = :userId)
            """)
    Optional<P2POrder> findByIdAndPartyUserId(@Param("id") UUID id, @Param("userId") UUID userId);
}
