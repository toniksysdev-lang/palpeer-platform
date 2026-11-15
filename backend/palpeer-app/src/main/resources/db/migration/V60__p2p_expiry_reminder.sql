-- Track 30-minute-before-expiry push/email so each OPEN offer reminds once.
ALTER TABLE p2p_requests
    ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_p2p_requests_expiry_reminder
    ON p2p_requests (status, expires_at)
    WHERE status = 'OPEN' AND expiry_reminder_sent_at IS NULL AND expires_at IS NOT NULL;
