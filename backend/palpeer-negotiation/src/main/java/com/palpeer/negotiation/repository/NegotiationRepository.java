package com.palpeer.negotiation.repository;

import com.palpeer.negotiation.domain.Negotiation;
import com.palpeer.negotiation.domain.NegotiationStatus;
import jakarta.persistence.LockModeType;
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
public interface NegotiationRepository extends JpaRepository<Negotiation, UUID>, JpaSpecificationExecutor<Negotiation> {

    List<Negotiation> findByP2pRequestIdOrderByCreatedAtDesc(UUID p2pRequestId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<Negotiation> findByP2pRequestIdAndStatus(UUID p2pRequestId, NegotiationStatus status);

    List<Negotiation> findByRequesterIdOrCounterpartyIdOrderByCreatedAtDesc(UUID requesterId, UUID counterpartyId);

    Optional<Negotiation> findByP2pRequestIdAndCounterpartyIdAndStatus(
            UUID p2pRequestId, UUID counterpartyId, NegotiationStatus status);

    @Query("""
            select n from Negotiation n
            where n.id = :id
              and (n.requesterId = :userId or n.counterpartyId = :userId)
            """)
    Optional<Negotiation> findByIdAndParticipant(@Param("id") UUID id, @Param("userId") UUID userId);

    @Query("""
            select n.p2pRequestId from Negotiation n
            where n.id = :id
              and (n.requesterId = :userId or n.counterpartyId = :userId)
            """)
    Optional<UUID> findRequestIdForParticipant(@Param("id") UUID id, @Param("userId") UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from Negotiation n where n.id = :id")
    Optional<Negotiation> findByIdForUpdate(@Param("id") UUID id);
}
