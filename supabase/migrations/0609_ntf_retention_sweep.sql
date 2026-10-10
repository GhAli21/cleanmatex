-- =============================================================================
-- Migration: 0609_ntf_retention_sweep
-- Purpose:   Notification Hub payload/PII retention sweep (plan item B2).
--
-- Background: the production implementation plan (section 23, "Decision:
-- Retention/residency/compliance") and the schema/contract spec (section 12,
-- "Privacy, retention and pricing separation") both left the exact retention
-- window as an approved-policy TBD, explicitly refusing to invent a default.
-- User decision (2026-10-10): match whatever retention window the rest of
-- CleanMateX already uses for comparable PII, rather than pick a new number.
-- The existing precedent is `fn_auth_sessions_sweep(180)` (migration 0575),
-- which purges ENDED `sys_auth_user_sessions_mst` rows older than 180 days —
-- that table carries comparable PII (device/IP/location) to what the
-- notification tables below carry (recipient addresses, rendered message
-- content, provider payloads). This migration applies the same 180-day
-- default and the same SECURITY DEFINER function + direct pg_cron SQL
-- registration pattern as 0575/0576, to the five notification tables that
-- hold terminal, no-longer-operationally-needed PII:
--
--   - org_ntf_outbox_dtl        — rendered subject/body (customer PII), recipient address
--   - org_ntf_delivery_log_dtl  — raw provider_response payloads, error detail
--   - org_ntf_receipts_tr       — redacted provider receipt evidence
--   - org_ntf_inbox_mst         — in-app notification content
--   - hq_ntf_dispatch_log       — HQ-side dispatch ledger (recipient_hash only, lower
--                                  sensitivity, but a terminal operational record on the
--                                  same lifecycle; swept for consistency, not separately)
--
-- Only rows in a terminal state are ever purged (mirrors 0575's "ended rows
-- only" rule) — nothing PENDING/PROCESSING/QUEUED/awaiting-retry is ever
-- touched regardless of age. This is a pure DB-level maintenance operation
-- (like 0575's sweep): it intentionally has no per-tenant scope and sweeps
-- all tenants in one pass, same as fn_auth_sessions_sweep does — CRITICAL
-- RULE #4's explicit-tenant_org_id-filter requirement governs tenant-facing
-- application queries, not a global housekeeping function whose entire job
-- is to operate across every tenant uniformly.
--
-- This migration is CREATED ONLY. Per CRITICAL RULE #3, it is not applied by
-- any tool/MCP; the user reviews and applies it (local + remote).
--
-- Reversal (forward-only; this migration is additive/non-destructive to
-- existing data on its own — only the function/cron job are reversible):
--   SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ntf-retention-sweep';
--   DROP FUNCTION IF EXISTS public.fn_ntf_retention_sweep(INTEGER);
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- fn_ntf_retention_sweep: purge terminal notification rows past the
-- retention window. Returns the total row count deleted across all five
-- tables, for operator/monitoring visibility (mirrors fn_auth_sessions_sweep
-- returning its own affected-row count).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ntf_retention_sweep(p_retention_days INTEGER DEFAULT 180)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cutoff    TIMESTAMPTZ := now() - make_interval(days => p_retention_days);
  v_deleted   INTEGER := 0;
  v_this_pass INTEGER;
BEGIN
  -- org_ntf_outbox_dtl: terminal rows only, keyed off whichever terminal
  -- timestamp is actually set (finalized_at normally; delivered_at as a
  -- fallback for an older row shape; created_at as the last resort so a
  -- terminal row with no timestamp populated is never retained forever).
  DELETE FROM public.org_ntf_outbox_dtl
  WHERE status IN ('SENT', 'DELIVERED', 'READ', 'FAILED_PERMANENT', 'SKIPPED', 'CANCELLED')
    AND COALESCE(finalized_at, delivered_at, created_at) < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  -- org_ntf_delivery_log_dtl: every row here is already a terminal attempt
  -- record (an in-flight attempt has no delivery-log row yet) — age alone,
  -- off logged_at, is sufficient.
  DELETE FROM public.org_ntf_delivery_log_dtl
  WHERE logged_at < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  -- org_ntf_receipts_tr: immutable receipt evidence, swept off received_at.
  DELETE FROM public.org_ntf_receipts_tr
  WHERE received_at < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  -- org_ntf_inbox_mst: only rows already read or already expired are
  -- eligible — an unread, unexpired in-app notification is never purged
  -- purely by age.
  DELETE FROM public.org_ntf_inbox_mst
  WHERE (is_read = true OR (expires_at IS NOT NULL AND expires_at < now()))
    AND created_at < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  -- hq_ntf_dispatch_log: terminal HQ-side dispatch ledger rows, keyed off
  -- whichever terminal timestamp is set.
  DELETE FROM public.hq_ntf_dispatch_log
  WHERE status IN ('SENT', 'PERMANENT_FAILURE')
    AND COALESCE(dispatched_at, failed_at, created_at) < v_cutoff;
  GET DIAGNOSTICS v_this_pass = ROW_COUNT;
  v_deleted := v_deleted + v_this_pass;

  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.fn_ntf_retention_sweep(INTEGER) IS
  'Purges terminal Notification Hub rows (outbox, delivery log, receipts, in-app inbox, HQ dispatch log) older than the retention window (default 180 days, matching the existing fn_auth_sessions_sweep precedent). Only ever touches rows already in a terminal/concluded state; never a PENDING/in-flight row regardless of age. Returns total rows deleted. Run by a scheduled job (ntf-retention-sweep).';

REVOKE EXECUTE ON FUNCTION public.fn_ntf_retention_sweep(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ntf_retention_sweep(INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- Scheduled sweep — once daily is sufficient for a 180-day window; no need
-- for the 5-minute cadence the auth-session sweep uses (that job also ENDS
-- live-but-expired sessions, a time-sensitive security action this sweep has
-- no equivalent of — it only purges rows already terminal for months).
-- ---------------------------------------------------------------------------
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ntf-retention-sweep';

SELECT cron.schedule(
  'ntf-retention-sweep',
  '0 4 * * *',
  $$ SELECT public.fn_ntf_retention_sweep(180) $$
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ntf-retention-sweep') THEN
    RAISE EXCEPTION '0609: ntf-retention-sweep cron job was not registered';
  END IF;
END $$;

COMMIT;
