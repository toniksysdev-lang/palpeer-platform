-- Allow chat rooms to be scoped to a negotiation (buyer ↔ seller) as well as a P2P order.

ALTER TABLE chat_rooms
    ADD COLUMN negotiation_id UUID;

ALTER TABLE chat_rooms
    ADD CONSTRAINT uk_chat_rooms_negotiation UNIQUE (negotiation_id);

ALTER TABLE chat_rooms
    ADD CONSTRAINT fk_chat_rooms_negotiation
        FOREIGN KEY (negotiation_id) REFERENCES negotiations (id);

-- Exactly one of order or negotiation must be set for every room.
ALTER TABLE chat_rooms
    ADD CONSTRAINT chk_chat_rooms_scope
        CHECK (
            (p2p_order_id IS NOT NULL AND negotiation_id IS NULL)
            OR (p2p_order_id IS NULL AND negotiation_id IS NOT NULL)
        );

CREATE INDEX idx_chat_rooms_negotiation ON chat_rooms (negotiation_id);
