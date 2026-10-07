package com.palpeer.chat.repository;

import com.palpeer.chat.domain.ChatMessage;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    Page<ChatMessage> findByRoomIdOrderByCreatedAtDesc(UUID roomId, Pageable pageable);

    Optional<ChatMessage> findByRoomIdAndClientMessageId(UUID roomId, String clientMessageId);

    Optional<ChatMessage> findByIdAndRoomId(UUID id, UUID roomId);
}
