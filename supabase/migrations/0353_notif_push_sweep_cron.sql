-- =============================================================================
-- 0353_notif_push_sweep_cron.sql
-- Purpose: Notification Hub – pg_cron job to deactivate stale push subscriptions.
--
--          A subscription is considered stale when ANY of the following:
--            1. failure_count > 3          — repeated provider rejections
--            2. last_verified_at older than 90 days — token likely expired or user
--                 uninstalled the app without revoking
--            3. last_verified_at IS NULL AND created_at older than 90 days
--                 — subscription never received a successful delivery
--
--          The push adapter already sets is_active=false on permanent provider errors
--          (410 Gone, UNREGISTERED, invalid player_id). This sweep is the safety net
--          for subscriptions that silently go stale (app uninstall without revoke).
--
--          Frequency: weekly (Sunday 03:00 UTC) — low enough to be non-disruptive
--          while still clearing stale tokens within a week of the 90-day threshold.
--
-- PRD:    CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-11
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Deactivate stale push subscriptions (direct SQL, called by cron)
-- =============================================================================

-- Wrapped as a named SQL function so pg_cron can call it cleanly and we can
-- test it manually via SELECT ntf_sweep_stale_push_subs();

CREATE OR REPLACE FUNCTION ntf_sweep_stale_push_subs()
RETURNS TABLE(deactivated_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  UPDATE org_notif_push_subs_dtl
  SET
    is_active  = false,
    updated_at = NOW(),
    updated_by = 'pg_cron:ntf_sweep_stale_push_subs',
    rec_notes  = 'Deactivated by stale-subscription sweep: failure_count > 3 or last_verified_at older than 90 days'
  WHERE
    is_active = true
    AND (
      failure_count > 3
      OR last_verified_at < NOW() - INTERVAL '90 days'
      OR (last_verified_at IS NULL AND created_at < NOW() - INTERVAL '90 days')
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$;

COMMENT ON FUNCTION ntf_sweep_stale_push_subs() IS
  'Deactivates stale push subscriptions: failure_count > 3 or unverified for 90+ days. '
  'Called weekly by pg_cron. Safe to call manually for testing.';

-- =============================================================================
-- 2. Schedule weekly pg_cron job
--
--    Runs at 03:00 UTC every Sunday (off-peak for GCC tenants: early Monday morning).
--    Uses ON CONFLICT to make the migration idempotent — safe to re-run.
-- =============================================================================

SELECT cron.schedule(
  'ntf-sweep-stale-push-subs',          -- job name (unique)
  '0 3 * * 0',                           -- every Sunday at 03:00 UTC
  $$SELECT ntf_sweep_stale_push_subs()$$ -- SQL to execute
);

COMMENT ON FUNCTION ntf_sweep_stale_push_subs() IS
  'Deactivates stale push subscriptions: failure_count > 3 or unverified for 90+ days. '
  'Called weekly by pg_cron (job: ntf-sweep-stale-push-subs). Safe to call manually.';

COMMIT;
