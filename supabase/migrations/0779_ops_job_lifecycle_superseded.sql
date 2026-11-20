-- =============================================================================
-- Migration: 0779_ops_job_lifecycle_superseded.sql
-- Purpose:   I11 WP0 honesty: registry lifecycle so HTTP pg_net jobs cannot be
--            Enabled / Restored / Run now. Operators must see SUPERSEDED as
--            retired, not "Missing in scheduler — fix me". Align HQ_WORKER
--            operator copy with the 15-minute safety-sweep tick (D10).
-- Affected:  sys_ops_job_cf; fn_ops_job_list_v2 (signature change); fn_ops_job_set_state;
--            fn_ops_job_run_now; fn_ops_job_set_state_v2; fn_ops_job_restore_v2;
--            fn_ops_job_run_now_v2
-- Related:   0610, 0755, 0768; I11 expert replan D11/D15
-- Safety:    DRAFT ONLY. Review and apply manually. Does not create or alter
--            cron.job, does not enable delivery, does not grant anon/authenticated.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- lifecycle_status: ACTIVE jobs may be operated per operator_actions; SUPERSEDED/RETIRED
-- stay in the catalog for audit and must never mutate the scheduler.
ALTER TABLE public.sys_ops_job_cf
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE';

COMMENT ON COLUMN public.sys_ops_job_cf.lifecycle_status IS
  'ACTIVE: operator_actions apply. SUPERSEDED: replaced by another executor (I11 HTTP freeze); RETIRED: permanently unused. Default ACTIVE.';

ALTER TABLE public.sys_ops_job_cf
  ADD COLUMN IF NOT EXISTS superseded_by TEXT;

COMMENT ON COLUMN public.sys_ops_job_cf.superseded_by IS
  'Optional job_code of the replacement when lifecycle_status is SUPERSEDED. NULL until that job is seeded (WP3/WP5).';

ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT IF EXISTS ck_sys_ops_job_cf_lifecycle;
ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_lifecycle CHECK (lifecycle_status IN ('ACTIVE', 'SUPERSEDED', 'RETIRED'));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_lifecycle ON public.sys_ops_job_cf IS
  'Only the reviewed lifecycle codes may be stored.';

ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT IF EXISTS ck_sys_ops_job_cf_superseded_by;
ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_superseded_by CHECK (
    superseded_by IS NULL OR (length(btrim(superseded_by)) BETWEEN 1 AND 64)
  );
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_superseded_by ON public.sys_ops_job_cf IS
  'Replacement job_code is optional; when set it is a short registry code, not a command.';

-- I11 WP0 D11: HTTP wrappers that must not be restored as pg_net until WP5 replacements exist.
UPDATE public.sys_ops_job_cf
SET lifecycle_status = 'SUPERSEDED',
    desired_enabled = false,
    run_now_allowed = false,
    operator_actions = ARRAY['OBSERVE']::TEXT[],
    notes = CASE job_code
      WHEN 'ntf-outbox-processor' THEN
        'I11 WP0 SUPERSEDED. Canonical send is HQ worker claim/finalize (ntf-outbox-dispatch in WP3). Do not Enable, Restore, or Run now. Campaigns/finance HTTP jobs are frozen until WP5 (D15).'
      WHEN 'ntf-campaign-scheduler' THEN
        'I11 WP0 SUPERSEDED (D15 freeze). Campaign expansion via HTTP is paused until a DATABASE/HQ_WORKER replacement is registered in WP5. Observe only.'
      WHEN 'ntf-reconcile-outbox' THEN
        'I11 WP0 SUPERSEDED. Reconciliation will return as ntf-outbox-reconcile after dispatch soak. Do not restore the HTTP wrapper.'
      WHEN 'fin-outbox-processor' THEN
        'I11 WP0 SUPERSEDED (D15 freeze). Finance outbox HTTP is paused until WP5. Observe only.'
      WHEN 'fin-gift-card-expiry' THEN
        'I11 WP0 SUPERSEDED (D15 freeze). Gift-card expiry HTTP is paused until WP5. Observe only.'
      WHEN 'fin-credit-note-expiry' THEN
        'I11 WP0 SUPERSEDED (D15 freeze). Credit-note expiry HTTP is paused until WP5. Observe only.'
      WHEN 'fin-loyalty-points-expiry' THEN
        'I11 WP0 SUPERSEDED (D15 freeze). Loyalty expiry HTTP is paused until WP5. Observe only.'
      WHEN 'fin-erp-posting-retry' THEN
        'I11 WP0 SUPERSEDED (D15 freeze). ERP posting retry HTTP is paused until WP5. Observe only.'
      WHEN 'fin-pos-session-rollover' THEN
        'I11 WP0 SUPERSEDED (D15 freeze). POS rollover HTTP is paused until WP5. Observe only.'
      ELSE notes
    END,
    updated_info = '0779 I11 WP0 SUPERSEDED'
