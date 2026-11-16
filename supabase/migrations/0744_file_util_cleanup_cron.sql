-- =============================================================================
-- Migration: 0744_file_util_cleanup_cron.sql
-- Purpose:   File Util cleanup, database side. fn_file_util_expire_pending
--            marks PENDING uploads older than 24 hours as DELETED (abandoned);
--            an hourly pg_cron job runs it. Pure data, no app involved.
--            The stored bytes of DELETED files are purged by the HQ
--            platform-workers job `file-util-purge` (cleanmatexsaas) through the
--            Storage API, which then sets purged_at. SQL cannot delete the bytes:
--            they live in the S3 object store outside Postgres, and
--            storage.protect_delete blocks direct deletes from storage.objects.
-- Affected:  fn_file_util_expire_pending (new), cron job file-util-expire,
--            sys_ops_job_cf row file-util-expire
-- Related:   0743 (org_file_mst, idx_ofm_pending, idx_ofm_purge)
-- Plan:      docs/features/File_Util/PLAN.md (task 2.5, decision 13)
-- =============================================================================

BEGIN;

-- Expires abandoned uploads: the browser got an upload URL but never completed.
-- Cross-tenant system job (no session tenant); touches only stale PENDING rows.
-- Bounded per run so a large backlog never holds long locks; the next run
-- continues. Their stored bytes (if any were uploaded) are purged by the HQ worker.
CREATE OR REPLACE FUNCTION public.fn_file_util_expire_pending()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.org_file_mst f
     SET status_code   = 'DELETED',
         deleted_at    = now(),
         deleted_by    = 'system',
         deleted_info  = 'file-util:abandoned-upload',
         rec_status    = 0,
         is_active     = false,
         updated_by    = 'system',
         updated_info  = 'file-util:expire-pending'
   WHERE f.id IN (
           SELECT p.id
             FROM public.org_file_mst p
            WHERE p.status_code = 'PENDING'
              AND p.created_at < now() - interval '24 hours'
            ORDER BY p.created_at
            LIMIT 5000
         )
     AND f.status_code = 'PENDING';  -- re-checked: a concurrent complete wins
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.fn_file_util_expire_pending() IS
  'File Util cleanup (database side): marks PENDING uploads older than 24 hours as DELETED (abandoned), at most 5000 per run, oldest first; returns rows changed. Uses idx_ofm_pending. Stored bytes are purged by the HQ platform-workers job file-util-purge. Internal; revoked from API roles.';

-- Internal only: cross-tenant write, run by pg_cron as the owner.
REVOKE ALL ON FUNCTION public.fn_file_util_expire_pending() FROM PUBLIC, anon, authenticated, service_role;

-- Re-runnable: drop any previous schedule with this name before creating it.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'file-util-expire';
-- Hourly at minute 17 (off the hour, away from the 02:xx/03:xx nightly jobs).
SELECT cron.schedule('file-util-expire', '17 * * * *', $$ SELECT public.fn_file_util_expire_pending() $$);

-- Registered in the HQ ops job registry (/ops/jobs): HQ can see drift, pause,
-- run now and restore it from the migration-owned command below (0657 contract).
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2,
  category, module, sub_system, kind, cron_job_name,
  default_schedule, desired_enabled, run_now_allowed, completion_mode,
  source_migration, restore_command, notes, created_info
) VALUES (
  'file-util-expire', 'File Util: expire abandoned uploads', 'إدارة الملفات: إنهاء الرفع المتروك',
  'Every hour: uploads started more than 24 hours ago and never completed are marked deleted. Their stored bytes are purged by the HQ platform-workers job file-util-purge.',
  'كل ساعة: عمليات الرفع التي بدأت قبل أكثر من 24 ساعة ولم تكتمل تُعلَّم كمحذوفة. تُزال ملفاتها المخزنة بمهمة file-util-purge في عامل إدارة المنصة.',
  'CLEANUP', 'file_util', NULL, 'PG_CRON', 'file-util-expire',
  '17 * * * *', true, true, 'SYNC',
  '0744', $cmd$SELECT public.fn_file_util_expire_pending()$cmd$, NULL, '0744 seed'
)
ON CONFLICT (job_code) DO NOTHING;

COMMIT;
