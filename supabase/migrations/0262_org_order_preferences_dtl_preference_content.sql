-- ==================================================================
-- Migration: 0262_org_order_preferences_dtl_preference_content.sql
-- Purpose: Add preference_content on org_order_preferences_dtl — denormalized
--          display / free-text snapshot so preference_code can later reference
--          a catalog codes table via FK without losing note text or labels.
-- Do NOT apply — user runs migrations manually
-- ==================================================================

BEGIN;

ALTER TABLE org_order_preferences_dtl
  ADD COLUMN IF NOT EXISTS preference_content TEXT;

COMMENT ON COLUMN org_order_preferences_dtl.preference_content IS
  'Snapshot: human-readable or free-text value (e.g. note body). preference_code stays the stable catalog key when FK exists.';

UPDATE org_order_preferences_dtl
SET preference_content = preference_code
WHERE preference_content IS NULL;

COMMIT;
