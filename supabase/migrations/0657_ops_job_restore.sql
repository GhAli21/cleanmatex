-- =============================================================================
-- 0657_ops_job_restore.sql
-- Purpose: allow HQ to recreate a migration-tracked pg_cron job that was deleted.
-- Safety: commands remain migration-owned, are never accepted from the API, and are
--         never returned by the job-list function.
-- Apply: review only; the user applies this migration.
-- Reversal: after disabling the HQ restore endpoint, DROP FUNCTION
--           fn_ops_job_restore(TEXT, TEXT), DROP CONSTRAINT
--           ck_sys_ops_job_cf_restore_cmd, then DROP COLUMN restore_command.
--           No existing cron.job row is changed by that reversal.
-- =============================================================================

BEGIN;

ALTER TABLE public.sys_ops_job_cf
  ADD COLUMN IF NOT EXISTS restore_command TEXT;

COMMENT ON COLUMN public.sys_ops_job_cf.restore_command IS
  'Migration-owned SQL used only by fn_ops_job_restore to recreate a missing pg_cron row. Never returned to HQ clients or editable through the API; NULL means restore is unavailable.';

COMMENT ON TABLE public.sys_ops_job_cf IS
  'Platform-global registry of operator-manageable scheduled jobs (intended state). Actual state is read live from cron.job. Recovery commands are migration-owned and never returned to or editable by HQ clients.';

-- Recovery commands are copied from the latest migration that owns each tracked job.
-- The two untracked housekeeping jobs intentionally remain NULL and cannot be recreated
-- from HQ until their commands are placed under migration ownership.
UPDATE public.sys_ops_job_cf AS c
SET restore_command = s.restore_command,
    updated_info = '0657 restore command catalog'
FROM (
  VALUES
    ('ntf-outbox-processor', $cmd$SELECT public.ntf_trigger_outbox_proc()$cmd$),
    ('ntf-outbox-retry', $cmd$
      UPDATE public.org_ntf_outbox_dtl
      SET status = 'QUEUED', updated_at = NOW()
      WHERE status = 'FAILED_TEMPORARY'
        AND next_retry_at <= NOW()
        AND retry_count < max_retries
    $cmd$),
    ('ntf-campaign-scheduler', $cmd$SELECT public.ntf_trigger_campaign_proc()$cmd$),
    ('ntf-reconcile-outbox', $cmd$
      SELECT net.http_post(
        url := current_setting('app.next_js_base_url', true) || '/api/notifications/reconcile-outbox',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.outbox_secret_key', true)
        ),
        body := '{}'::jsonb
      )
    $cmd$),
    ('ntf-sweep-stale-push-subs', $cmd$SELECT public.ntf_sweep_stale_push_subs()$cmd$),
    ('ntf-retention-sweep', $cmd$SELECT public.fn_ntf_retention_run()$cmd$),
    ('ntf-quota-rsv-sweep', $cmd$SELECT public.fn_ntf_quota_rsv_sweep(30)$cmd$),
    ('fin-outbox-processor', $cmd$SELECT public.fin_trigger_outbox_proc()$cmd$),
    ('fin-gift-card-expiry', $cmd$SELECT public.fin_trigger_job('gift_card_expiry')$cmd$),
    ('fin-idempotency-cleanup', $cmd$SELECT public.fin_trigger_job('idempotency_cleanup')$cmd$),
    ('fin-erp-posting-retry', $cmd$SELECT public.fin_trigger_job('erp_posting_retry')$cmd$),
    ('fin-credit-note-expiry', $cmd$SELECT public.fin_trigger_job('credit_note_expiry')$cmd$),
    ('fin-loyalty-points-expiry', $cmd$SELECT public.fin_trigger_job('loyalty_points_expiry')$cmd$),
    ('fin-pos-session-rollover', $cmd$SELECT public.fin_trigger_job('pos_session_rollover')$cmd$),
    ('auth-session-sweep', $cmd$SELECT public.fn_auth_sessions_sweep(180)$cmd$),
    ('ops-job-run-capture', $cmd$SELECT public.fn_ops_job_capture_runs()$cmd$)
) AS s(job_code, restore_command)
WHERE c.job_code = s.job_code;

ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_restore_cmd CHECK (
    source_migration IS NULL
    OR (restore_command IS NOT NULL AND btrim(restore_command) <> '')
  );

COMMENT ON CONSTRAINT ck_sys_ops_job_cf_restore_cmd ON public.sys_ops_job_cf IS
  'A migration-tracked job must keep a non-empty migration-owned recovery command, making source_migration a reliable restore-capability signal for HQ.';

