-- =============================================================================
-- 0604_ntf_reconcile_outbox_cron.sql
-- Purpose: Notification Hub – pg_cron + pg_net reconciliation job.
--          Registers one cron job:
--          ntf-reconcile-outbox — every 5 minutes: calls POST
--          /api/notifications/reconcile-outbox to resolve outbox rows held
--          ACCEPTANCE_UNCERTAIN or stuck PROCESSING past their claim lease.
--
-- Context: web-admin/lib/notifications/reconciliation-service.ts and its route
-- (web-admin/app/api/notifications/reconcile-outbox/route.ts) were implemented
-- 2026-10-09 (see STATUS.md) but deliberately shipped with no cron schedule —
-- reconciliation was manual-invocation-only pending explicit user approval to
-- add a new scheduled job. That approval was given 2026-10-10 (plan section
-- 23.1, item A5a). This migration is the approved follow-up: it does not
-- change reconciliation-service.ts's behavior at all, only how often it runs.
--
-- Same 5-minute cadence as the existing 'ntf-outbox-retry' job (0350), since
-- reconciliation is the same class of periodic safety-net sweep, not the
-- primary dispatch path (that stays the 1-minute 'ntf-outbox-processor' job).
-- Reuses the same GUCs 0350 already requires (app.next_js_base_url,
-- app.outbox_secret_key) — no new configuration step needed if 0350 is
-- already configured.
--
-- PRD: CMX-PRD-019 Notification & Communication Hub
-- Created: 2026-10-10
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Required extensions (already enabled by 0350; IF NOT EXISTS keeps this
--    migration self-contained and safe to apply independently).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- 2. Remove old job if it exists (idempotent re-run support).
-- =============================================================================

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'ntf-reconcile-outbox';

-- =============================================================================
-- 3. Reconciliation sweep — every 5 minutes.
--    Calls POST /api/notifications/reconcile-outbox for every active tenant.
--    Uses current_setting() so secrets are never stored in cron job SQL text
--    — same pattern and same GUCs as 0350's 'ntf-outbox-processor' job.
-- =============================================================================

SELECT cron.schedule(
  'ntf-reconcile-outbox',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.next_js_base_url', true) || '/api/notifications/reconcile-outbox',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || current_setting('app.outbox_secret_key', true)
                 ),
      body    := '{}'::jsonb
    )
  $$
);

COMMENT ON EXTENSION pg_cron IS
  'Required for ntf-outbox-processor, ntf-outbox-retry (0350) and ntf-reconcile-outbox (0604) scheduled jobs.';

COMMIT;
