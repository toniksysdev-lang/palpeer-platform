package com.palpeer.chat.domain;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Chat room between two participants, scoped to either a P2P order or a negotiation.
 */
@Getter
@Setter
@Entity
@Table(
        name = "chat_rooms",
        uniqueConstraints = {
            @UniqueConstraint(name = "uk_chat_rooms_p2p_order", columnNames = "p2p_order_id"),
            @UniqueConstraint(name = "uk_chat_rooms_negotiation", columnNames = "negotiation_id")
        }
)
public class ChatRoom extends BaseEntity {

    @Column(name = "p2p_order_id")
    private UUID p2pOrderId;

    @Column(name = "negotiation_id")
    private UUID negotiationId;

    @Column(name = "participant_a_id", nullable = false)
    private UUID participantAId;

    @Column(name = "participant_b_id", nullable = false)
    private UUID participantBId;

    /** Creation time of the latest message participant A has read; only moves forward. */
    @Column(name = "participant_a_last_read_at")
    private Instant participantALastReadAt;

    /** Creation time of the latest message participant B has read; only moves forward. */
    @Column(name = "participant_b_last_read_at")
    private Instant participantBLastReadAt;
}
