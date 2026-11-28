-- =============================================================================
-- 0857_bg_jobs_retire_old_plumbing.sql
-- Background Jobs step 8 (docs/features/Background_Jobs/STEP8_PLAN.md): remove the old background
-- plumbing now that every job runs on pg-boss (cmx-workers, HQ API queue consumer) or pg_cron.
--
-- Purpose:   1. Registry: delete the 12 retired rows (10 SUPERSEDED + the two never-enabled HQ worker
--               notification loops) with their run history and run requests.
--            2. Registry kind HQ_WORKER removed: no row uses it; the kind constraints and the three
--               shared ops-job functions lose their HQ_WORKER branches (bodies otherwise unchanged,
--               copied from the live definitions).
--            3. Functions used only by the deleted platform-workers / tenant job routes are dropped.
--            4. sys_fin_job_run_log (run log of the removed tenant Finance jobs hub) is dropped.
--            5. Permissions finance_jobs:view / finance_jobs:run (their screen was removed in 6f).
--            6. Notifications written before the queue release (23 Nov) that never got a delivery
--               job are marked SKIPPED so they stop showing as waiting.
-- Kept:      fn_ntf_worker_claim_one / _finalize_claim / _mark_uncertain / _reconcile_claim (used by
--            HQ API ntf.deliver); sys_ops_job_req_tr, fn_ops_job_sched_claim_manual,
--            fn_ops_job_finish, fn_ops_job_capture_runs (pg-boss schedules and pg_cron run history).
-- Before:    web-admin and HQ API deployed without the old routes / module (step 8 code).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- -----------------------------------------------------------------------------
-- 1. Retired registry rows, with their history (FKs are RESTRICT, so children first).
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _retired_jobs (job_code TEXT PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _retired_jobs (job_code) VALUES
    ('file-util-purge'),
    ('fin-erp-posting-retry'),
    ('fin-gift-card-expiry'),
    ('fin-loyalty-points-expiry'),
    ('fin-outbox-processor'),
    ('fin-pos-session-rollover'),
    ('ntf-campaign-scheduler'),
    ('ntf-outbox-dispatch'),
    ('ntf-outbox-shadow'),
    ('ntf-outbox-processor'),
    ('ntf-outbox-retry'),
    ('ntf-reconcile-outbox');

-- Guard: never delete a row something live still points at (a schedule target, a queue, a subscription).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sys_ops_job_cf c JOIN _retired_jobs r ON r.job_code = c.target_job_code
              WHERE c.job_code NOT IN (SELECT job_code FROM _retired_jobs))
     OR EXISTS (SELECT 1 FROM public.sys_ops_job_queue_cf q JOIN _retired_jobs r ON r.job_code = q.queue_name)
     OR EXISTS (SELECT 1 FROM public.sys_ops_job_event_subs_cf s JOIN _retired_jobs r ON r.job_code = s.queue_job_code)
     OR EXISTS (SELECT 1 FROM public.sys_ops_job_cf c JOIN _retired_jobs r ON r.job_code = c.job_code
                 WHERE c.desired_enabled) THEN
    RAISE EXCEPTION '0857: a retired job is still referenced or switched on; stop and check';
  END IF;
END $$;

-- Pseudo cron names of retired PG_CRON rows: remove the cron jobs if any still exist.
SELECT cron.unschedule(j.jobid)
  FROM cron.job j
  JOIN public.sys_ops_job_cf c ON c.cron_job_name = j.jobname
  JOIN _retired_jobs r ON r.job_code = c.job_code;

DELETE FROM public.sys_ops_job_run_dtl d USING _retired_jobs r WHERE d.job_code = r.job_code;
DELETE FROM public.sys_ops_job_req_tr q USING _retired_jobs r WHERE q.job_code = r.job_code;
DELETE FROM public.sys_ops_job_cf c USING _retired_jobs r WHERE c.job_code = r.job_code;

-- -----------------------------------------------------------------------------
-- 2. Kind HQ_WORKER removed (the HQ platform-workers service is deleted).
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.sys_ops_job_cf WHERE kind = 'HQ_WORKER' OR completion_mode = 'WORKER_QUEUE') THEN
    RAISE EXCEPTION '0857: HQ_WORKER rows remain; stop and check';
  END IF;
END $$;

ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_kind;
ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_kind_mode;
ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_applied;
ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_kind_shape;

