-- Unique account username for marketplace notifications and public handles.

ALTER TABLE users ADD COLUMN username VARCHAR(32);

-- Seed from email local-part (strip non [a-z0-9_]); empty → user + short id.
UPDATE users
SET username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));

UPDATE users
SET username = 'user' || substr(replace(id::text, '-', ''), 1, 8)
WHERE username IS NULL OR username = '';

-- Keep within length before uniqueness suffixes.
UPDATE users SET username = left(username, 24);

-- Resolve collisions: append _ + 6 hex chars from id for duplicates.
WITH ranked AS (
    SELECT id,
           username,
           row_number() OVER (PARTITION BY lower(username) ORDER BY created_at, id) AS rn
    FROM users
)
UPDATE users u
SET username = left(u.username, 24) || '_' || substr(replace(u.id::text, '-', ''), 1, 6)
FROM ranked r
WHERE u.id = r.id
  AND r.rn > 1;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX uk_users_username_lower ON users (lower(username));
