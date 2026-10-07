-- Phase 14: referrals, promotions, bonuses (ledger credit deferred)

CREATE TABLE promotions (
    id                  UUID           NOT NULL PRIMARY KEY,
    created_at          TIMESTAMPTZ    NOT NULL,
    updated_at          TIMESTAMPTZ    NOT NULL,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    code                VARCHAR(40)    NOT NULL,
    title               VARCHAR(200)   NOT NULL,
    description         VARCHAR(2000),
    promotion_type      VARCHAR(40)    NOT NULL,
    active              BOOLEAN        NOT NULL,
    starts_at           TIMESTAMPTZ,
    ends_at             TIMESTAMPTZ,
    bonus_amount        NUMERIC(28,12),
    bonus_currency_code VARCHAR(10),
    CONSTRAINT uk_promotions_code UNIQUE (code),
    CONSTRAINT fk_promotions_currency FOREIGN KEY (bonus_currency_code) REFERENCES currencies (code)
);

CREATE INDEX idx_promotions_active ON promotions (active);

CREATE TABLE referrals (
    id                  UUID          NOT NULL PRIMARY KEY,
    created_at          TIMESTAMPTZ   NOT NULL,
    updated_at          TIMESTAMPTZ   NOT NULL,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    referrer_user_id    UUID          NOT NULL,
    referee_user_id     UUID,
    referral_code       VARCHAR(40)   NOT NULL,
    status              VARCHAR(20)   NOT NULL,
    promotion_id        UUID,
    CONSTRAINT uk_referrals_code UNIQUE (referral_code),
    CONSTRAINT uk_referrals_referee UNIQUE (referee_user_id),
    CONSTRAINT fk_referrals_referrer FOREIGN KEY (referrer_user_id) REFERENCES users (id),
    CONSTRAINT fk_referrals_referee FOREIGN KEY (referee_user_id) REFERENCES users (id),
    CONSTRAINT fk_referrals_promotion FOREIGN KEY (promotion_id) REFERENCES promotions (id),
    CONSTRAINT chk_referrals_not_self CHECK (referee_user_id IS NULL OR referrer_user_id <> referee_user_id)
);

CREATE INDEX idx_referrals_referrer ON referrals (referrer_user_id);

CREATE TABLE bonuses (
    id                  UUID           NOT NULL PRIMARY KEY,
    created_at          TIMESTAMPTZ    NOT NULL,
    updated_at          TIMESTAMPTZ    NOT NULL,
    created_by          VARCHAR(100),
    updated_by          VARCHAR(100),
    user_id             UUID           NOT NULL,
    promotion_id        UUID,
    referral_id         UUID,
    amount              NUMERIC(28,12) NOT NULL,
    currency_code       VARCHAR(10)    NOT NULL,
    status              VARCHAR(20)    NOT NULL,
    reason              VARCHAR(200),
    ledger_entry_id     UUID,
    CONSTRAINT fk_bonuses_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_bonuses_promotion FOREIGN KEY (promotion_id) REFERENCES promotions (id),
    CONSTRAINT fk_bonuses_referral FOREIGN KEY (referral_id) REFERENCES referrals (id),
    CONSTRAINT fk_bonuses_currency FOREIGN KEY (currency_code) REFERENCES currencies (code),
    CONSTRAINT chk_bonuses_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_bonuses_user_created ON bonuses (user_id, created_at DESC);
CREATE INDEX idx_bonuses_status ON bonuses (status);