WHERE job_code IN (
  'ntf-outbox-processor',
  'ntf-campaign-scheduler',
  'ntf-reconcile-outbox',
  'fin-outbox-processor',
  'fin-gift-card-expiry',
  'fin-credit-note-expiry',
  'fin-loyalty-points-expiry',
  'fin-erp-posting-retry',
  'fin-pos-session-rollover'
);

-- ACTIVE but HTTP: strip restore/run so an operator cannot POST the tenant API from HQ.
UPDATE public.sys_ops_job_cf
SET operator_actions = ARRAY['OBSERVE']::TEXT[],
    run_now_allowed = false,
    notes = 'I11 WP0: HTTP restore and Run now stripped. Lifecycle stays ACTIVE until WP5 retargets this cleanup off HTTP. Observe only; do not recreate cron.job.',
    updated_info = '0779 I11 WP0 HTTP actions stripped'
WHERE job_code = 'fin-idempotency-cleanup';

UPDATE public.sys_ops_job_cf
SET notes = 'I11 pilot HQ_WORKER. The worker reads this row on the 15-minute tick (D10).',
    updated_info = '0779 I11 WP0 15 min tick copy'
WHERE job_code = 'file-util-purge';

-- After seed: SUPERSEDED/RETIRED rows cannot keep mutate capabilities or desired-on.
ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT IF EXISTS ck_sys_ops_job_cf_life_ops;
ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_life_ops CHECK (
    lifecycle_status = 'ACTIVE'
    OR (
      operator_actions = ARRAY['OBSERVE']::TEXT[]
      AND desired_enabled = false
      AND run_now_allowed = false
    )
  );
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_life_ops ON public.sys_ops_job_cf IS
  'SUPERSEDED and RETIRED jobs are observation-only, desired-off, and cannot offer Run now.';

