-- Campaign formula and eligibility rules (JSON strings, nullable).

ALTER TABLE promotions
    ADD COLUMN IF NOT EXISTS formula_json TEXT;

ALTER TABLE promotions
    ADD COLUMN IF NOT EXISTS eligibility_json TEXT;
