-- ==================================================================
-- Migration: 0167_org_order_item_pieces_color_jsonb.sql
-- Purpose: Change org_order_item_pieces_dtl.color from VARCHAR(50) to JSONB
-- Part of: Customer/Order/Item/Pieces Preferences - Unified Plan
-- Do NOT apply - user runs migrations manually
-- ==================================================================

BEGIN;

-- Add new JSONB column
ALTER TABLE org_order_item_pieces_dtl
  ADD COLUMN IF NOT EXISTS color_jsonb JSONB DEFAULT NULL;

-- Backfill: convert existing color to JSONB structure {"codes": ["value"], "primary": "value"}
UPDATE org_order_item_pieces_dtl
SET color_jsonb = jsonb_build_object('codes', ARRAY[color]::TEXT[], 'primary', color)
WHERE color IS NOT NULL AND color != '';

-- Drop old column
ALTER TABLE org_order_item_pieces_dtl
  DROP COLUMN IF EXISTS color;

-- Rename new column to color
ALTER TABLE org_order_item_pieces_dtl
  RENAME COLUMN color_jsonb TO color;

COMMENT ON COLUMN org_order_item_pieces_dtl.color IS 'JSONB: {"codes": ["RED","STRIPED"], "primary": "RED"} or simple array';

COMMIT;