-- Defense in depth: inner functions refuse SUPERSEDED even if a caller skips V2.
CREATE OR REPLACE FUNCTION public.fn_ops_job_set_state(p_job_code text, p_enabled boolean, p_schedule text, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'cron', 'pg_temp'
AS $function$
DECLARE
  v_cfg    public.sys_ops_job_cf%ROWTYPE;
  v_jobid  BIGINT;
  v_sched  TEXT;
  v_before JSONB;
  v_after  JSONB;
  v_actor  TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
BEGIN
  IF p_enabled IS NULL AND p_schedule IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOTHING_TO_CHANGE',
      'message', 'Provide enabled and/or schedule', 'job_code', p_job_code);
  END IF;

  SELECT * INTO v_cfg
  FROM public.sys_ops_job_cf
  WHERE job_code = p_job_code AND rec_status = 1 AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND',
      'message', 'Job is not registered', 'job_code', p_job_code);
  END IF;

  IF v_cfg.lifecycle_status IN ('SUPERSEDED', 'RETIRED') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SUPERSEDED',
      'message', 'This job is superseded and cannot be enabled or rescheduled', 'job_code', p_job_code);
  END IF;

  IF p_schedule IS NOT NULL THEN
    v_sched := btrim(p_schedule);
    IF length(v_sched) > 100 OR v_sched !~ '^[0-9*/,-]+( [0-9*/,-]+){4}$' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SCHEDULE',
        'message', 'Schedule must be 5 numeric cron fields', 'job_code', p_job_code);
    END IF;
  END IF;

  IF v_cfg.kind = 'HQ_WORKER' THEN
    v_before := jsonb_build_object('schedule', v_cfg.applied_schedule, 'active', v_cfg.applied_enabled);
    UPDATE public.sys_ops_job_cf
    SET desired_enabled = COALESCE(p_enabled, desired_enabled),
        schedule = CASE
                     WHEN v_sched IS NULL THEN schedule
                     WHEN v_sched = default_schedule THEN NULL
                     ELSE v_sched
                   END,
        updated_info = 'fn_ops_job_set_state by ' || v_actor
    WHERE job_code = p_job_code
    RETURNING jsonb_build_object('schedule', COALESCE(schedule, default_schedule), 'active', desired_enabled) INTO v_after;
    RETURN jsonb_build_object('ok', true, 'code', 'UPDATED',
      'message', 'Saved. The HQ worker applies it within about 15 minutes.',
      'job_code', p_job_code, 'before', v_before, 'after', v_after);
  END IF;

  SELECT j.jobid INTO v_jobid FROM cron.job j WHERE j.jobname = v_cfg.cron_job_name;
  IF v_jobid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_IN_CRON',
      'message', 'No cron.job row exists for this job', 'job_code', p_job_code);
  END IF;

  SELECT jsonb_build_object('schedule', j.schedule, 'active', j.active) INTO v_before
  FROM cron.job j WHERE j.jobid = v_jobid;

  BEGIN
    PERFORM cron.alter_job(job_id => v_jobid, schedule => v_sched, active => p_enabled);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALTER_FAILED',
      'message', left(SQLERRM, 500), 'job_code', p_job_code, 'before', v_before);
  END;

  UPDATE public.sys_ops_job_cf
  SET desired_enabled = COALESCE(p_enabled, desired_enabled),
      schedule = CASE
                   WHEN v_sched IS NULL THEN schedule
                   WHEN v_sched = default_schedule THEN NULL
                   ELSE v_sched
                 END,
      updated_info = 'fn_ops_job_set_state by ' || v_actor
  WHERE job_code = p_job_code;

  SELECT jsonb_build_object('schedule', j.schedule, 'active', j.active) INTO v_after
  FROM cron.job j WHERE j.jobid = v_jobid;

  RETURN jsonb_build_object('ok', true, 'code', 'UPDATED', 'message', 'Job updated',
    'job_code', p_job_code, 'before', v_before, 'after', v_after);
END;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_set_state(text, boolean, text, text) IS
  'Job Manager: enable/disable and/or reschedule. Refuses SUPERSEDED/RETIRED (0779). HQ_WORKER stores desired state; the worker applies it within about 15 minutes. service_role only; called through fn_ops_job_set_state_v2.';

CREATE OR REPLACE FUNCTION public.fn_ops_job_run_now(p_job_code text, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'cron', 'pg_temp'
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_cfg      public.sys_ops_job_cf%ROWTYPE;
  v_command  TEXT;
  v_started  TIMESTAMPTZ;
  v_finished TIMESTAMPTZ;
  v_status   TEXT;
  v_message  TEXT;
  v_rows     BIGINT;
  v_req_id   UUID;
  v_actor    TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'unknown'), 120);
