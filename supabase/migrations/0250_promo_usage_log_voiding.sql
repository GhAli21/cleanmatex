-- Migration: 0250_promo_usage_log_voiding
-- Purpose:   Add voiding (reversal) support to the promo usage log.
--            When a promo code application is cancelled or reversed, the void
--            columns are populated instead of deleting the log row so that
--            the full audit trail is preserved.
-- Author:    System
-- Date:      2026-05-06

ALTER TABLE org_promo_usage_log
  ADD COLUMN IF NOT EXISTS voided_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by  TEXT;

COMMENT ON COLUMN org_promo_usage_log.voided_at IS
  'Timestamp when this usage entry was voided (reversed). NULL = not voided.';
COMMENT ON COLUMN org_promo_usage_log.voided_by IS
  'User ID who performed the void operation.';
