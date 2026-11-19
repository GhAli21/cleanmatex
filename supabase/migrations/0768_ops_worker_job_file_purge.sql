-- =============================================================================
-- Migration: 0768_ops_worker_job_file_purge.sql
-- Program:   I11 background execution — first HQ_WORKER pilot (owner decision 2026-11-19)
--            File Util 7.9 (docs/features/File_Util/PLAN.md); I11 plan
--            docs/pending_to_production/16_11_2026/I11_background_execution_redesign_PLAN.md
--            Phases 2.3 / 2.4 / 4.4 / 7 for this one job.
-- Purpose:
--   The File Util byte purge (`file-util-purge`, HQ platform-workers) becomes a registered job
--   that HQ operators control in the Job Manager (/ops/jobs): schedule (default weekly,
--   Sunday 03:47 UTC), on/off, and Run now.
--   I11 rules kept:
--   - One scheduler: only the worker schedules HQ_WORKER jobs; pg_cron never runs them.
--   - The HQ API records desired state (sys_ops_job_cf) and audits it; the worker reads it
--     every minute and reports what it applied (applied_* columns) so drift is visible.
--   - Run now and scheduled runs share one path: a row in sys_ops_job_req_tr that the worker
--     claims, runs with the same executor, and closes with a run-log row. No stored command
--     text is ever executed for a worker job.
--   - No overlap: one RUNNING request per job, one open manual request per job, one request per
--     schedule slot (unique indexes), so several worker instances cannot double-run.
-- Objects:
--   sys_ops_job_cf: kind HQ_WORKER, completion mode WORKER_QUEUE, 4 applied_* columns, 3 CHECKs;
--   new table sys_ops_job_req_tr (+ 3 unique indexes, 1 index, RLS, audit trigger);
--   replaced fn_ops_job_set_state, fn_ops_job_run_now, fn_ops_job_list_v2, fn_ops_job_capture_runs
--   (pg_cron behaviour unchanged; worker branch added); new fn_ops_worker_job_sync,
--   fn_ops_job_request_slot, fn_ops_job_claim, fn_ops_job_finish (service_role only);
--   seed row file-util-purge.
-- Rollback: delete the file-util-purge rows (req table, run log, registry), drop the 4 new
--   functions and sys_ops_job_req_tr, restore the previous bodies of the 4 replaced functions
--   (0610/0657 definitions), drop the applied_* columns and restore the kind/mode CHECKs.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- ─── 1. Registry: worker job kind ───────────────────────────────────────────

-- Kind: PG_CRON = scheduled by pg_cron in the database; HQ_WORKER = scheduled by HQ platform-workers.
ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_kind;
ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_kind CHECK (kind IN ('PG_CRON', 'HQ_WORKER'));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_kind ON public.sys_ops_job_cf IS
  'PG_CRON: pg_cron schedules and runs the job. HQ_WORKER: HQ platform-workers schedules and runs it (I11).';

-- Completion: WORKER_QUEUE = Run now queues a request the worker runs; the outcome lands in the run log.
ALTER TABLE public.sys_ops_job_cf DROP CONSTRAINT ck_sys_ops_job_cf_mode;
ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_mode CHECK (completion_mode IN ('SYNC', 'ASYNC_HTTP', 'WORKER_QUEUE'));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_mode ON public.sys_ops_job_cf IS
  'SYNC: run completes in the call. ASYNC_HTTP: handed to an HTTP endpoint, outcome not observed. WORKER_QUEUE: queued for the HQ worker, outcome in sys_ops_job_run_dtl.';

-- Worker jobs always queue; pg_cron jobs never do.
ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_kind_mode CHECK ((kind = 'HQ_WORKER') = (completion_mode = 'WORKER_QUEUE'));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_kind_mode ON public.sys_ops_job_cf IS
  'HQ_WORKER jobs use completion_mode WORKER_QUEUE, and only they do.';

-- RESTORE recreates a pg_cron row; a worker job has none.
ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_wrk_act CHECK (kind <> 'HQ_WORKER' OR NOT ('RESTORE' = ANY (operator_actions)));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_wrk_act ON public.sys_ops_job_cf IS
  'Worker jobs never offer RESTORE (there is no pg_cron row to recreate).';

