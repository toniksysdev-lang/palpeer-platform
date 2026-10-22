package com.palpeer.chat.repository;

import com.palpeer.chat.domain.ChatMessage;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    Page<ChatMessage> findByRoomIdOrderByCreatedAtDesc(UUID roomId, Pageable pageable);

    Optional<ChatMessage> findByRoomIdAndClientMessageId(UUID roomId, String clientMessageId);

    Optional<ChatMessage> findByIdAndRoomId(UUID id, UUID roomId);

    /**
     * Unread for {@code userId} in one room when they have never marked it read — every message
     * from the other party. Split from the timestamped query so PostgreSQL never sees a null
     * {@code Instant} bind in {@code :lastReadAt is null} (SQLState 42P18).
     */
    @Query("""
            select count(m) from ChatMessage m
            where m.roomId = :roomId
              and m.senderId <> :userId
            """)
    long countUnreadInRoom(
            @Param("roomId") UUID roomId,
            @Param("userId") UUID userId);

    /** Unread for {@code userId} in one room: messages from the other party after {@code lastReadAt}. */
    @Query("""
            select count(m) from ChatMessage m
            where m.roomId = :roomId
              and m.senderId <> :userId
              and m.createdAt > :lastReadAt
            """)
    long countUnreadInRoomAfter(
            @Param("roomId") UUID roomId,
            @Param("userId") UUID userId,
            @Param("lastReadAt") Instant lastReadAt);

    /** Total unread across every room the user participates in. */
    @Query("""
            select count(m) from ChatMessage m, ChatRoom r
            where m.roomId = r.id
              and m.senderId <> :userId
              and (
                (r.participantAId = :userId
                  and (r.participantALastReadAt is null or m.createdAt > r.participantALastReadAt))
                or
                (r.participantBId = :userId
                  and (r.participantBLastReadAt is null or m.createdAt > r.participantBLastReadAt))
              )
            """)
    long countUnreadForUser(@Param("userId") UUID userId);
}
