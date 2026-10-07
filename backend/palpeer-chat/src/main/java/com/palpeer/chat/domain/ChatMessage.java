package com.palpeer.chat.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "chat_messages")
public class ChatMessage extends BaseEntity {

    @Column(name = "room_id", nullable = false)
    private UUID roomId;

    @Column(name = "sender_id", nullable = false)
    private UUID senderId;

    @Column(name = "content", nullable = false, length = 4000)
    private String content;

    @Column(name = "client_message_id", length = 100)
    private String clientMessageId;
}