BEGIN
  SELECT * INTO v_cfg
  FROM public.sys_ops_job_cf
  WHERE job_code = p_job_code AND rec_status = 1 AND is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'job_code', p_job_code,
      'message', 'Job is not registered');
  END IF;

  IF v_cfg.lifecycle_status IN ('SUPERSEDED', 'RETIRED') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SUPERSEDED', 'job_code', p_job_code,
      'message', 'This job is superseded and cannot be run');
  END IF;

  IF NOT v_cfg.run_now_allowed THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RUN_NOT_ALLOWED', 'job_code', p_job_code,
      'message', 'Manual run is not allowed for this job');
  END IF;

  IF v_cfg.kind = 'HQ_WORKER' THEN
    BEGIN
      INSERT INTO public.sys_ops_job_req_tr (job_code, trigger_type, status, requested_by, created_by, created_info)
      VALUES (p_job_code, 'MANUAL', 'REQUESTED', v_actor, v_actor, 'fn_ops_job_run_now')
      RETURNING id INTO v_req_id;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_RUNNING', 'job_code', p_job_code,
        'message', 'A manual run of this job is already waiting or running');
    END;
    RETURN jsonb_build_object(
      'ok', true, 'code', 'QUEUED', 'status', 'QUEUED', 'job_code', p_job_code, 'request_id', v_req_id,
      'message', CASE
        WHEN v_cfg.applied_at IS NULL OR v_cfg.applied_at < now() - interval '15 minutes'
          THEN 'Queued, but the HQ worker has not reported for 15 minutes: the run starts when it is back.'
        ELSE 'Queued. The HQ worker starts it within about 15 minutes; the result appears in the run history.'
      END);
  END IF;

  SELECT j.command INTO v_command FROM cron.job j WHERE j.jobname = v_cfg.cron_job_name;
  IF v_command IS NULL OR btrim(v_command) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_IN_CRON', 'job_code', p_job_code,
      'message', 'No cron command found for this job');
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtextextended('ops_job_run:' || p_job_code, 0)) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ALREADY_RUNNING', 'job_code', p_job_code,
      'message', 'A manual run of this job is already in progress');
  END IF;

  v_started := clock_timestamp();
  BEGIN
    EXECUTE v_command;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_cfg.completion_mode = 'ASYNC_HTTP' THEN
      v_status := 'DISPATCHED';
      v_message := 'Handed to the async HTTP worker; the outcome is not observable here';
    ELSE
      v_status := 'SUCCESS';
      v_message := 'Completed; rows affected: ' || COALESCE(v_rows, 0)::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_status := 'FAILED';
    v_message := left(SQLERRM, 500);
  END;
  v_finished := clock_timestamp();

  INSERT INTO public.sys_ops_job_run_dtl (
    job_code, started_at, finished_at, status, message, trigger_type, actor, created_info
  ) VALUES (
    p_job_code, v_started, v_finished, v_status, v_message, 'MANUAL', v_actor, 'fn_ops_job_run_now'
  );

  RETURN jsonb_build_object(
    'ok', v_status <> 'FAILED',
    'code', CASE WHEN v_status = 'FAILED' THEN 'FAILED' ELSE 'EXECUTED' END,
    'status', v_status,
    'message', v_message,
    'job_code', p_job_code,
    'started_at', v_started,
    'finished_at', v_finished
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'code', 'FAILED', 'status', 'FAILED',
    'message', left(SQLERRM, 500), 'job_code', p_job_code);
END;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_run_now(text, text) IS
  'Job Manager Run now. Refuses SUPERSEDED/RETIRED (0779). HQ_WORKER queues a MANUAL request; worker starts it within about 15 minutes. service_role only; called through fn_ops_job_run_now_v2.';

-- RETURNS TABLE adds lifecycle_status and superseded_by; DROP is required.
DROP FUNCTION IF EXISTS public.fn_ops_job_list_v2();

