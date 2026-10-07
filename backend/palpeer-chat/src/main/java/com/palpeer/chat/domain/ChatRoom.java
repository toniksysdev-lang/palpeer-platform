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
 * Chat room between participants.
 * CONTRACT_PENDING (P10-01): room scope (P2P order vs free-form DM).
 * Provisional: optional p2pOrderId link; two participants.
 */
@Getter
@Setter
@Entity
@Table(
        name = "chat_rooms",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_chat_rooms_p2p_order",
                columnNames = "p2p_order_id"
        )
)
public class ChatRoom extends BaseEntity {

    @Column(name = "p2p_order_id")
    private UUID p2pOrderId;

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
