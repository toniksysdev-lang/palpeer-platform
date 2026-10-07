-- Personal information on profiles (P2-01)

ALTER TABLE profiles
    ADD COLUMN first_name                   VARCHAR(80),
    ADD COLUMN last_name                    VARCHAR(80),
    ADD COLUMN date_of_birth                DATE,
    ADD COLUMN country_of_residence         VARCHAR(2),
    ADD COLUMN state_territory              VARCHAR(100),
    ADD COLUMN address_line1                VARCHAR(200),
    ADD COLUMN address_line2                VARCHAR(200),
    ADD COLUMN city                         VARCHAR(100),
    ADD COLUMN postal_code                  VARCHAR(32),
    ADD COLUMN source_of_income             VARCHAR(40),
    ADD COLUMN monthly_transaction_estimate VARCHAR(40);
