-- Allow users to remove cancelled/expired P2P items from their history without hard-deleting ledger FKs.
ALTER TABLE p2p_requests
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE p2p_orders
    ADD COLUMN IF NOT EXISTS requester_archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS acceptor_archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_p2p_requests_user_archived
    ON p2p_requests (user_id, archived_at);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_party_archived
    ON p2p_orders (requester_id, acceptor_id, requester_archived_at, acceptor_archived_at);