ALTER TABLE public.sys_ops_job_cf
  ADD COLUMN IF NOT EXISTS applied_schedule TEXT,
  ADD COLUMN IF NOT EXISTS applied_enabled  BOOLEAN,
  ADD COLUMN IF NOT EXISTS applied_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS applied_by       TEXT;
COMMENT ON COLUMN public.sys_ops_job_cf.applied_schedule IS
  'HQ_WORKER only: schedule the worker last applied (reported by fn_ops_worker_job_sync). Compared with the desired schedule for SCHEDULE_DRIFT.';
COMMENT ON COLUMN public.sys_ops_job_cf.applied_enabled IS
  'HQ_WORKER only: on/off state the worker last applied. Compared with desired_enabled for STATE_DRIFT.';
COMMENT ON COLUMN public.sys_ops_job_cf.applied_at IS
  'HQ_WORKER only: last time the worker reported (refreshed at least every 5 minutes while it runs). Older than 15 minutes = WORKER_NOT_SEEN.';
COMMENT ON COLUMN public.sys_ops_job_cf.applied_by IS
  'HQ_WORKER only: worker instance that last reported (host and process id), for diagnosis.';

ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_applied CHECK (
    kind = 'HQ_WORKER' OR (applied_schedule IS NULL AND applied_enabled IS NULL AND applied_at IS NULL AND applied_by IS NULL));
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_applied ON public.sys_ops_job_cf IS
  'applied_* columns are only used by HQ_WORKER jobs; pg_cron jobs read their actual state from cron.job.';

-- ─── 2. Run requests (scheduled and manual) of worker jobs ──────────────────

CREATE TABLE IF NOT EXISTS public.sys_ops_job_req_tr (
  id            UUID        NOT NULL DEFAULT gen_random_uuid(),
  job_code      TEXT        NOT NULL,
  trigger_type  TEXT        NOT NULL,
  due_slot      TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'REQUESTED',
  requested_by  TEXT,
  claimed_at    TIMESTAMPTZ,
  claimed_by    TEXT,
  finished_at   TIMESTAMPTZ,
  run_id        UUID,
  message       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT,
  updated_count INTEGER     NOT NULL DEFAULT 0,
  deleted_at    TIMESTAMPTZ,
  deleted_by    TEXT,
  deleted_info  TEXT,
  rec_status    SMALLINT    NOT NULL DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  CONSTRAINT pk_sys_ops_job_req_tr PRIMARY KEY (id),
  CONSTRAINT fk_ojr_job FOREIGN KEY (job_code) REFERENCES public.sys_ops_job_cf (job_code) ON DELETE RESTRICT,
  CONSTRAINT ck_ojr_trigger CHECK (trigger_type IN ('SCHEDULE', 'MANUAL')),
  CONSTRAINT ck_ojr_slot CHECK ((trigger_type = 'SCHEDULE') = (due_slot IS NOT NULL)),
  CONSTRAINT ck_ojr_status CHECK (status IN ('REQUESTED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED')),
  CONSTRAINT ck_ojr_claimed CHECK (status IN ('REQUESTED', 'CANCELLED') OR claimed_at IS NOT NULL),
  CONSTRAINT ck_ojr_finished CHECK ((status IN ('DONE', 'FAILED', 'CANCELLED')) = (finished_at IS NOT NULL)),
  CONSTRAINT ck_ojr_message CHECK (message IS NULL OR length(message) <= 1000),
  CONSTRAINT ck_ojr_rec_status CHECK (rec_status IN (0, 1))
);