-- Allowed kinds: pg_cron jobs, pg-boss queues and pg-boss schedules.
ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT ck_sys_ops_job_cf_kind
  CHECK (kind = ANY (ARRAY['PG_CRON'::text, 'PGBOSS_QUEUE'::text, 'PGBOSS_SCHEDULE'::text]));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_kind ON public.sys_ops_job_cf IS
  'Registry kinds: PG_CRON (pg_cron runs it), PGBOSS_QUEUE (a pg-boss queue a consumer works), PGBOSS_SCHEDULE (a pg-boss schedule that sends a job to its target queue). HQ_WORKER removed in 0857.';

-- pg-boss kinds and only they complete through pg-boss; no kind uses WORKER_QUEUE any more.
ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT ck_sys_ops_job_cf_kind_mode
  CHECK ((completion_mode <> 'WORKER_QUEUE'::text)
     AND ((kind = ANY (ARRAY['PGBOSS_QUEUE'::text, 'PGBOSS_SCHEDULE'::text])) = (completion_mode = 'PGBOSS'::text)));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_kind_mode ON public.sys_ops_job_cf IS
  'completion_mode PGBOSS exactly for the pg-boss kinds; WORKER_QUEUE (HQ worker) no longer allowed (0857).';

-- applied_* is written by the consumer that applies the row; pg_cron rows never have it.
ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT ck_sys_ops_job_cf_applied
  CHECK ((kind = ANY (ARRAY['PGBOSS_QUEUE'::text, 'PGBOSS_SCHEDULE'::text]))
      OR ((applied_schedule IS NULL) AND (applied_enabled IS NULL) AND (applied_at IS NULL) AND (applied_by IS NULL)));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_applied ON public.sys_ops_job_cf IS
  'applied_schedule / applied_enabled / applied_at / applied_by are reported by the consumer of a pg-boss row; NULL for PG_CRON rows.';

-- Columns each kind needs.
ALTER TABLE public.sys_ops_job_cf ADD CONSTRAINT ck_sys_ops_job_cf_kind_shape
  CHECK (CASE kind
    WHEN 'PG_CRON'::text THEN ((cron_job_name IS NOT NULL) AND (default_schedule IS NOT NULL) AND (target_job_code IS NULL))
    WHEN 'PGBOSS_QUEUE'::text THEN ((cron_job_name IS NULL) AND (default_schedule IS NULL) AND (schedule IS NULL) AND (target_job_code IS NULL) AND (NOT run_now_allowed))
    WHEN 'PGBOSS_SCHEDULE'::text THEN ((cron_job_name IS NULL) AND (default_schedule IS NOT NULL) AND (target_job_code IS NOT NULL) AND (target_job_code <> job_code))
    ELSE false
  END);
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_kind_shape ON public.sys_ops_job_cf IS
  'PG_CRON needs a cron job name and schedule; PGBOSS_QUEUE has no schedule and no Run now; PGBOSS_SCHEDULE has a schedule and a target queue other than itself.';