CREATE FUNCTION public.fn_ops_job_list_v2()
 RETURNS TABLE(
   job_code text, name text, name2 text, description text, description2 text,
   category text, module text, sub_system text, kind text, cron_job_name text,
   default_schedule text, schedule_override text, effective_schedule text,
   actual_schedule text, actual_active boolean, desired_enabled boolean,
   cron_jobid bigint, command_present boolean, run_now_allowed boolean,
   completion_mode text, source_migration text, notes text, is_active boolean,
   operator_actions text[], drift_flags text[],
   last_run_at timestamp with time zone, last_run_status text, last_run_message text,
   last_run_source text, last_run_trigger text, last_run_actor text,
   lifecycle_status text, superseded_by text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'cron', 'pg_temp'
AS $function$
  SELECT
    c.job_code, c.name, c.name2, c.description, c.description2,
    c.category, c.module, c.sub_system, c.kind, c.cron_job_name,
    c.default_schedule, c.schedule, COALESCE(c.schedule, c.default_schedule),
    CASE WHEN c.kind = 'HQ_WORKER' THEN c.applied_schedule ELSE j.schedule END,
    CASE WHEN c.kind = 'HQ_WORKER' THEN c.applied_enabled ELSE j.active END,
    c.desired_enabled, j.jobid,
    CASE WHEN c.kind = 'HQ_WORKER' THEN c.applied_at IS NOT NULL
         ELSE COALESCE(j.command IS NOT NULL AND btrim(j.command) <> '', false) END,
    c.run_now_allowed, c.completion_mode, c.source_migration, c.notes, c.is_active,
    c.operator_actions,
    CASE WHEN c.lifecycle_status IN ('SUPERSEDED', 'RETIRED') THEN
      ARRAY['SUPERSEDED']::text[]
    WHEN c.kind = 'HQ_WORKER' THEN
      ARRAY_REMOVE(ARRAY[
        CASE WHEN c.applied_at IS NULL OR c.applied_at < now() - interval '15 minutes' THEN 'WORKER_NOT_SEEN' END,
        CASE WHEN c.applied_at IS NOT NULL
               AND c.applied_schedule IS DISTINCT FROM COALESCE(c.schedule, c.default_schedule)
             THEN 'SCHEDULE_DRIFT' END,
        CASE WHEN c.applied_at IS NOT NULL AND c.applied_enabled IS DISTINCT FROM c.desired_enabled
             THEN 'STATE_DRIFT' END
      ], NULL)
    ELSE
      ARRAY_REMOVE(ARRAY[
        CASE WHEN j.jobid IS NULL THEN 'MISSING_IN_CRON' END,
        CASE WHEN j.jobid IS NOT NULL
               AND btrim(j.schedule) IS DISTINCT FROM COALESCE(c.schedule, c.default_schedule)
             THEN 'SCHEDULE_DRIFT' END,
        CASE WHEN j.jobid IS NOT NULL AND j.active IS DISTINCT FROM c.desired_enabled
             THEN 'STATE_DRIFT' END
      ], NULL)
    END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.started_at ELSE cr.run_at END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.status ELSE cr.run_status END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.message ELSE cr.run_message END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN 'OPS_LOG' WHEN cr.run_at IS NOT NULL THEN 'CRON' END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.trigger_type WHEN cr.run_at IS NOT NULL THEN 'SCHEDULE' END,
    CASE WHEN orr.started_at IS NOT NULL AND (cr.run_at IS NULL OR orr.started_at >= cr.run_at)
         THEN orr.actor END,
    c.lifecycle_status,
    c.superseded_by
  FROM public.sys_ops_job_cf c
  LEFT JOIN cron.job j ON j.jobname = c.cron_job_name AND c.kind = 'PG_CRON'
  LEFT JOIN LATERAL (
    SELECT d.start_time AS run_at,
           CASE d.status WHEN 'succeeded' THEN 'SUCCESS' WHEN 'failed' THEN 'FAILED' ELSE 'RUNNING' END AS run_status,
           left(d.return_message, 1000) AS run_message
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid AND d.start_time IS NOT NULL
    ORDER BY d.start_time DESC
    LIMIT 1
  ) cr ON true
  LEFT JOIN LATERAL (
    SELECT r.started_at, r.status, r.message, r.trigger_type, r.actor
    FROM public.sys_ops_job_run_dtl r
    WHERE r.job_code = c.job_code
    ORDER BY r.started_at DESC
    LIMIT 1
  ) orr ON true
  WHERE c.rec_status = 1
  ORDER BY c.module, c.job_code;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_list_v2() IS
  'Job Manager list with lifecycle_status (0779). SUPERSEDED/RETIRED report drift SUPERSEDED instead of MISSING_IN_CRON. HQ_WORKER actual state from applied_*. service_role only.';

CREATE OR REPLACE FUNCTION public.fn_ops_job_set_state_v2(
  p_job_code TEXT,
  p_enabled BOOLEAN,
  p_schedule TEXT,
  p_actor TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, cron, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sys_ops_job_cf
    WHERE job_code = p_job_code AND rec_status = 1 AND is_active
      AND lifecycle_status IN ('SUPERSEDED', 'RETIRED')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SUPERSEDED',
      'message', 'This job is superseded and cannot be enabled or rescheduled', 'job_code', p_job_code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sys_ops_job_cf
    WHERE job_code = p_job_code AND rec_status = 1 AND is_active
      AND 'SET_STATE' = ANY (operator_actions)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACTION_NOT_ALLOWED',
      'message', 'Schedule and state changes are not approved for this job', 'job_code', p_job_code);
  END IF;
  RETURN public.fn_ops_job_set_state(p_job_code, p_enabled, p_schedule, p_actor);
END;
$$;
COMMENT ON FUNCTION public.fn_ops_job_set_state_v2(TEXT, BOOLEAN, TEXT, TEXT) IS
  'Capability-gated set_state. Rejects SUPERSEDED/RETIRED before SET_STATE (0779).';

CREATE OR REPLACE FUNCTION public.fn_ops_job_restore_v2(p_job_code TEXT, p_actor TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, cron, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sys_ops_job_cf
    WHERE job_code = p_job_code AND rec_status = 1 AND is_active
      AND lifecycle_status IN ('SUPERSEDED', 'RETIRED')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SUPERSEDED',
      'message', 'This job is superseded and cannot be restored into the scheduler', 'job_code', p_job_code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sys_ops_job_cf
    WHERE job_code = p_job_code AND rec_status = 1 AND is_active
      AND 'RESTORE' = ANY (operator_actions)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACTION_NOT_ALLOWED',
      'message', 'Scheduler restore is not approved for this job', 'job_code', p_job_code);
  END IF;
  RETURN public.fn_ops_job_restore(p_job_code, p_actor);
END;
$$;
COMMENT ON FUNCTION public.fn_ops_job_restore_v2(TEXT, TEXT) IS
  'Capability-gated restore. Rejects SUPERSEDED/RETIRED before any recovery command (0779).';

CREATE OR REPLACE FUNCTION public.fn_ops_job_run_now_v2(p_job_code TEXT, p_actor TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, cron, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sys_ops_job_cf
    WHERE job_code = p_job_code AND rec_status = 1 AND is_active
      AND lifecycle_status IN ('SUPERSEDED', 'RETIRED')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'SUPERSEDED',
      'message', 'This job is superseded and cannot be run', 'job_code', p_job_code);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sys_ops_job_cf
    WHERE job_code = p_job_code AND rec_status = 1 AND is_active
      AND 'RUN_NOW' = ANY (operator_actions)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ACTION_NOT_ALLOWED',
      'message', 'Manual execution is not approved for this job', 'job_code', p_job_code);
  END IF;
  RETURN public.fn_ops_job_run_now(p_job_code, p_actor);
END;
$$;
COMMENT ON FUNCTION public.fn_ops_job_run_now_v2(TEXT, TEXT) IS
  'Capability-gated Run now. Rejects SUPERSEDED/RETIRED before stored-command execution (0779).';

REVOKE ALL ON FUNCTION public.fn_ops_job_list_v2() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_set_state(text, boolean, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_run_now(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_set_state_v2(TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_restore_v2(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_run_now_v2(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_ops_job_list_v2() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_set_state(text, boolean, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_run_now(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_set_state_v2(TEXT, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_restore_v2(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_run_now_v2(TEXT, TEXT) TO service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.fn_ops_job_list_v2()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ops_job_list_v2()', 'EXECUTE') THEN
    RAISE EXCEPTION '0779: public-key roles must not execute fn_ops_job_list_v2';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.fn_ops_job_list_v2()', 'EXECUTE') THEN
    RAISE EXCEPTION '0779: service_role missing fn_ops_job_list_v2 grant';
  END IF;
END $$;

COMMIT;