COMMENT ON TABLE public.sys_ops_job_req_tr IS
  'Run requests of HQ_WORKER jobs (I11). The worker inserts one SCHEDULE row per schedule slot; Run now inserts a MANUAL row. The worker claims one (RUNNING), runs the job executor and closes it (DONE / FAILED) with a sys_ops_job_run_dtl row. Platform-global; service_role only.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.id IS 'Request id.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.job_code IS 'Registered worker job (sys_ops_job_cf.job_code).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.trigger_type IS 'SCHEDULE (inserted by the worker for a schedule slot) or MANUAL (Run now from HQ).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.due_slot IS 'SCHEDULE only: the schedule minute (UTC) this run is for; unique per job so a slot runs once even with several worker instances.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.status IS 'REQUESTED -> RUNNING -> DONE / FAILED; CANCELLED when a scheduled request waits while the job is switched off.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.requested_by IS 'MANUAL only: HQ user id who pressed Run now (copied to the run log actor).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.claimed_at IS 'When a worker started the run.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.claimed_by IS 'Worker instance that runs it (host and process id).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.finished_at IS 'When the run ended (DONE / FAILED) or the request was cancelled.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.run_id IS 'sys_ops_job_run_dtl.id of the run-log row; no FK because the run log is pruned after 90 days.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.message IS 'Outcome summary (up to 1000 characters), also written to the run log.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.created_at IS 'Row creation time (request time).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.created_by IS 'Who created the row: HQ user id or worker instance.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.created_info IS 'Creating function.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.updated_at IS 'Last update time (fn_audit_touch_row).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.updated_by IS 'Last updater: worker instance.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.updated_info IS 'Last updating function.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.updated_count IS 'Number of updates (fn_audit_touch_row).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.deleted_at IS 'Standard audit column; rows are pruned after 90 days, never soft-deleted.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.deleted_by IS 'Standard audit column (unused).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.deleted_info IS 'Standard audit column (unused).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.rec_status IS 'Standard record status (1 active).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.rec_order IS 'Standard display order (unused).';
COMMENT ON COLUMN public.sys_ops_job_req_tr.rec_notes IS 'Standard notes.';
COMMENT ON COLUMN public.sys_ops_job_req_tr.is_active IS 'Standard active flag.';
COMMENT ON CONSTRAINT fk_ojr_job ON public.sys_ops_job_req_tr IS 'A request belongs to a registered job; a job with requests cannot be deleted.';
COMMENT ON CONSTRAINT ck_ojr_trigger ON public.sys_ops_job_req_tr IS 'Known triggers.';
COMMENT ON CONSTRAINT ck_ojr_slot ON public.sys_ops_job_req_tr IS 'Scheduled requests carry their slot; manual ones do not.';
COMMENT ON CONSTRAINT ck_ojr_status ON public.sys_ops_job_req_tr IS 'Known request states.';
COMMENT ON CONSTRAINT ck_ojr_claimed ON public.sys_ops_job_req_tr IS 'A started request records when it was claimed.';
COMMENT ON CONSTRAINT ck_ojr_finished ON public.sys_ops_job_req_tr IS 'finished_at is set exactly for ended requests.';
COMMENT ON CONSTRAINT ck_ojr_message ON public.sys_ops_job_req_tr IS 'Bounded outcome text.';
COMMENT ON CONSTRAINT ck_ojr_rec_status ON public.sys_ops_job_req_tr IS 'Standard record status values.';

-- One run per schedule slot, even with several worker instances.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ojr_slot ON public.sys_ops_job_req_tr (job_code, due_slot) WHERE due_slot IS NOT NULL;
COMMENT ON INDEX public.uq_ojr_slot IS 'A schedule slot of a job is requested once.';
-- One waiting or running Run now per job (double clicks are refused).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ojr_open_manual ON public.sys_ops_job_req_tr (job_code)
  WHERE trigger_type = 'MANUAL' AND status IN ('REQUESTED', 'RUNNING');
COMMENT ON INDEX public.uq_ojr_open_manual IS 'At most one open manual request per job.';
-- No overlapping runs of one job.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ojr_running ON public.sys_ops_job_req_tr (job_code) WHERE status = 'RUNNING';
COMMENT ON INDEX public.uq_ojr_running IS 'At most one running request per job: runs never overlap.';
CREATE INDEX IF NOT EXISTS idx_ojr_job_status ON public.sys_ops_job_req_tr (job_code, status, created_at);
COMMENT ON INDEX public.idx_ojr_job_status IS 'Claim lookup (oldest REQUESTED of a job) and retention.';

DROP TRIGGER IF EXISTS trg_ojr_audit_touch ON public.sys_ops_job_req_tr;
CREATE TRIGGER trg_ojr_audit_touch BEFORE UPDATE ON public.sys_ops_job_req_tr
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_touch_row();
COMMENT ON TRIGGER trg_ojr_audit_touch ON public.sys_ops_job_req_tr IS 'Keeps updated_at / updated_count current.';

-- Platform-global control data: no client access; HQ API and worker use the service role.
ALTER TABLE public.sys_ops_job_req_tr ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sys_ops_job_req_tr FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sys_ops_job_req_tr TO service_role;

