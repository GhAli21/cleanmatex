-- Migration: 0258_gift_card_pin_failed_attempts.sql
-- Adds pin_failed_attempts column to org_gift_cards_mst.
-- This column was referenced in the Prisma schema and service layer (gift_card_v1_35b71bc5)
-- but was omitted from migration 0257.

BEGIN;

ALTER TABLE org_gift_cards_mst
  ADD COLUMN IF NOT EXISTS pin_failed_attempts INT NOT NULL DEFAULT 0;

COMMIT;
