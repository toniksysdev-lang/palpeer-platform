-- Ensure every default registration-country currency exists so New wallet can list them.
INSERT INTO currencies (id, created_at, updated_at, created_by, updated_by, code, symbol, precision)
VALUES
    ('a4200000-0000-4000-8000-000000000041', NOW(), NOW(), 'migration', 'migration', 'GHS', 'GH₵', 2),
    ('a4200000-0000-4000-8000-000000000042', NOW(), NOW(), 'migration', 'migration', 'KES', 'KSh', 2)
ON CONFLICT (code) DO NOTHING;
