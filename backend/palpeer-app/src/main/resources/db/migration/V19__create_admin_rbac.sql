-- Phase 15: Admin RBAC (AdminUser, Role, Permission)

CREATE TABLE admin_permissions (
    id              UUID          NOT NULL PRIMARY KEY,
    created_at      TIMESTAMPTZ   NOT NULL,
    updated_at      TIMESTAMPTZ   NOT NULL,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    code            VARCHAR(80)   NOT NULL,
    description     VARCHAR(255),
    CONSTRAINT uk_admin_permissions_code UNIQUE (code)
);

CREATE TABLE admin_roles (
    id              UUID          NOT NULL PRIMARY KEY,
    created_at      TIMESTAMPTZ   NOT NULL,
    updated_at      TIMESTAMPTZ   NOT NULL,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    code            VARCHAR(80)   NOT NULL,
    name            VARCHAR(120)  NOT NULL,
    description     VARCHAR(255),
    CONSTRAINT uk_admin_roles_code UNIQUE (code)
);

CREATE TABLE admin_role_permissions (
    role_id         UUID NOT NULL,
    permission_id   UUID NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_arp_role FOREIGN KEY (role_id) REFERENCES admin_roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_arp_permission FOREIGN KEY (permission_id) REFERENCES admin_permissions (id) ON DELETE CASCADE
);

CREATE TABLE admin_users (
    id              UUID          NOT NULL PRIMARY KEY,
    created_at      TIMESTAMPTZ   NOT NULL,
    updated_at      TIMESTAMPTZ   NOT NULL,
    created_by      VARCHAR(100),
    updated_by      VARCHAR(100),
    user_id         UUID          NOT NULL,
    enabled         BOOLEAN       NOT NULL,
    CONSTRAINT uk_admin_users_user UNIQUE (user_id),
    CONSTRAINT fk_admin_users_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE admin_user_roles (
    admin_user_id   UUID NOT NULL,
    role_id         UUID NOT NULL,
    PRIMARY KEY (admin_user_id, role_id),
    CONSTRAINT fk_aur_admin_user FOREIGN KEY (admin_user_id) REFERENCES admin_users (id) ON DELETE CASCADE,
    CONSTRAINT fk_aur_role FOREIGN KEY (role_id) REFERENCES admin_roles (id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_users_enabled ON admin_users (enabled);

-- Seed provisional permission catalog (P15-01)
INSERT INTO admin_permissions (id, created_at, updated_at, code, description) VALUES
    ('a1000000-0000-0000-0000-000000000001', NOW(), NOW(), 'users:read', 'List/view users'),
    ('a1000000-0000-0000-0000-000000000002', NOW(), NOW(), 'users:write', 'Update user status/enabled'),
    ('a1000000-0000-0000-0000-000000000003', NOW(), NOW(), 'kyc:read', 'List/view KYC cases'),
    ('a1000000-0000-0000-0000-000000000004', NOW(), NOW(), 'kyc:review', 'Approve/reject KYC'),
    ('a1000000-0000-0000-0000-000000000005', NOW(), NOW(), 'rates:write', 'Publish exchange rates'),
    ('a1000000-0000-0000-0000-000000000006', NOW(), NOW(), 'transactions:read', 'View user transactions'),
    ('a1000000-0000-0000-0000-000000000007', NOW(), NOW(), 'p2p:read', 'View P2P requests/orders'),
    ('a1000000-0000-0000-0000-000000000008', NOW(), NOW(), 'p2p:write', 'Cancel/complete P2P'),
    ('a1000000-0000-0000-0000-000000000009', NOW(), NOW(), 'admin:manage', 'Manage admin users/roles'),
    ('a1000000-0000-0000-0000-00000000000a', NOW(), NOW(), 'currencies:write', 'Create currencies'),
    ('a1000000-0000-0000-0000-00000000000b', NOW(), NOW(), 'promotions:write', 'Create promotions');

INSERT INTO admin_roles (id, created_at, updated_at, code, name, description) VALUES
    ('a2000000-0000-0000-0000-000000000001', NOW(), NOW(), 'SUPER_ADMIN', 'Super Admin', 'Full admin access');

INSERT INTO admin_role_permissions (role_id, permission_id)
SELECT 'a2000000-0000-0000-0000-000000000001', id FROM admin_permissions;
