-- =============================================================================
-- 0355_ntf_config_table_cron_fix.sql
-- Purpose: Replace GUC-based config for the notification outbox cron job.
--          ALTER DATABASE / ALTER ROLE SET for custom GUC namespaces (app.*)
--          requires SUPERUSER. Supabase's postgres role has rolsuper = false,
--          making GUCs impossible to persist. This migration introduces a
--          lightweight config table and a SECURITY DEFINER wrapper function,
--          then re-registers the ntf-outbox-processor cron job to use it.
--
--          The ntf-outbox-retry job does NOT use GUCs and is left unchanged.
--
-- To update config after apply (e.g. change base URL or rotate secret):
--   UPDATE sys_ntf_runtime_cf SET value = '...' WHERE key = 'base_url';
--   UPDATE sys_ntf_runtime_cf SET value = '...' WHERE key = 'outbox_secret_key';
--
-- To change the URL later (e.g. switch from remote to local to production):
-- UPDATE sys_ntf_runtime_cf SET value = 'http://host.docker.internal:3000' WHERE key = 'base_url';
-- Note for local dev: pg_cron runs inside Docker so localhost means the container, not your host. To reach your local Next.js app from pg_cron, the URL should be http://host.docker.internal:3000 instead of https://cmx.cleanmatex.com. You can UPDATE that row after applying.
--
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-12
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Config table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sys_ntf_runtime_cf (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prevent PostgREST (anon / authenticated) from exposing the outbox secret.
REVOKE ALL ON public.sys_ntf_runtime_cf FROM anon, authenticated;

-- =============================================================================
-- 2. Seed config values
--    base_url:         App URL that pg_cron calls (local: http://host.docker.internal:3000)
--    outbox_secret_key: Must match NOTIFICATIONS_OUTBOX_SECRET in .env.local
-- =============================================================================

INSERT INTO public.sys_ntf_runtime_cf (key, value) VALUES
  ('base_url',          'https://cmx.cleanmatex.com'),
  ('outbox_secret_key', '4c19304243e6153064d056e30d7b32dadb5ef86668965ac94760d0a81402dccf')
ON CONFLICT (key) DO UPDATE
  SET value      = EXCLUDED.value,
      updated_at = NOW();

-- =============================================================================
-- 3. Wrapper function — reads config at call time, then fires the HTTP request
--    SECURITY DEFINER so pg_cron can call it regardless of session role.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.ntf_trigger_outbox_proc()
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
    RAISE WARNING '[ntf_trigger_outbox_proc] sys_ntf_runtime_cf is missing base_url or outbox_secret_key — skipping';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/api/notifications/process-outbox',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_secret
               ),
    body    := '{}'::jsonb
  );
END;
$$;

-- =============================================================================
-- 4. Re-register ntf-outbox-processor to call the function
-- =============================================================================

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'ntf-outbox-processor';

SELECT cron.schedule(
  'ntf-outbox-processor',
  '* * * * *',
  'SELECT public.ntf_trigger_outbox_proc()'
);

-- =============================================================================
-- 5. Verify
-- =============================================================================

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'ntf-outbox-processor' AND active = true
  ), 'ntf-outbox-processor cron job not registered';

  ASSERT EXISTS (
    SELECT 1 FROM sys_ntf_runtime_cf WHERE key = 'base_url'
  ), 'base_url config missing';

  ASSERT EXISTS (
    SELECT 1 FROM sys_ntf_runtime_cf WHERE key = 'outbox_secret_key'
  ), 'outbox_secret_key config missing';
END;
$$;

COMMIT;
