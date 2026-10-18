-- Pool fund low-balance threshold notices + PIN lockout policy (admin-configurable)

CREATE TABLE IF NOT EXISTS pool_fund_thresholds (
    id                  UUID PRIMARY KEY,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    created_by          VARCHAR(120),
    updated_by          VARCHAR(120),
    provider            VARCHAR(40) NOT NULL,
    currency_code       VARCHAR(3) NOT NULL,
    threshold_amount    NUMERIC(19, 4) NOT NULL,
    CONSTRAINT uq_pool_fund_thresholds_provider_ccy UNIQUE (provider, currency_code),
    CONSTRAINT chk_pool_fund_thresholds_amount CHECK (threshold_amount >= 0)
);

CREATE TABLE IF NOT EXISTS pool_fund_threshold_notify_admins (
    threshold_id    UUID NOT NULL REFERENCES pool_fund_thresholds (id) ON DELETE CASCADE,
    admin_user_id   UUID NOT NULL,
    PRIMARY KEY (threshold_id, admin_user_id)
);

CREATE TABLE IF NOT EXISTS pool_fund_threshold_notify_phones (
    threshold_id    UUID NOT NULL REFERENCES pool_fund_thresholds (id) ON DELETE CASCADE,
    phone           VARCHAR(32) NOT NULL,
    PRIMARY KEY (threshold_id, phone)
);

CREATE TABLE IF NOT EXISTS pin_security_policy (
    id                  SMALLINT PRIMARY KEY DEFAULT 1,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    max_wrong_attempts  INT NOT NULL DEFAULT 5,
    lockout_hours       NUMERIC(10, 2) NOT NULL DEFAULT 0.25,
    CONSTRAINT chk_pin_policy_singleton CHECK (id = 1),
    CONSTRAINT chk_pin_policy_attempts CHECK (max_wrong_attempts >= 1 AND max_wrong_attempts <= 50),
    CONSTRAINT chk_pin_policy_hours CHECK (lockout_hours > 0 AND lockout_hours <= 720)
);

INSERT INTO pin_security_policy (id, updated_at, max_wrong_attempts, lockout_hours)
VALUES (1, NOW(), 5, 0.25)
ON CONFLICT (id) DO NOTHING;
