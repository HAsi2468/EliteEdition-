-- ==============================================================================
-- Technical Specification: "Job Card & Lot Status Race Condition Engine"
-- Phase 1 & Phase 3 PostgreSQL Migration: Schema, Constraints, & Audit Tables
-- Engine: PostgreSQL 14+
-- Concurrency Protection: Strict Versioning, Row-Level Locking, Negative Checks
-- ==============================================================================

BEGIN;

-- 1. Create Status Enums / Domains
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_card_status') THEN
        CREATE TYPE job_card_status AS ENUM (
            'DRAFT',
            'IN_PROGRESS',
            'ON_HOLD',
            'COMPLETED',
            'CANCELLED'
        );
    END IF;
END $$;

-- 2. Enhance / Create job_cards table
CREATE TABLE IF NOT EXISTS job_cards (
    id VARCHAR(64) PRIMARY KEY,
    job_number VARCHAR(64) NOT NULL UNIQUE,
    status job_card_status NOT NULL DEFAULT 'DRAFT',
    version INT NOT NULL DEFAULT 1,
    client_name VARCHAR(128),
    total_meters NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_by VARCHAR(64) NOT NULL,
    updated_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill version and constraints if table already existed
ALTER TABLE job_cards 
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS updated_by VARCHAR(64),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_job_cards_status ON job_cards (status);
CREATE INDEX IF NOT EXISTS idx_job_cards_version ON job_cards (id, version);

-- 3. Enhance / Create lots table
CREATE TABLE IF NOT EXISTS lots (
    id VARCHAR(64) PRIMARY KEY,
    lot_number VARCHAR(64) NOT NULL UNIQUE,
    fabric_type VARCHAR(128) NOT NULL,
    total_meters NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    available_meters NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_lot_meters_non_negative CHECK (available_meters >= 0)
);

-- Ensure version and hard non-negative constraint if table already existed
ALTER TABLE lots 
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS available_meters NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_lot_meters_non_negative'
    ) THEN
        ALTER TABLE lots ADD CONSTRAINT chk_lot_meters_non_negative CHECK (available_meters >= 0);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lots_available_meters ON lots (available_meters);
CREATE INDEX IF NOT EXISTS idx_lots_version ON lots (id, version);

-- 4. Create lot_ledger (Audit & Immutable Double-Entry Ledger)
CREATE TABLE IF NOT EXISTS lot_ledger (
    id BIGSERIAL PRIMARY KEY,
    lot_id VARCHAR(64) NOT NULL REFERENCES lots(id) ON DELETE RESTRICT,
    job_card_id VARCHAR(64) REFERENCES job_cards(id) ON DELETE RESTRICT,
    delta_meters NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    transaction_type VARCHAR(32) NOT NULL, -- 'INWARD', 'CONSUMPTION', 'ADJUSTMENT', 'RETURN'
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lot_ledger_lot_id ON lot_ledger (lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_ledger_job_card ON lot_ledger (job_card_id);
CREATE INDEX IF NOT EXISTS idx_lot_ledger_created_at ON lot_ledger (created_at DESC);

-- 5. Create idempotency_keys table (Distributed Idempotency Engine)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(64),
    action VARCHAR(128) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED'
    response_status INT,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_status ON idempotency_keys (status);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at ON idempotency_keys (created_at);

COMMIT;
