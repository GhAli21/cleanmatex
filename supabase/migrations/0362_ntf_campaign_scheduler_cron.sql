-- =============================================================================
-- 0362_ntf_campaign_scheduler_cron.sql
-- Purpose: Register pg_cron job for the campaign scheduler.
--          Creates ntf_trigger_campaign_proc() SECURITY DEFINER function
--          (mirrors the outbox pattern in 0355) and registers a 1-min cron.
--
-- Pattern: pg_cron → SECURITY DEFINER fn → pg_net HTTP POST →
--            /api/notifications/process-campaigns
--
-- Auth: reuses outbox_secret_key from sys_ntf_runtime_cf (same secret, same
--       pattern as ntf-outbox-processor; the process-campaigns route validates it).
--
-- PRD: CMX-PRD-019 Notification & Communication Hub — Phase 4
-- Author: CleanMateX Development Team
-- Created: 2026-06-12
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. SECURITY DEFINER wrapper function
--    Reads base_url + outbox_secret_key from sys_ntf_runtime_cf at call time,
--    then fires an HTTP POST to the campaign processor route.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ntf_trigger_campaign_proc()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url    TEXT;
  v_secret TEXT;
BEGIN
  SELECT value INTO v_url    FROM sys_ntf_runtime_cf WHERE key = 'base_url';
  SELECT value INTO v_secret FROM sys_ntf_runtime_cf WHERE key = 'outbox_secret_key';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING '[ntf_trigger_campaign_proc] sys_ntf_runtime_cf missing base_url or outbox_secret_key — skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/api/notifications/process-campaigns',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_secret
               ),
    body    := '{}'::jsonb
  );
END;
$$;

-- =============================================================================
-- 2. Register campaign scheduler cron job (every 1 minute)
--    Picks up APPROVED/SCHEDULED campaigns due to run and processes PENDING targets.
-- =============================================================================

-- Remove any previous registration before re-adding (idempotent)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'ntf-campaign-scheduler';

SELECT cron.schedule(
  'ntf-campaign-scheduler',
  '* * * * *',
  'SELECT public.ntf_trigger_campaign_proc()'
);

-- =============================================================================
-- 3. Verify
-- =============================================================================

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'ntf-campaign-scheduler' AND active = true
  ), 'ntf-campaign-scheduler cron job not registered';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'ntf_trigger_campaign_proc'
  ), 'ntf_trigger_campaign_proc function not created';
END;
$$;

COMMIT;
