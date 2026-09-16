-- =============================================================================
-- 0505_fin_jobs_outbox_and_cn_expiry.sql
-- Finance jobs hub — outbox processor + ledger-aware credit-note expiry
--
-- Purpose:
--   1. Expand sys_fin_job_run_log.job_code to include outbox_processor and
--      credit_note_expiry (B19's CHECK listed only the original 3 codes).
--   2. Enforce at most one RUNNING row per job_code so overlapping Run Now /
--      cron ticks cannot start a second sweep.
--   3. Expose cron.job health to the ops screen via SECURITY DEFINER
--      fin_list_job_schedules() (web-admin cannot SELECT cron.job directly).
--   4. Retire the competing raw expiry cron expire-credit-notes /
--      fn_expire_credit_notes() — same defect B19 documented for gift cards
--      (bare UPDATE ... SET status='EXPIRED', zero ledger rows). Leave the
--      SQL function defined (not dropped — no DROP CASCADE).
--   5. Register fin-credit-note-expiry at 02:05 daily through the existing
--      fin_trigger_job() dispatcher (same secret / process-jobs route).
--
-- The outbox processor cron (fin-outbox-processor, every minute, 0410) is
-- unchanged. Application code now wraps each tick in sys_fin_job_run_log.
--
-- Explicitly NOT in this migration:
--   wallet expiry, loyalty-points expiry (same B19 deferrals).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Allow the two new job codes on the run-log CHECK
-- -----------------------------------------------------------------------------

ALTER TABLE public.sys_fin_job_run_log
  DROP CONSTRAINT chk_fjrl_job_code RESTRICT;

ALTER TABLE public.sys_fin_job_run_log
  ADD CONSTRAINT chk_fjrl_job_code CHECK (job_code IN (
    'gift_card_expiry',
    'idempotency_cleanup',
    'erp_posting_retry',
    'outbox_processor',
    'credit_note_expiry'
  ));

COMMENT ON TABLE public.sys_fin_job_run_log IS
  'Run-history ledger for finance maintenance jobs (outbox processor, gift-card expiry, credit-note expiry, idempotency-key cleanup, ERP posting-retry). System-level: every job is a cross-tenant sweep.';

-- -----------------------------------------------------------------------------
-- 2. At most one in-flight run per job (overlap guard)
-- -----------------------------------------------------------------------------

-- Finalize any leftover RUNNING rows before the unique index can be created.
UPDATE public.sys_fin_job_run_log
SET    status        = 'FAILED',
       error_message = COALESCE(error_message, 'STALE_RUNNING_RELEASED'),
       finished_at   = COALESCE(finished_at, CURRENT_TIMESTAMP)
WHERE  status = 'RUNNING';

CREATE UNIQUE INDEX IF NOT EXISTS uq_fjrl_one_running
  ON public.sys_fin_job_run_log (job_code)
  WHERE status = 'RUNNING';

-- -----------------------------------------------------------------------------
-- 3. Cron schedule/health lookup for the ops screen
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fin_list_job_schedules()
RETURNS TABLE (
  job_code   TEXT,
  cron_name  TEXT,
  schedule   TEXT,
  is_active  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.job_code,
    m.cron_name,
    j.schedule,
    COALESCE(j.active, false)
  FROM (
    VALUES
      ('outbox_processor'::text,     'fin-outbox-processor'::text),
      ('gift_card_expiry'::text,     'fin-gift-card-expiry'::text),
      ('credit_note_expiry'::text,   'fin-credit-note-expiry'::text),
      ('idempotency_cleanup'::text,  'fin-idempotency-cleanup'::text),
      ('erp_posting_retry'::text,    'fin-erp-posting-retry'::text)
  ) AS m(job_code, cron_name)
  LEFT JOIN cron.job j ON j.jobname = m.cron_name;
END;
$$;

COMMENT ON FUNCTION public.fin_list_job_schedules() IS
  'Ops-screen read of pg_cron rows for the registered finance jobs. SECURITY DEFINER because cron.job is not granted to the app role.';

REVOKE ALL ON FUNCTION public.fin_list_job_schedules() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fin_list_job_schedules() TO postgres, service_role, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Retire the ledger-less credit-note expiry cron; register the app job
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-credit-notes') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'expire-credit-notes';
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fin-credit-note-expiry') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fin-credit-note-expiry';
  END IF;
END $$;

-- Daily 02:05 — same slot expire-credit-notes previously ran in, after gift-card expiry at 02:00.
SELECT cron.schedule(
  'fin-credit-note-expiry',
  '5 2 * * *',
  $$SELECT public.fin_trigger_job('credit_note_expiry')$$
);

-- -----------------------------------------------------------------------------
-- 5. Validation
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_constraint
  WHERE conname = 'chk_fjrl_job_code'
    AND contype = 'c';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'chk_fjrl_job_code was not recreated';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-credit-notes') THEN
    RAISE EXCEPTION 'expire-credit-notes was not successfully unscheduled';
  END IF;

  SELECT COUNT(*) INTO v_count FROM cron.job WHERE jobname = 'fin-credit-note-expiry';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'fin-credit-note-expiry was not scheduled';
  END IF;

  RAISE NOTICE 'Migration 0505 validation passed';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Do NOT drop fn_expire_credit_notes() — orphaned, harmless, same pattern
--    as fn_expire_gift_cards() after 0429.
-- 2. Application credit-note expiry writes org_credit_note_txn_dtl EXPIRY rows
--    and zeros remaining_balance. Cards that already expired via the raw cron
--    are NOT retroactively ledger-corrected (no honest lineage).
-- 3. Rollback: unschedule fin-credit-note-expiry, re-schedule expire-credit-notes
--    at '5 2 * * *' calling fn_expire_credit_notes(), drop fin_list_job_schedules,
--    drop uq_fjrl_one_running, restore chk_fjrl_job_code to the original 3 codes.
-- =============================================================================