-- The three shared ops-job functions without their HQ_WORKER branches. CREATE OR REPLACE keeps
-- their owner, grants and comments.
CREATE OR REPLACE FUNCTION public.fn_ops_job_list_v2()
 RETURNS TABLE(job_code text, name text, name2 text, description text, description2 text, category text, module text, sub_system text, kind text, cron_job_name text, default_schedule text, schedule_override text, effective_schedule text, actual_schedule text, actual_active boolean, desired_enabled boolean, cron_jobid bigint, command_present boolean, run_now_allowed boolean, completion_mode text, source_migration text, notes text, is_active boolean, operator_actions text[], drift_flags text[], last_run_at timestamp with time zone, last_run_status text, last_run_message text, last_run_source text, last_run_trigger text, last_run_actor text, lifecycle_status text, superseded_by text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'cron', 'pg_temp'
AS $function$
  SELECT
    c.job_code, c.name, c.name2, c.description, c.description2,
    c.category, c.module, c.sub_system, c.kind, c.cron_job_name,
    c.default_schedule, c.schedule, COALESCE(c.schedule, c.default_schedule),
    CASE WHEN c.kind = 'PG_CRON' THEN j.schedule ELSE c.applied_schedule END,
    CASE WHEN c.kind = 'PG_CRON' THEN j.active ELSE c.applied_enabled END,
    c.desired_enabled, j.jobid,
    CASE WHEN c.kind = 'PG_CRON' THEN COALESCE(j.command IS NOT NULL AND btrim(j.command) <> '', false)
         ELSE c.applied_at IS NOT NULL END,
    c.run_now_allowed, c.completion_mode, c.source_migration, c.notes, c.is_active,
    c.operator_actions,
    CASE WHEN c.lifecycle_status IN ('SUPERSEDED', 'RETIRED') THEN
      ARRAY['SUPERSEDED']::text[]
    WHEN c.kind = 'PGBOSS_QUEUE' THEN
      ARRAY_REMOVE(ARRAY[
        CASE WHEN pq.name IS NULL THEN 'MISSING_IN_QUEUE' END,
        CASE WHEN qd.consumer_app IS DISTINCT FROM 'NONE'
               AND c.desired_enabled
               AND (c.applied_at IS NULL OR c.applied_at < now() - interval '20 minutes')
             THEN 'WORKER_NOT_SEEN' END,
        CASE WHEN c.applied_at IS NOT NULL AND c.applied_enabled IS DISTINCT FROM c.desired_enabled
             THEN 'STATE_DRIFT' END,
        CASE WHEN pq.name IS NOT NULL AND qd.queue_name IS NOT NULL AND (
               pq.retry_limit, pq.retry_delay, pq.retry_backoff, pq.retry_delay_max,
               pq.expire_seconds, pq.retention_seconds, pq.deletion_seconds,
               pq.heartbeat_seconds, pq.dead_letter
             ) IS DISTINCT FROM (
               qd.retry_limit, qd.retry_delay_s, qd.retry_backoff, qd.retry_delay_max_s,
               qd.expire_s, qd.retention_s, qd.delete_after_s,
               qd.heartbeat_s, qd.dead_letter_queue
             )
             THEN 'SETTINGS_DRIFT' END
      ], NULL)
    WHEN c.kind = 'PGBOSS_SCHEDULE' THEN
      ARRAY_REMOVE(ARRAY[
        CASE WHEN (
               c.desired_enabled
               OR EXISTS (
                 SELECT 1 FROM public.sys_ops_job_req_tr q
                 WHERE q.job_code = c.job_code
                   AND q.status = 'REQUESTED'
                   AND q.trigger_type = 'MANUAL'
                   AND q.is_active
                   AND q.rec_status = 1
               )
             )
             AND (c.applied_at IS NULL OR c.applied_at < now() - interval '20 minutes')
             THEN 'WORKER_NOT_SEEN' END,
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
  LEFT JOIN public.sys_ops_job_queue_cf qd ON qd.queue_name = c.job_code AND c.kind = 'PGBOSS_QUEUE'
  LEFT JOIN pgboss.queue pq ON pq.name = c.job_code AND c.kind = 'PGBOSS_QUEUE'
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

  IF v_cfg.kind = 'PGBOSS_QUEUE' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RUN_NOT_APPLICABLE', 'job_code', p_job_code,
      'message', 'A queue runs when jobs arrive; run its schedule or redrive its dead letters instead');
  END IF;

  IF NOT v_cfg.run_now_allowed THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RUN_NOT_ALLOWED', 'job_code', p_job_code,
      'message', 'Manual run is not allowed for this job');
  END IF;

  IF v_cfg.kind = 'PGBOSS_SCHEDULE' THEN
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
      'message', CASE WHEN v_cfg.applied_at IS NULL OR v_cfg.applied_at < now() - interval '20 minutes'
        THEN 'Queued, but the worker has not reported recently: the run starts when it is back.'
        ELSE 'Queued. The worker sends the job within about 30 seconds; the result appears in the run history.'
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

  IF v_cfg.kind = 'PGBOSS_QUEUE' THEN
    IF v_sched IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SCHEDULE_NOT_APPLICABLE',
        'message', 'A queue has no schedule; it runs when jobs arrive', 'job_code', p_job_code);
    END IF;
    v_before := jsonb_build_object('schedule', NULL, 'active', v_cfg.desired_enabled);
    UPDATE public.sys_ops_job_cf
    SET desired_enabled = p_enabled,
        updated_info = 'fn_ops_job_set_state by ' || v_actor
    WHERE job_code = p_job_code
    RETURNING jsonb_build_object('schedule', NULL, 'active', desired_enabled) INTO v_after;
    RETURN jsonb_build_object('ok', true, 'code', 'UPDATED',
      'message', CASE WHEN p_enabled THEN 'Saved. Consumers resume this queue within about 30 seconds.'
                      ELSE 'Saved. Consumers pause this queue within about 30 seconds; waiting jobs are kept.' END,
      'job_code', p_job_code, 'before', v_before, 'after', v_after);
  END IF;

  IF v_cfg.kind = 'PGBOSS_SCHEDULE' THEN
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
      'message', 'Saved. The worker applies the schedule within about 30 seconds.',
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