-- ─── 3. Replaced control-plane functions (worker branch added) ──────────────

-- set_state: a worker job only stores the desired state; the worker applies it within a minute.
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

  -- Strict shape check: five single-space-separated numeric cron fields. Anything else
  -- (names, intervals, quotes, semicolons, newlines) is rejected before reaching pg_cron.
  IF p_schedule IS NOT NULL THEN
    v_sched := btrim(p_schedule);
    IF length(v_sched) > 100 OR v_sched !~ '^[0-9*/,-]+( [0-9*/,-]+){4}$' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SCHEDULE',
        'message', 'Schedule must be 5 numeric cron fields', 'job_code', p_job_code);
    END IF;
  END IF;

  -- HQ_WORKER (I11): record desired state only; the worker reads it and reports applied_*.
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
      'message', 'Saved. The HQ worker applies it within about a minute.',
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
    -- NULL arguments mean "unchanged" in cron.alter_job. The command is never passed.
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
  'Job Manager: enable/disable and/or reschedule a registered job. PG_CRON: alters cron.job (command never passed). HQ_WORKER (0768): stores the desired state; the worker applies it within a minute. Strict 5-field cron shape. service_role only; called through fn_ops_job_set_state_v2.';

-- run_now: a worker job queues a MANUAL request; it never executes stored command text.
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

  IF NOT v_cfg.run_now_allowed THEN
    RETURN jsonb_build_object('ok', false, 'code', 'RUN_NOT_ALLOWED', 'job_code', p_job_code,
      'message', 'Manual run is not allowed for this job');
  END IF;

  -- HQ_WORKER (I11): same path as scheduled work — a request the worker claims and runs.
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
        ELSE 'Queued. The HQ worker starts it within about a minute; the result appears in the run history.'
      END);
  END IF;

  -- The command comes ONLY from cron.job (set by migrations); no caller-supplied SQL.
  SELECT j.command INTO v_command FROM cron.job j WHERE j.jobname = v_cfg.cron_job_name;
  IF v_command IS NULL OR btrim(v_command) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_IN_CRON', 'job_code', p_job_code,
      'message', 'No cron command found for this job');
  END IF;

  -- One manual run per job at a time (transaction-scoped lock, released automatically).
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
  -- Last-resort guard (for example statement timeout while logging): never raise to the caller.
  RETURN jsonb_build_object('ok', false, 'code', 'FAILED', 'status', 'FAILED',
    'message', left(SQLERRM, 500), 'job_code', p_job_code);
END;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_run_now(text, text) IS
  'Job Manager Run now. PG_CRON: runs the cron.job command once (never caller SQL), logs the run. HQ_WORKER (0768): queues a MANUAL request (code QUEUED) the worker runs with its normal executor; refuses a second open manual request. service_role only; called through fn_ops_job_run_now_v2.';

-- list_v2: worker jobs read actual state from applied_* instead of cron.job.
CREATE OR REPLACE FUNCTION public.fn_ops_job_list_v2()
 RETURNS TABLE(job_code text, name text, name2 text, description text, description2 text, category text, module text, sub_system text, kind text, cron_job_name text, default_schedule text, schedule_override text, effective_schedule text, actual_schedule text, actual_active boolean, desired_enabled boolean, cron_jobid bigint, command_present boolean, run_now_allowed boolean, completion_mode text, source_migration text, notes text, is_active boolean, operator_actions text[], drift_flags text[], last_run_at timestamp with time zone, last_run_status text, last_run_message text, last_run_source text, last_run_trigger text, last_run_actor text)
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
    -- Worker jobs: "executor present" = the worker has reported at least once.
    CASE WHEN c.kind = 'HQ_WORKER' THEN c.applied_at IS NOT NULL
         ELSE COALESCE(j.command IS NOT NULL AND btrim(j.command) <> '', false) END,
    c.run_now_allowed, c.completion_mode, c.source_migration, c.notes, c.is_active,
    c.operator_actions,
    CASE WHEN c.kind = 'HQ_WORKER' THEN
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
         THEN orr.actor END
  FROM public.sys_ops_job_cf c
  -- Only pg_cron jobs have a cron.job row; a same-named cron row never counts for a worker job.
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
  'Job Manager list: registry rows with intended vs actual state, drift flags, operator actions and last run. PG_CRON actual state from cron.job; HQ_WORKER (0768) from applied_* with WORKER_NOT_SEEN when the worker has not reported for 15 minutes. service_role only.';

