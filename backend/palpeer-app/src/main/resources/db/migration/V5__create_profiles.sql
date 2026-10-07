-- Phase 2: profiles

CREATE TABLE profiles (
    id               UUID            NOT NULL PRIMARY KEY,
    created_at       TIMESTAMPTZ     NOT NULL,
    updated_at       TIMESTAMPTZ     NOT NULL,
    created_by       VARCHAR(100),
    updated_by       VARCHAR(100),
    user_id          UUID            NOT NULL,
    CONSTRAINT uk_profiles_user_id UNIQUE (user_id),
    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users (id)
);
