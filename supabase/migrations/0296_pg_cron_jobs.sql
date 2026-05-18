-- =============================================================================
-- Migration: 0296_pg_cron_jobs.sql
-- Purpose  : Enable pg_cron + pg_net, create SQL expiry helpers, and schedule
--            recurring maintenance jobs.
--
-- Jobs created:
--   1. outbox-worker      — every minute  — calls outbox-worker edge function
--   2. expire-gift-cards  — 02:00 daily   — marks expired gift cards
--   3. expire-credit-notes — 02:05 daily  — marks expired credit notes
-- =============================================================================

-- ── Enable required extensions ────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron    WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net     WITH SCHEMA extensions;

-- ── Expiry helper: gift cards ─────────────────────────────────────────────────
-- Marks ACTIVE gift cards past their expiry_date as EXPIRED.
-- Safe to run repeatedly (idempotent).

CREATE OR REPLACE FUNCTION fn_expire_gift_cards()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE org_gift_cards_mst
  SET    status     = 'EXPIRED',
         updated_at = NOW(),
         updated_by = 'system/expiry-worker'
  WHERE  status      = 'ACTIVE'
    AND  expiry_date IS NOT NULL
    AND  expiry_date < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Expiry helper: credit notes ───────────────────────────────────────────────
-- Marks ACTIVE credit notes past their expires_at date as EXPIRED.

CREATE OR REPLACE FUNCTION fn_expire_credit_notes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE org_credit_notes_mst
  SET    status     = 'EXPIRED',
         updated_at = NOW()
  WHERE  status     = 'ACTIVE'
    AND  expires_at IS NOT NULL
    AND  expires_at < NOW()::date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── Outbox batch-claim helper (used by edge function as an optimistic-lock RPC) ─
-- Atomically marks up to p_limit PENDING/FAILED events as PROCESSING and
-- returns them. The edge function calls this via supabase.rpc().

CREATE OR REPLACE FUNCTION claim_outbox_batch(p_limit integer DEFAULT 50, p_now timestamptz DEFAULT NOW())
RETURNS SETOF org_domain_events_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  -- Collect IDs to claim
  SELECT ARRAY_AGG(id) INTO v_ids
  FROM (
    SELECT id
    FROM   org_domain_events_outbox
    WHERE  status IN ('PENDING', 'FAILED')
      AND  next_retry_at <= p_now
    ORDER  BY next_retry_at ASC
    LIMIT  p_limit
    FOR    UPDATE SKIP LOCKED
  ) sub;

  IF v_ids IS NULL OR ARRAY_LENGTH(v_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Mark as PROCESSING
  UPDATE org_domain_events_outbox
  SET    status = 'PROCESSING'
  WHERE  id = ANY(v_ids);

  -- Return the claimed rows
  RETURN QUERY
    SELECT * FROM org_domain_events_outbox WHERE id = ANY(v_ids);
END;
$$;

-- ── Schedule: outbox worker (every minute) ────────────────────────────────────
-- Calls the outbox-worker Supabase Edge Function via HTTP.
-- IMPORTANT: Replace <PROJECT_REF> with your Supabase project ref before running,
-- or set app.settings.supabase_project_ref in the Supabase dashboard.
--
-- To configure the project ref:
--   ALTER DATABASE postgres SET app.settings.supabase_project_ref = 'your-ref-here';
--
-- Then the URL below resolves automatically.

SELECT cron.unschedule('outbox-worker') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'outbox-worker'
);

SELECT cron.schedule(
  'outbox-worker',
  '* * * * *',
  $$
  SELECT extensions.http_post(
    url     := FORMAT('https://%s.supabase.co/functions/v1/outbox-worker',
                      current_setting('app.settings.supabase_project_ref', true)),
    headers := JSON_BUILD_OBJECT(
                 'Content-Type',  'application/json',
                 'Authorization', FORMAT('Bearer %s',
                   current_setting('app.settings.supabase_service_role_key', true))
               )::jsonb,
    body    := '{}'::jsonb
  )
  WHERE current_setting('app.settings.supabase_project_ref', true) IS NOT NULL
    AND current_setting('app.settings.supabase_project_ref', true) != ''
  $$
);

-- ── Schedule: expire gift cards (daily at 02:00) ──────────────────────────────

SELECT cron.unschedule('expire-gift-cards') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-gift-cards'
);

SELECT cron.schedule(
  'expire-gift-cards',
  '0 2 * * *',
  $$ SELECT fn_expire_gift_cards() $$
);

-- ── Schedule: expire credit notes (daily at 02:05) ───────────────────────────

SELECT cron.unschedule('expire-credit-notes') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-credit-notes'
);

SELECT cron.schedule(
  'expire-credit-notes',
  '5 2 * * *',
  $$ SELECT fn_expire_credit_notes() $$
);

-- =============================================================================
-- Post-deployment checklist:
-- 1. Set app.settings.supabase_project_ref in Supabase → Settings → Database
-- 2. Set app.settings.supabase_service_role_key (or use vault)
-- 3. Deploy supabase/functions/outbox-worker/index.ts via: supabase functions deploy outbox-worker
-- 4. Verify cron jobs: SELECT * FROM cron.job;
-- =============================================================================