-- capture_runs: unchanged pg_cron capture; also prunes old worker requests (same 90-day window).
CREATE OR REPLACE FUNCTION public.fn_ops_job_capture_runs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'cron', 'pg_temp'
AS $function$
DECLARE
  v_captured INTEGER := 0;
BEGIN
  INSERT INTO public.sys_ops_job_run_dtl (
    job_code, started_at, finished_at, status, message,
    trigger_type, actor, cron_run_id, created_info
  )
  SELECT
    c.job_code,
    d.start_time,
    d.end_time,
    CASE d.status WHEN 'succeeded' THEN 'SUCCESS' ELSE 'FAILED' END,
    left(d.return_message, 1000),
    'SCHEDULE',
    NULL,
    d.runid,
    'fn_ops_job_capture_runs'
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  JOIN public.sys_ops_job_cf c ON c.cron_job_name = j.jobname AND c.kind = 'PG_CRON'
  WHERE d.status IN ('succeeded', 'failed')
    AND d.start_time IS NOT NULL
  ON CONFLICT (job_code, cron_run_id) WHERE cron_run_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_captured = ROW_COUNT;

  -- Retention: keep 90 days so minute-level jobs (about 1440 rows/day each) stay bounded.
  DELETE FROM public.sys_ops_job_run_dtl WHERE started_at < now() - interval '90 days';
  -- Worker requests that ended follow the same window (0768).
  DELETE FROM public.sys_ops_job_req_tr
   WHERE status IN ('DONE', 'FAILED', 'CANCELLED') AND created_at < now() - interval '90 days';

  RETURN v_captured;
END;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_capture_runs() IS
  'Copies finished pg_cron runs of registered PG_CRON jobs into sys_ops_job_run_dtl and prunes run-log rows and ended worker requests (sys_ops_job_req_tr, 0768) older than 90 days. Run by ops-job-run-capture.';

-- ─── 4. Worker-side functions (service_role only) ───────────────────────────

-- Each minute the worker reads its desired state here; the call also records what it applied.
CREATE OR REPLACE FUNCTION public.fn_ops_worker_job_sync(p_job_code text, p_worker text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_cfg    public.sys_ops_job_cf%ROWTYPE;
  v_sched  TEXT;
  v_worker TEXT := left(COALESCE(NULLIF(btrim(p_worker), ''), 'unknown'), 120);
BEGIN
  SELECT * INTO v_cfg
  FROM public.sys_ops_job_cf
  WHERE job_code = p_job_code AND rec_status = 1 AND is_active AND kind = 'HQ_WORKER';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'job_code', p_job_code);
  END IF;
  v_sched := COALESCE(v_cfg.schedule, v_cfg.default_schedule);

  -- Write only on change or every 5 minutes, so the registry row stays quiet.
  IF v_cfg.applied_at IS NULL OR v_cfg.applied_at < now() - interval '5 minutes'
     OR v_cfg.applied_schedule IS DISTINCT FROM v_sched
     OR v_cfg.applied_enabled IS DISTINCT FROM v_cfg.desired_enabled
     OR v_cfg.applied_by IS DISTINCT FROM v_worker THEN
    UPDATE public.sys_ops_job_cf
       SET applied_schedule = v_sched, applied_enabled = v_cfg.desired_enabled,
           applied_at = now(), applied_by = v_worker
     WHERE job_code = p_job_code;
  END IF;

  RETURN jsonb_build_object('ok', true, 'job_code', p_job_code,
    'enabled', v_cfg.desired_enabled, 'schedule', v_sched);
END;
$function$;
COMMENT ON FUNCTION public.fn_ops_worker_job_sync(text, text) IS
  'HQ worker, each minute: returns the desired on/off state and schedule of an HQ_WORKER job and records them as applied (applied_*), at most every 5 minutes unless they changed. service_role only.';