-- -----------------------------------------------------------------------------
-- 3. Functions only the deleted platform-workers / tenant job routes called.
-- -----------------------------------------------------------------------------
-- HQ worker registry claims (platform-workers ops loop).
DROP FUNCTION IF EXISTS public.fn_ops_job_claim(TEXT, TEXT) RESTRICT;
DROP FUNCTION IF EXISTS public.fn_ops_job_request_slot(TEXT, TIMESTAMPTZ, TEXT) RESTRICT;
DROP FUNCTION IF EXISTS public.fn_ops_worker_job_sync(TEXT, TEXT) RESTRICT;
-- Notification batch claims (platform-workers dispatch / shadow loops); ntf.deliver claims one row.
DROP FUNCTION IF EXISTS public.fn_ntf_worker_claim_due(UUID, TEXT, INTEGER, INTEGER) RESTRICT;
DROP FUNCTION IF EXISTS public.fn_ntf_worker_claim_due_global(TEXT, INTEGER, INTEGER) RESTRICT;
DROP FUNCTION IF EXISTS public.fn_ntf_worker_claim_canary(UUID, UUID, TEXT, INTEGER) RESTRICT;
-- Finance: old outbox batch claim and the pg_net dispatcher to the removed tenant routes.
DROP FUNCTION IF EXISTS public.claim_outbox_batch(INTEGER, TIMESTAMPTZ) RESTRICT;
DROP FUNCTION IF EXISTS public.fin_trigger_job(TEXT) RESTRICT;
DROP FUNCTION IF EXISTS public.fin_trigger_outbox_proc() RESTRICT;
DROP FUNCTION IF EXISTS public.fin_list_job_schedules() RESTRICT;
-- The old ERP retry sweep's reader (it read status OPEN; the engine writes NEW); 6c queues retries.
DROP FUNCTION IF EXISTS public.list_retryable_posting_exceptions(INTEGER) RESTRICT;

-- -----------------------------------------------------------------------------
-- 4. Run log of the removed tenant Finance jobs hub (6f). Nothing reads or writes it.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.sys_fin_job_run_log RESTRICT;

-- -----------------------------------------------------------------------------
-- 5. Permissions of the removed Finance jobs section. Role defaults and user grants go with
--    them (ON DELETE CASCADE); the effective-permission cache has no FK, so it is rebuilt.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _fin_jobs_perm_users ON COMMIT DROP AS
SELECT DISTINCT e.user_id, e.tenant_org_id
  FROM public.cmx_effective_permissions e
 WHERE e.permission_code IN ('finance_jobs:view', 'finance_jobs:run');

DELETE FROM public.sys_auth_permissions WHERE code IN ('finance_jobs:view', 'finance_jobs:run');

DO $$
DECLARE
  v_user RECORD;
  v_n    INTEGER := 0;
BEGIN
  FOR v_user IN SELECT user_id, tenant_org_id FROM _fin_jobs_perm_users LOOP
    PERFORM public.cmx_rebuild_user_permissions(v_user.user_id, v_user.tenant_org_id);
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE '0857: effective permissions rebuilt for % user/tenant rows', v_n;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Notifications queued before the pg-boss release that never got an ntf.deliver job: the old
--    loop that would have sent them is gone. Unclaimed rows only; a row with a job is untouched.
-- -----------------------------------------------------------------------------
UPDATE public.org_ntf_outbox_dtl o
   SET status       = 'SKIPPED',
       skip_reason  = 'NOT_SENT_BEFORE_QUEUE_RELEASE',
       finalized_at = now(),
       updated_at   = now(),
       updated_by   = 'system',
       updated_info = '0857 retire old plumbing'
 WHERE o.status = 'QUEUED'
   AND o.claim_token IS NULL
   AND o.tenant_org_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM pgboss.job j
      WHERE j.name = 'ntf.deliver'
        AND j.data->>'outboxId' = o.id::text
        AND j.data->>'tenantOrgId' = o.tenant_org_id::text
   );

COMMIT;
