-- Inverse InstantEX quotes persist rate_side = 'INVERSE_BUY' (11 chars).
-- V11 used VARCHAR(10), which truncates/fails NGN→CAD (and other inverse) previews.
ALTER TABLE exchange_quotes
    ALTER COLUMN rate_side TYPE VARCHAR(20);
