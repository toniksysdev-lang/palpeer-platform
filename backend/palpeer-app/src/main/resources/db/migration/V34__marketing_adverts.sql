-- Home-screen marketing / promotional adverts (image carousel)

CREATE TABLE IF NOT EXISTS marketing_adverts (
    id              UUID PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL,
    created_by      VARCHAR(120),
    updated_by      VARCHAR(120),
    title           VARCHAR(200) NOT NULL,
    body            VARCHAR(500) NOT NULL,
    image_url       VARCHAR(1000) NOT NULL,
    cta_label       VARCHAR(80) NOT NULL,
    cta_path        VARCHAR(200) NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_marketing_adverts_active_sort
    ON marketing_adverts (active, sort_order, created_at DESC);

-- Seed three launch adverts (earn points, cheaper InstantEX, P2P deals)
INSERT INTO marketing_adverts (
    id, created_at, updated_at, title, body, image_url, cta_label, cta_path, sort_order, active
) VALUES
(
    'b1000000-0000-0000-0000-000000000001',
    NOW(), NOW(),
    'Earn more points',
    'Invite friends and stack rewards every time they join and trade.',
    'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=80',
    'Invite & earn',
    '/referrals',
    10,
    TRUE
),
(
    'b1000000-0000-0000-0000-000000000002',
    NOW(), NOW(),
    'Exchange cheaper',
    'InstantEX rates that stretch your CAD ↔ NGN further — swap in seconds.',
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    'Swap now',
    '/exchange',
    20,
    TRUE
),
(
    'b1000000-0000-0000-0000-000000000003',
    NOW(), NOW(),
    'Better P2P deals',
    'Buy and sell peer-to-peer at competitive rates you control.',
    'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    'Browse P2P',
    '/p2p',
    30,
    TRUE
)
ON CONFLICT (id) DO NOTHING;
