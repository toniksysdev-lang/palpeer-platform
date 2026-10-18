package com.palpeer.chat.repository;

import com.palpeer.chat.domain.ChatRoom;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatRoomRepository extends JpaRepository<ChatRoom, UUID>, JpaSpecificationExecutor<ChatRoom> {

    Optional<ChatRoom> findByP2pOrderId(UUID p2pOrderId);

    Optional<ChatRoom> findByNegotiationId(UUID negotiationId);

    @Query("""
            select r from ChatRoom r
            where r.id = :roomId
              and (r.participantAId = :userId or r.participantBId = :userId)
            """)
    Optional<ChatRoom> findByIdAndParticipant(@Param("roomId") UUID roomId, @Param("userId") UUID userId);

    @Query("""
            select r from ChatRoom r
            where r.participantAId = :userId or r.participantBId = :userId
            order by r.updatedAt desc
            """)
    List<ChatRoom> findByParticipant(@Param("userId") UUID userId);

    /** Moves participant A's read marker forward only; returns 0 when it would not advance. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update ChatRoom r set r.participantALastReadAt = :readAt
            where r.id = :roomId
              and (r.participantALastReadAt is null or r.participantALastReadAt < :readAt)
            """)
    int advanceParticipantARead(@Param("roomId") UUID roomId, @Param("readAt") Instant readAt);

    /** Moves participant B's read marker forward only; returns 0 when it would not advance. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update ChatRoom r set r.participantBLastReadAt = :readAt
            where r.id = :roomId
              and (r.participantBLastReadAt is null or r.participantBLastReadAt < :readAt)
            """)
    int advanceParticipantBRead(@Param("roomId") UUID roomId, @Param("readAt") Instant readAt);
}
