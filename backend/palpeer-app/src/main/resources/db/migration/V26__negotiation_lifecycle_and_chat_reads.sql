-- Negotiation reject/cancel/auto-close, accepted order link; chat read receipts

ALTER TABLE negotiations
    ADD COLUMN p2p_order_id  UUID,
    ADD COLUMN closed_reason VARCHAR(20),
    ADD COLUMN closed_by     UUID,
    ADD CONSTRAINT fk_negotiations_order FOREIGN KEY (p2p_order_id) REFERENCES p2p_orders (id),
    ADD CONSTRAINT fk_negotiations_closed_by FOREIGN KEY (closed_by) REFERENCES users (id),
    ADD CONSTRAINT chk_negotiations_closed_reason
        CHECK (closed_reason IS NULL OR closed_reason IN ('REJECTED', 'CANCELLED', 'REQUEST_CLOSED'));

CREATE INDEX idx_negotiations_request_status ON negotiations (p2p_request_id, status);

ALTER TABLE chat_rooms
    ADD COLUMN participant_a_last_read_at TIMESTAMPTZ,
    ADD COLUMN participant_b_last_read_at TIMESTAMPTZ;