-- Recreates only a missing row from protected catalog data. The registry row lock
-- serializes concurrent restore requests. A disabled intended state is applied inside
-- the same transaction, so the new job is never visible as active after commit.
CREATE OR REPLACE FUNCTION public.fn_ops_job_restore(
  p_job_code TEXT,
  p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_cfg public.sys_ops_job_cf%ROWTYPE;
  v_jobid BIGINT;
  v_schedule TEXT;
  v_actor TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
  v_actor_id UUID;
  v_updated_at TIMESTAMPTZ;
BEGIN
  IF v_actor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_actor_id := v_actor::UUID;
  ELSE
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_ACTOR',
      'message', 'Authenticated HQ actor id is required', 'job_code', p_job_code);
  END IF;

  SELECT * INTO v_cfg
  FROM public.sys_ops_job_cf
  WHERE job_code = p_job_code AND rec_status = 1 AND is_active
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND',
      'message', 'Job is not registered', 'job_code', p_job_code);
  END IF;

  SELECT jobid INTO v_jobid
  FROM cron.job
  WHERE jobname = v_cfg.cron_job_name;

  IF v_jobid IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_EXISTS',
      'message', 'Job already exists in the scheduler', 'job_code', p_job_code);
  END IF;

  IF v_cfg.restore_command IS NULL OR btrim(v_cfg.restore_command) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RESTORE_UNAVAILABLE',
      'message', 'This job has no migration-owned recovery command', 'job_code', p_job_code);
  END IF;

  v_schedule := COALESCE(v_cfg.schedule, v_cfg.default_schedule);
  IF length(v_schedule) > 100 OR v_schedule !~ '^[0-9*/,-]+( [0-9*/,-]+){4}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SCHEDULE',
      'message', 'Stored schedule is invalid', 'job_code', p_job_code);
  END IF;

  BEGIN
    v_jobid := cron.schedule(v_cfg.cron_job_name, v_schedule, v_cfg.restore_command);
    IF NOT v_cfg.desired_enabled THEN
      PERFORM cron.alter_job(job_id => v_jobid, active => false);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'fn_ops_job_restore failed for job %: [%] %', p_job_code, SQLSTATE, SQLERRM;
    RETURN jsonb_build_object('ok', false, 'code', 'RESTORE_FAILED',
      'message', 'The scheduler could not recreate the job', 'job_code', p_job_code);
  END;

  -- The table trigger also uses transaction_timestamp(), keeping both audit fields exact.
  v_updated_at := transaction_timestamp();

  UPDATE public.sys_ops_job_cf
  SET updated_at = v_updated_at,
      updated_by = v_actor_id,
      updated_info = format(
        'fn_ops_job_restore by %s at %s',
        v_actor,
        to_char(v_updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
  WHERE job_code = p_job_code;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'RESTORED',
    'message', 'Job recreated in the scheduler',
    'job_code', p_job_code,
    'jobid', v_jobid,
    'schedule', v_schedule,
    'active', v_cfg.desired_enabled
  );
END;
$$;

COMMENT ON FUNCTION public.fn_ops_job_restore(TEXT, TEXT) IS
  'Recreates a missing registered pg_cron job from its migration-owned recovery command and intended schedule/state, then records the required authenticated HQ actor UUID and UTC restore time. Uses a pinned system-only search path, accepts no SQL and returns no command text.';

REVOKE ALL ON FUNCTION public.fn_ops_job_restore(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_restore(TEXT, TEXT) TO service_role;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.sys_ops_job_cf
    WHERE job_code = ANY (ARRAY[
      'ntf-outbox-processor', 'ntf-outbox-retry', 'ntf-campaign-scheduler',
      'ntf-reconcile-outbox', 'ntf-sweep-stale-push-subs', 'ntf-retention-sweep',
      'ntf-quota-rsv-sweep', 'fin-outbox-processor', 'fin-gift-card-expiry',
      'fin-idempotency-cleanup', 'fin-erp-posting-retry', 'fin-credit-note-expiry',
      'fin-loyalty-points-expiry', 'fin-pos-session-rollover', 'auth-session-sweep',
      'ops-job-run-capture'
    ])
      AND restore_command IS NOT NULL
  ) <> 16 THEN
    RAISE EXCEPTION '0657: recovery command catalog is incomplete';
  END IF;

  IF has_function_privilege('anon', 'public.fn_ops_job_restore(text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ops_job_restore(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION '0657: restore function is executable by a browser role';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.fn_ops_job_restore(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION '0657: service_role cannot execute the restore function';
  END IF;

  IF has_column_privilege('anon', 'public.sys_ops_job_cf', 'restore_command', 'SELECT')
     OR has_column_privilege('authenticated', 'public.sys_ops_job_cf', 'restore_command', 'SELECT') THEN
    RAISE EXCEPTION '0657: recovery commands are readable by a browser role';
  END IF;
END $$;

COMMIT;
