-- Phase 9: negotiations and offers

CREATE TABLE negotiations (
    id                 UUID         NOT NULL PRIMARY KEY,
    created_at         TIMESTAMPTZ  NOT NULL,
    updated_at         TIMESTAMPTZ  NOT NULL,
    created_by         VARCHAR(100),
    updated_by         VARCHAR(100),
    p2p_request_id     UUID         NOT NULL,
    requester_id       UUID         NOT NULL,
    counterparty_id    UUID         NOT NULL,
    status             VARCHAR(20)  NOT NULL,
    current_offer_id   UUID,
    CONSTRAINT fk_negotiations_request FOREIGN KEY (p2p_request_id) REFERENCES p2p_requests (id),
    CONSTRAINT fk_negotiations_requester FOREIGN KEY (requester_id) REFERENCES users (id),
    CONSTRAINT fk_negotiations_counterparty FOREIGN KEY (counterparty_id) REFERENCES users (id),
    CONSTRAINT chk_negotiations_status CHECK (status IN ('OPEN', 'ACCEPTED', 'CANCELLED')),
    CONSTRAINT chk_negotiations_parties CHECK (requester_id <> counterparty_id)
);

CREATE INDEX idx_negotiations_request_id ON negotiations (p2p_request_id);
CREATE INDEX idx_negotiations_status ON negotiations (status);

CREATE TABLE negotiation_offers (
    id               UUID            NOT NULL PRIMARY KEY,
    created_at       TIMESTAMPTZ     NOT NULL,
    updated_at       TIMESTAMPTZ     NOT NULL,
    created_by       VARCHAR(100),
    updated_by       VARCHAR(100),
    negotiation_id   UUID            NOT NULL,
    offered_by       UUID            NOT NULL,
    offer_type       VARCHAR(20)     NOT NULL,
    amount           NUMERIC(28, 12) NOT NULL,
    rate             NUMERIC(28, 12) NOT NULL,
    status           VARCHAR(20)     NOT NULL,
    CONSTRAINT fk_negotiation_offers_negotiation FOREIGN KEY (negotiation_id) REFERENCES negotiations (id),
    CONSTRAINT fk_negotiation_offers_user FOREIGN KEY (offered_by) REFERENCES users (id),
    CONSTRAINT chk_negotiation_offers_type CHECK (offer_type IN ('OFFER', 'COUNTER')),
    CONSTRAINT chk_negotiation_offers_status CHECK (status IN ('PENDING', 'SUPERSEDED', 'ACCEPTED', 'REJECTED')),
    CONSTRAINT chk_negotiation_offers_positive CHECK (amount > 0 AND rate > 0)
);

CREATE INDEX idx_negotiation_offers_negotiation_id ON negotiation_offers (negotiation_id);

ALTER TABLE negotiations
    ADD CONSTRAINT fk_negotiations_current_offer
        FOREIGN KEY (current_offer_id) REFERENCES negotiation_offers (id);
