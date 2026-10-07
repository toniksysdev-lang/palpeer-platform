-- Phase 10: chat rooms and messages

CREATE TABLE chat_rooms (
    id                  UUID         NOT NULL PRIMARY KEY,
    created_at          TIMESTAMPTZ  NOT NULL,
    updated_at          TIMESTAMPTZ  NOT NULL,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    p2p_order_id        UUID,
    participant_a_id    UUID         NOT NULL,
    participant_b_id    UUID         NOT NULL,
    CONSTRAINT uk_chat_rooms_p2p_order UNIQUE (p2p_order_id),
    CONSTRAINT fk_chat_rooms_order FOREIGN KEY (p2p_order_id) REFERENCES p2p_orders (id),
    CONSTRAINT fk_chat_rooms_participant_a FOREIGN KEY (participant_a_id) REFERENCES users (id),
    CONSTRAINT fk_chat_rooms_participant_b FOREIGN KEY (participant_b_id) REFERENCES users (id),
    CONSTRAINT chk_chat_rooms_parties CHECK (participant_a_id <> participant_b_id)
);

CREATE INDEX idx_chat_rooms_participant_a ON chat_rooms (participant_a_id);
CREATE INDEX idx_chat_rooms_participant_b ON chat_rooms (participant_b_id);

CREATE TABLE chat_messages (
    id                 UUID          NOT NULL PRIMARY KEY,
    created_at         TIMESTAMPTZ   NOT NULL,
    updated_at         TIMESTAMPTZ   NOT NULL,
    created_by         VARCHAR(100),
    updated_by         VARCHAR(100),
    room_id            UUID          NOT NULL,
    sender_id          UUID          NOT NULL,
    content            VARCHAR(4000) NOT NULL,
    client_message_id  VARCHAR(100),
    CONSTRAINT fk_chat_messages_room FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
    CONSTRAINT fk_chat_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id)
);

CREATE UNIQUE INDEX uk_chat_messages_room_client_msg
    ON chat_messages (room_id, client_message_id)
    WHERE client_message_id IS NOT NULL;

CREATE INDEX idx_chat_messages_room_created
    ON chat_messages (room_id, created_at DESC);
