-- Phase 0 foundation: audit trail table
-- Financial, security, and admin changes will write here (fully wired in Phase 16).

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID            NOT NULL PRIMARY KEY,
    created_at      TIMESTAMPTZ     NOT NULL,
    updated_at      TIMESTAMPTZ     NOT NULL,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    ip_address      VARCHAR(45),
    device          VARCHAR(255),
    user_ref        VARCHAR(100),
    action          VARCHAR(100)    NOT NULL,
    entity          VARCHAR(100),
    old_value       TEXT,
    new_value       TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_ref ON audit_logs (user_ref);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity);
