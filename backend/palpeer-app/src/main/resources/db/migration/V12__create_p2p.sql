-- Phase 8: P2P requests and orders

CREATE TABLE p2p_requests (
    id                   UUID            NOT NULL PRIMARY KEY,
    created_at           TIMESTAMPTZ     NOT NULL,
    updated_at           TIMESTAMPTZ     NOT NULL,
    created_by           VARCHAR(100),
    updated_by           VARCHAR(100),
    user_id              UUID            NOT NULL,
    side                 VARCHAR(10)     NOT NULL,
    base_currency_code   VARCHAR(10)     NOT NULL,
    quote_currency_code  VARCHAR(10)     NOT NULL,
    amount               NUMERIC(28, 12) NOT NULL,
    rate                 NUMERIC(28, 12) NOT NULL,
    status               VARCHAR(20)     NOT NULL,
    expires_at           TIMESTAMPTZ,
    notes                VARCHAR(500),
    CONSTRAINT fk_p2p_requests_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_p2p_requests_base FOREIGN KEY (base_currency_code) REFERENCES currencies (code),
    CONSTRAINT fk_p2p_requests_quote FOREIGN KEY (quote_currency_code) REFERENCES currencies (code),
    CONSTRAINT chk_p2p_requests_side CHECK (side IN ('BUY', 'SELL')),
    CONSTRAINT chk_p2p_requests_status CHECK (status IN (
        'OPEN', 'ACCEPTED', 'COMPLETED', 'EXPIRED', 'CANCELLED'
    )),
    CONSTRAINT chk_p2p_requests_pair CHECK (base_currency_code <> quote_currency_code),
    CONSTRAINT chk_p2p_requests_positive CHECK (amount > 0 AND rate > 0)
);

CREATE INDEX idx_p2p_requests_status ON p2p_requests (status);
CREATE INDEX idx_p2p_requests_user_id ON p2p_requests (user_id);

CREATE TABLE p2p_orders (
    id             UUID            NOT NULL PRIMARY KEY,
    created_at     TIMESTAMPTZ     NOT NULL,
    updated_at     TIMESTAMPTZ     NOT NULL,
    created_by     VARCHAR(100),
    updated_by     VARCHAR(100),
    request_id     UUID            NOT NULL,
    requester_id   UUID            NOT NULL,
    acceptor_id    UUID            NOT NULL,
    amount         NUMERIC(28, 12) NOT NULL,
    rate           NUMERIC(28, 12) NOT NULL,
    status         VARCHAR(20)     NOT NULL,
    CONSTRAINT fk_p2p_orders_request FOREIGN KEY (request_id) REFERENCES p2p_requests (id),
    CONSTRAINT fk_p2p_orders_requester FOREIGN KEY (requester_id) REFERENCES users (id),
    CONSTRAINT fk_p2p_orders_acceptor FOREIGN KEY (acceptor_id) REFERENCES users (id),
    CONSTRAINT chk_p2p_orders_status CHECK (status IN (
        'OPEN', 'ACCEPTED', 'COMPLETED', 'EXPIRED', 'CANCELLED'
    )),
    CONSTRAINT chk_p2p_orders_positive CHECK (amount > 0 AND rate > 0),
    CONSTRAINT chk_p2p_orders_parties CHECK (requester_id <> acceptor_id)
);

CREATE INDEX idx_p2p_orders_request_id ON p2p_orders (request_id);
CREATE INDEX idx_p2p_orders_requester_id ON p2p_orders (requester_id);
CREATE INDEX idx_p2p_orders_acceptor_id ON p2p_orders (acceptor_id);
