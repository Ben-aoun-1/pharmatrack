-- Migration 2 (Phase 3): flag sales whose barcode is unknown to the drugs table.
-- Apply against an existing database that was created from the Phase 1 schema.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_price_unverified boolean DEFAULT false;