-- The worker asks for the run of one schedule slot; a slot already requested is ignored.
CREATE OR REPLACE FUNCTION public.fn_ops_job_request_slot(p_job_code text, p_slot timestamptz, p_worker text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows   INTEGER;
  v_worker TEXT := left(COALESCE(NULLIF(btrim(p_worker), ''), 'unknown'), 120);
BEGIN
  -- A slot is a past minute; anything else is a worker clock or logic error.
  IF p_slot IS NULL OR p_slot > now() + interval '1 minute' OR p_slot < now() - interval '1 day' THEN
    RETURN false;
  END IF;
  INSERT INTO public.sys_ops_job_req_tr (job_code, trigger_type, due_slot, status, created_by, created_info)
  SELECT c.job_code, 'SCHEDULE', date_trunc('minute', p_slot), 'REQUESTED', v_worker, 'fn_ops_job_request_slot'
    FROM public.sys_ops_job_cf c
   WHERE c.job_code = p_job_code AND c.kind = 'HQ_WORKER' AND c.desired_enabled AND c.is_active AND c.rec_status = 1
  ON CONFLICT (job_code, due_slot) WHERE due_slot IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_request_slot(text, timestamptz, text) IS
  'HQ worker: requests the run of one schedule slot (minute, UTC) of an enabled HQ_WORKER job. Returns true when a new request was made; a slot already requested (any worker instance) is ignored. service_role only.';

-- The worker claims the next request; stale runs are closed first and runs never overlap.
CREATE OR REPLACE FUNCTION public.fn_ops_job_claim(p_job_code text, p_worker text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_worker  TEXT := left(COALESCE(NULLIF(btrim(p_worker), ''), 'unknown'), 120);
  v_enabled BOOLEAN;
  v_req     public.sys_ops_job_req_tr%ROWTYPE;
BEGIN
  SELECT c.desired_enabled INTO v_enabled
    FROM public.sys_ops_job_cf c
   WHERE c.job_code = p_job_code AND c.kind = 'HQ_WORKER' AND c.is_active AND c.rec_status = 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- A run claimed 2 hours ago and never closed: the worker died. Close it as FAILED and log it.
  WITH stale AS (
    UPDATE public.sys_ops_job_req_tr
       SET status = 'FAILED', finished_at = now(), updated_by = v_worker, updated_info = 'fn_ops_job_claim',
           message = 'Abandoned: the worker stopped before the run finished'
     WHERE job_code = p_job_code AND status = 'RUNNING' AND claimed_at < now() - interval '2 hours'
    RETURNING job_code, claimed_at, trigger_type, requested_by
  )
  INSERT INTO public.sys_ops_job_run_dtl (job_code, started_at, finished_at, status, message, trigger_type, actor, created_info)
  SELECT job_code, claimed_at, now(), 'FAILED', 'Abandoned: the worker stopped before the run finished',
         trigger_type, requested_by, 'fn_ops_job_claim'
    FROM stale;

  -- Scheduled requests do not run while the job is switched off (manual ones still do).
  IF NOT v_enabled THEN
    UPDATE public.sys_ops_job_req_tr
       SET status = 'CANCELLED', finished_at = now(), updated_by = v_worker, updated_info = 'fn_ops_job_claim',
           message = 'Cancelled: the job was switched off'
     WHERE job_code = p_job_code AND status = 'REQUESTED' AND trigger_type = 'SCHEDULE';
  END IF;

  IF EXISTS (SELECT 1 FROM public.sys_ops_job_req_tr WHERE job_code = p_job_code AND status = 'RUNNING') THEN
    RETURN NULL;
  END IF;

  -- Manual first, then oldest. SKIP LOCKED + uq_ojr_running keep two instances from both starting.
  SELECT * INTO v_req
    FROM public.sys_ops_job_req_tr
   WHERE job_code = p_job_code AND status = 'REQUESTED'
   ORDER BY (trigger_type = 'MANUAL') DESC, created_at
   LIMIT 1
   FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN NULL; END IF;

  BEGIN
    UPDATE public.sys_ops_job_req_tr
       SET status = 'RUNNING', claimed_at = now(), claimed_by = v_worker,
           updated_by = v_worker, updated_info = 'fn_ops_job_claim'
     WHERE id = v_req.id;
  EXCEPTION WHEN unique_violation THEN
    RETURN NULL; -- another instance started a run of this job a moment ago
  END;

  RETURN jsonb_build_object('id', v_req.id, 'job_code', v_req.job_code, 'trigger_type', v_req.trigger_type,
    'due_slot', v_req.due_slot, 'requested_by', v_req.requested_by);
END;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_claim(text, text) IS
  'HQ worker: claims the next REQUESTED run of an HQ_WORKER job (manual first) and marks it RUNNING; returns NULL when nothing is due or a run is already going. Closes runs left RUNNING for 2 hours as FAILED (logged) and cancels waiting scheduled requests while the job is off. service_role only.';

-- The worker closes its run: request DONE / FAILED and one run-log row.
CREATE OR REPLACE FUNCTION public.fn_ops_job_finish(p_request_id uuid, p_worker text, p_success boolean, p_message text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_worker TEXT := left(COALESCE(NULLIF(btrim(p_worker), ''), 'unknown'), 120);
  v_msg    TEXT := left(COALESCE(p_message, ''), 1000);
  v_req    public.sys_ops_job_req_tr%ROWTYPE;
  v_run_id UUID;
BEGIN
  SELECT * INTO v_req FROM public.sys_ops_job_req_tr
   WHERE id = p_request_id AND status = 'RUNNING' AND claimed_by = v_worker
   FOR UPDATE;
  IF NOT FOUND THEN
    -- Closed meanwhile (for example as abandoned after 2 hours): nothing to record twice.
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_RUNNING', 'request_id', p_request_id);
  END IF;

  INSERT INTO public.sys_ops_job_run_dtl (job_code, started_at, finished_at, status, message, trigger_type, actor, created_info)
  VALUES (v_req.job_code, v_req.claimed_at, now(), CASE WHEN p_success THEN 'SUCCESS' ELSE 'FAILED' END,
          NULLIF(v_msg, ''), v_req.trigger_type, v_req.requested_by, 'fn_ops_job_finish')
  RETURNING id INTO v_run_id;

  UPDATE public.sys_ops_job_req_tr
     SET status = CASE WHEN p_success THEN 'DONE' ELSE 'FAILED' END, finished_at = now(),
         run_id = v_run_id, message = NULLIF(v_msg, ''), updated_by = v_worker, updated_info = 'fn_ops_job_finish'
   WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true, 'request_id', p_request_id, 'run_id', v_run_id);
END;
$function$;
COMMENT ON FUNCTION public.fn_ops_job_finish(uuid, text, boolean, text) IS
  'HQ worker: closes its RUNNING request as DONE or FAILED and writes the run-log row (trigger and actor copied from the request). Refuses a request it does not hold. service_role only.';

REVOKE ALL ON FUNCTION public.fn_ops_worker_job_sync(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_request_slot(text, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_claim(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_finish(uuid, text, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_worker_job_sync(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_request_slot(text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_claim(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_finish(uuid, text, boolean, text) TO service_role;

-- ─── 5. Seed: the File Util byte purge as a worker job ──────────────────────

-- Weekly (Sunday 03:47 UTC): deleted files keep their bytes for up to a week; they are already
-- hidden and do not count toward storage use. The run repeats batches until the backlog is empty.
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2, category, module, sub_system,
  kind, cron_job_name, default_schedule, schedule, desired_enabled, run_now_allowed,
  completion_mode, source_migration, notes, operator_actions, is_active, rec_status, created_info
) VALUES (
  'file-util-purge',
  'File Util: purge deleted file bytes',
  'إدارة الملفات: إزالة ملفات المحذوفات من التخزين',
  'Weekly by default: removes the stored bytes of deleted files from Storage and marks them purged. Runs in HQ platform-workers (not pg_cron); a run continues until no deleted file is left.',
  'أسبوعيا افتراضيا: يزيل الملفات المخزنة للملفات المحذوفة من التخزين ويعلّمها كمزالة. يعمل في عامل إدارة المنصة (وليس pg_cron)؛ يستمر التشغيل حتى لا يبقى ملف محذوف.',
  'CLEANUP', 'file_util', NULL,
  'HQ_WORKER', 'file-util-purge', '47 3 * * 0', NULL, true, true,
  'WORKER_QUEUE', '0768', 'I11 pilot: first HQ_WORKER job. The worker reads this row every minute.',
  ARRAY['OBSERVE', 'SET_STATE', 'RUN_NOW'], true, 1, '0768 seed'
)
ON CONFLICT (job_code) DO NOTHING;

COMMIT;
