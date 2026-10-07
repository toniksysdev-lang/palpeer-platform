-- Phase 2: KYC cases, documents, selfies

CREATE TABLE kyc_cases (
    id                UUID            NOT NULL PRIMARY KEY,
    created_at        TIMESTAMPTZ     NOT NULL,
    updated_at        TIMESTAMPTZ     NOT NULL,
    created_by        VARCHAR(100),
    updated_by        VARCHAR(100),
    user_id           UUID            NOT NULL,
    status            VARCHAR(40)     NOT NULL,
    rejection_reason  VARCHAR(500),
    CONSTRAINT uk_kyc_cases_user_id UNIQUE (user_id),
    CONSTRAINT fk_kyc_cases_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX idx_kyc_cases_status ON kyc_cases (status);

CREATE TABLE kyc_documents (
    id                 UUID            NOT NULL PRIMARY KEY,
    created_at         TIMESTAMPTZ     NOT NULL,
    updated_at         TIMESTAMPTZ     NOT NULL,
    created_by         VARCHAR(100),
    updated_by         VARCHAR(100),
    kyc_case_id        UUID            NOT NULL,
    document_type      VARCHAR(60)     NOT NULL,
    storage_key        VARCHAR(512)    NOT NULL,
    content_type       VARCHAR(120)    NOT NULL,
    original_filename  VARCHAR(255)    NOT NULL,
    size_bytes         BIGINT          NOT NULL,
    CONSTRAINT fk_kyc_documents_case FOREIGN KEY (kyc_case_id) REFERENCES kyc_cases (id)
);

CREATE INDEX idx_kyc_documents_case_id ON kyc_documents (kyc_case_id);

CREATE TABLE kyc_selfies (
    id                 UUID            NOT NULL PRIMARY KEY,
    created_at         TIMESTAMPTZ     NOT NULL,
    updated_at         TIMESTAMPTZ     NOT NULL,
    created_by         VARCHAR(100),
    updated_by         VARCHAR(100),
    kyc_case_id        UUID            NOT NULL,
    storage_key        VARCHAR(512)    NOT NULL,
    content_type       VARCHAR(120)    NOT NULL,
    original_filename  VARCHAR(255)    NOT NULL,
    size_bytes         BIGINT          NOT NULL,
    CONSTRAINT fk_kyc_selfies_case FOREIGN KEY (kyc_case_id) REFERENCES kyc_cases (id)
);

CREATE INDEX idx_kyc_selfies_case_id ON kyc_selfies (kyc_case_id);
