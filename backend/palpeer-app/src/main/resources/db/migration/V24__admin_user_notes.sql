-- Append-only operator notes / incident records on app users, plus permissions

CREATE TABLE admin_user_notes (
    id              UUID          NOT NULL PRIMARY KEY,
    created_at      TIMESTAMPTZ   NOT NULL,
    updated_at      TIMESTAMPTZ   NOT NULL,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    user_id         UUID          NOT NULL,
    author_user_id  UUID          NOT NULL,
    author_email    VARCHAR(320)  NOT NULL,
    category        VARCHAR(40)   NOT NULL,
    body            VARCHAR(4000) NOT NULL,
    CONSTRAINT fk_admin_user_notes_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_admin_user_notes_author FOREIGN KEY (author_user_id) REFERENCES users (id)
);

CREATE INDEX idx_admin_user_notes_user_created ON admin_user_notes (user_id, created_at DESC);

INSERT INTO admin_permissions (id, created_at, updated_at, code, description)
VALUES
    ('a1000000-0000-0000-0000-000000000014', NOW(), NOW(), 'users:notes:read', 'View internal notes / incident records on app users'),
    ('a1000000-0000-0000-0000-000000000015', NOW(), NOW(), 'users:notes:write', 'Add internal notes / incident records to app users')
ON CONFLICT (code) DO NOTHING;

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM admin_roles r
CROSS JOIN admin_permissions p
WHERE r.code = 'SUPER_ADMIN'
  AND p.code IN ('users:notes:read', 'users:notes:write')
ON CONFLICT DO NOTHING;
