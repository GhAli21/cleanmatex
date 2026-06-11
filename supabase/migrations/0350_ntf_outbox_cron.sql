-- =============================================================================
-- 0350_ntf_outbox_cron.sql
-- Purpose: Notification Hub – pg_cron + pg_net outbox processor job.
--          Registers two cron jobs:
--          1. ntf-outbox-processor — every minute: dispatches QUEUED outbox rows
--          2. ntf-outbox-retry     — every 5 minutes: re-queues FAILED_TEMPORARY rows
--             that have exceeded their next_retry_at.
--
-- CONFIGURE BEFORE APPLYING:
--   Run the following in your Supabase SQL editor (not in this file) to set
--   the required GUCs that the cron job reads at runtime:
--
--     ALTER DATABASE postgres SET app.next_js_base_url = 'https://your-app-url.com';
--     ALTER DATABASE postgres SET app.outbox_secret_key = 'your-secret-here';
--
--   The outbox_secret_key must match NOTIFICATIONS_OUTBOX_SECRET in your .env.
--
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Author: CleanMateX Development Team
-- Created: 2026-06-11
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Ensure required extensions are enabled
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- 2. Remove old jobs if they exist (idempotent re-run support)
-- =============================================================================

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('ntf-outbox-processor', 'ntf-outbox-retry');

-- =============================================================================
-- 3. Outbox processor — every 1 minute
--    Calls POST /api/notifications/process-outbox to dispatch QUEUED rows.
--    Uses current_setting() so secrets are never stored in cron job SQL text.
-- =============================================================================

SELECT cron.schedule(
  'ntf-outbox-processor',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.next_js_base_url', true) || '/api/notifications/process-outbox',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || current_setting('app.outbox_secret_key', true)
                 ),
      body    := '{}'::jsonb
    )
  $$
);

-- =============================================================================
-- 4. Retry sweep — every 5 minutes
--    Re-queues FAILED_TEMPORARY rows whose next_retry_at has passed and whose
--    retry_count has not yet reached max_retries. Setting status back to QUEUED
--    makes them eligible for the main processor on the next minute.
-- =============================================================================

SELECT cron.schedule(
  'ntf-outbox-retry',
  '*/5 * * * *',
  $$
    UPDATE public.org_ntf_outbox_dtl
    SET    status     = 'QUEUED',
           updated_at = NOW()
    WHERE  status       = 'FAILED_TEMPORARY'
      AND  next_retry_at <= NOW()
      AND  retry_count    < max_retries
  $$
);

COMMIT;
