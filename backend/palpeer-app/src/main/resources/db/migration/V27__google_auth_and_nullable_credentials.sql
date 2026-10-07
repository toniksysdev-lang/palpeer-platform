-- Google Sign-In: store Google subject; allow passwordless / phoneless Google accounts.

ALTER TABLE users
    ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
    ADD COLUMN google_sub VARCHAR(255);

CREATE UNIQUE INDEX uk_users_google_sub ON users (google_sub) WHERE google_sub IS NOT NULL;
