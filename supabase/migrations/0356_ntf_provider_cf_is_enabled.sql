-- =============================================================================
-- 0356_ntf_provider_cf_is_enabled.sql
-- Purpose:
--   1. org_ntf_channel_provider_cf — add is_enabled column.
--        is_active  = this is the currently selected provider for the channel.
--        is_enabled = this provider config row is usable/not soft-disabled.
--        Allows temporarily disabling a provider without deleting its config.
--
--   2. sys_ntf_runtime_cf — add full standard audit columns.
--        Created in 0355 with only (key, value, updated_at). All standard
--        audit fields are added here so the table is consistent with project
--        conventions.
--
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-12
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. org_ntf_channel_provider_cf — add is_enabled
-- =============================================================================

ALTER TABLE public.org_ntf_channel_provider_cf
  ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN org_ntf_channel_provider_cf.is_enabled IS
  'Whether this provider config is usable. Distinct from is_active (the selected provider for the channel). '
  'Set false to temporarily suspend a provider without losing its config.';

-- =============================================================================
-- 2. sys_ntf_runtime_cf — add standard audit columns
--    (table has only key, value, updated_at from migration 0355)
-- =============================================================================

ALTER TABLE public.sys_ntf_runtime_cf
  ADD COLUMN IF NOT EXISTS created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_by   TEXT,
  ADD COLUMN IF NOT EXISTS created_info TEXT,
  ADD COLUMN IF NOT EXISTS updated_by   TEXT,
  ADD COLUMN IF NOT EXISTS updated_info TEXT,
  ADD COLUMN IF NOT EXISTS rec_status   SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rec_order    INTEGER,
  ADD COLUMN IF NOT EXISTS rec_notes    TEXT,
  ADD COLUMN IF NOT EXISTS is_active    BOOLEAN NOT NULL DEFAULT true;

-- Back-fill created_at for the two rows seeded in migration 0355
UPDATE public.sys_ntf_runtime_cf
SET created_at = updated_at,
    created_by = 'system_setup',
    rec_status = 1
WHERE created_at IS NULL;

COMMENT ON TABLE public.sys_ntf_runtime_cf IS
  'Runtime config for the notification outbox cron job (base_url, outbox_secret_key). '
  'Values are read by ntf_trigger_outbox_proc() at call time — no GUC / superuser required.';

COMMIT;