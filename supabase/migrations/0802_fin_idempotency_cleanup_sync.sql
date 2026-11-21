-- =============================================================================
-- Migration: 0802_fin_idempotency_cleanup_sync.sql
-- Purpose:   I11. fin-idempotency-cleanup already runs
--            cleanup_expired_idempotency_keys() and returns a row count.
--            Its registry still says ASYNC_HTTP, which means the outcome is
--            unknown. Record it as SYNC. The cron row is not changed.
-- Affected:  sys_ops_job_cf row fin-idempotency-cleanup
-- Related:   0790 replaced the HTTP command. This corrects the leftover mode.
-- Safety:    DRAFT ONLY. Review and apply manually. Does not delete keys.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

UPDATE public.sys_ops_job_cf
SET completion_mode = 'SYNC',
    notes = '0802. The daily command is cleanup_expired_idempotency_keys() and its result is known when the function returns. One tick deletes at most 1000 expired keys. This is not an HTTP dispatch.',
    updated_at = now(),
    updated_info = '0802 fin-idempotency-cleanup sync'
WHERE job_code = 'fin-idempotency-cleanup'
  AND rec_status = 1
  AND lifecycle_status = 'ACTIVE'
  AND kind = 'PG_CRON';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'fin-idempotency-cleanup'
      AND schedule = '0 3 * * *'
      AND active
      AND btrim(command) = 'SELECT public.cleanup_expired_idempotency_keys()'
  ) THEN
    RAISE EXCEPTION '0802: fin-idempotency-cleanup cron command is not the SQL function';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'fin-idempotency-cleanup'
      AND kind = 'PG_CRON'
      AND completion_mode = 'SYNC'
      AND lifecycle_status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION '0802: fin-idempotency-cleanup was not marked SYNC';
  END IF;
END $$;

COMMIT;
