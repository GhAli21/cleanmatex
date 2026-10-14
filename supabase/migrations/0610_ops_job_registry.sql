-- =============================================================================
-- Migration: 0610_ops_job_registry.sql
-- STATUS:    CREATED, NOT APPLIED. Review and apply manually (local + remote).
--            This file is never executed by the agent.
-- Purpose:   Platform Operations Console P0+P1 - Job Registry + Job Manager.
--            Gives HQ operators a screen over the pg_cron jobs: intended vs actual
--            schedule/state (drift), enable/disable, schedule edit, run now, and a
--            durable run history that survives the 14-day truncation of
--            cron.job_run_details (job cleanup-cron-job-run-details).
-- Affected:  NEW sys_ops_job_cf, sys_ops_job_run_dtl,
--            fn_ops_job_list, fn_ops_job_set_state, fn_ops_job_run_now,
--            fn_ops_job_capture_runs, pg_cron job ops-job-run-capture,
--            hq_permissions (2 new codes), seed of the registry rows.
-- Related:   0602 (HQ RBAC, permission seed pattern), 0350/0355/0362/0353/0604/0609
--            (ntf jobs), 0410/0429/0505/0511/0558 (fin jobs), 0576 (auth sweep).
-- Safety:    The UI/API can never edit or supply a job command. Commands live only in
--            cron.job (set by migrations). Run-now executes the command text already
--            stored in cron.job. Schedules are validated by a strict 5-field shape
--            check here AND in the API. All functions are SECURITY DEFINER, pinned
--            search_path, EXECUTE granted to service_role only.
-- Reversal:  Forward-only. To retire: SELECT cron.unschedule('ops-job-run-capture');
--            DROP FUNCTION IF EXISTS public.fn_ops_job_capture_runs();
--            DROP FUNCTION IF EXISTS public.fn_ops_job_run_now(TEXT, TEXT);
--            DROP FUNCTION IF EXISTS public.fn_ops_job_set_state(TEXT, BOOLEAN, TEXT, TEXT);
--            DROP FUNCTION IF EXISTS public.fn_ops_job_list();
--            DROP TABLE IF EXISTS public.sys_ops_job_run_dtl;
--            DROP TABLE IF EXISTS public.sys_ops_job_cf;
--            DELETE FROM hq_permissions WHERE permission_code IN ('hq_ops:read','hq_ops:manage_jobs');
--            (RESTRICT semantics only; no CASCADE is used or needed.)
-- Seed note: desired_enabled = true for every job whose creating migration intended
--            it active. default_schedule is the INTENDED schedule taken from the
--            creating migration, so live drift (for example ntf-outbox-processor
--            running every 30 minutes instead of every minute) shows up as drift.
--            The two housekeeping cleanup jobs have no tracked migration; see their
--            notes column.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- -----------------------------------------------------------------------------
-- 1. sys_ops_job_cf - registry of operator-manageable scheduled jobs
-- -----------------------------------------------------------------------------

-- Platform-global (no tenant data) catalog of scheduled jobs. One row per job that the
-- HQ Job Manager may inspect/operate. The row records the INTENDED state; the ACTUAL
-- state is read live from cron.job so drift is visible instead of silently healed.
CREATE TABLE IF NOT EXISTS public.sys_ops_job_cf (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- Surrogate identity; API addresses jobs by job_code.
  job_code         TEXT NOT NULL,                               -- Stable operator-facing code; equals the pg_cron jobname for PG_CRON jobs.
  name             TEXT NOT NULL,                               -- English display name.
  name2            TEXT,                                        -- Arabic display name.
  description      TEXT,                                        -- English description of what the job does and why it exists.
  description2     TEXT,                                        -- Arabic description.
  category         TEXT NOT NULL,                               -- Functional grouping used for filtering (for example OUTBOX, EXPIRY, CLEANUP).
  module           TEXT NOT NULL,                               -- Owning product module (ntf, fin, auth, housekeeping, ops).
  sub_system       TEXT,                                        -- Optional finer area inside the module (for example campaigns, push).
  kind             TEXT NOT NULL DEFAULT 'PG_CRON',             -- Execution engine; only PG_CRON is implemented, BULLMQ/HTTP are reserved.
  cron_job_name    TEXT NOT NULL,                               -- pg_cron jobname this row controls (join key to cron.job).
  default_schedule TEXT NOT NULL,                               -- INTENDED 5-field cron schedule from the creating migration.
  schedule         TEXT,                                        -- Operator override of the schedule; NULL means use default_schedule.
  desired_enabled  BOOLEAN NOT NULL DEFAULT true,               -- INTENDED active flag; compared with cron.job.active to flag STATE_DRIFT.
  run_now_allowed  BOOLEAN NOT NULL DEFAULT false,              -- Whether HQ may trigger an immediate manual run; false for destructive housekeeping.
  completion_mode  TEXT NOT NULL DEFAULT 'SYNC',                -- SYNC = outcome known when the command returns; ASYNC_HTTP = handed to net.http_post, outcome unknown synchronously.
  source_migration TEXT,                                        -- Migration that created the cron job; NULL when untracked.
  notes            TEXT,                                        -- Operator/developer notes (for example uncertainty about intended state).
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),          -- Row creation time.
  created_by       UUID,                                        -- HQ user who created the row, when known.
  created_info     TEXT,                                        -- Free-text creation provenance (migration/seed label).
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),          -- Last modification time (maintained by trigger).
  updated_by       UUID,                                        -- HQ user who last modified the row, when a UUID is known.
  updated_info     TEXT,                                        -- Free-text last-change provenance (actor label + action).
  is_active        BOOLEAN NOT NULL DEFAULT true,               -- false hides the job from the manager without deleting history.
  rec_status       SMALLINT NOT NULL DEFAULT 1,                 -- 1=active, 0=soft-deleted (never hard-delete).
  rec_order        INTEGER,                                     -- Optional manual display order.
  rec_notes        TEXT,                                        -- Standard free-text record note.

  -- Unique job_code: the FK target for the run log and the API path parameter.
  CONSTRAINT uq_sys_ops_job_cf_code UNIQUE (job_code),
  -- Unique cron job name: one registry row controls exactly one pg_cron job.
  CONSTRAINT uq_sys_ops_job_cf_cron UNIQUE (cron_job_name),
  -- Only PG_CRON is implemented. BULLMQ and HTTP are reserved for future engines and
  -- must be added to this CHECK together with their executor.
  CONSTRAINT ck_sys_ops_job_cf_kind CHECK (kind IN ('PG_CRON')),
  -- How a manual run is classified; see fn_ops_job_run_now.
  CONSTRAINT ck_sys_ops_job_cf_mode CHECK (completion_mode IN ('SYNC', 'ASYNC_HTTP')),
  -- Strict numeric 5-field cron shape (digits * / , - separated by single spaces); no
  -- names, no interval syntax, no free text, so the value is safe to hand to cron.alter_job.
  CONSTRAINT ck_sys_ops_job_cf_defsch CHECK (
    length(default_schedule) <= 100
    AND default_schedule ~ '^[0-9*/,-]+( [0-9*/,-]+){4}$'
  ),
  -- Same shape rule for the override; NULL is allowed (means default).
  CONSTRAINT ck_sys_ops_job_cf_sched CHECK (
    schedule IS NULL
    OR (length(schedule) <= 100 AND schedule ~ '^[0-9*/,-]+( [0-9*/,-]+){4}$')
  ),
  CONSTRAINT ck_sys_ops_job_cf_recst CHECK (rec_status IN (0, 1))
);

-- Supports the manager list filtered by module/category (HQ screen filters).
CREATE INDEX IF NOT EXISTS idx_sys_ops_job_cf_mod_cat
  ON public.sys_ops_job_cf (module, category);

COMMENT ON TABLE public.sys_ops_job_cf IS
  'Platform-global registry of operator-manageable scheduled jobs (intended state). Actual state is read live from cron.job. Commands are never stored or editable here.';
COMMENT ON COLUMN public.sys_ops_job_cf.id IS 'Surrogate identity.';
COMMENT ON COLUMN public.sys_ops_job_cf.job_code IS 'Stable operator-facing code; equals the pg_cron jobname for PG_CRON jobs.';
COMMENT ON COLUMN public.sys_ops_job_cf.name IS 'English display name.';
COMMENT ON COLUMN public.sys_ops_job_cf.name2 IS 'Arabic display name.';
COMMENT ON COLUMN public.sys_ops_job_cf.description IS 'English description of what the job does and why it exists.';
COMMENT ON COLUMN public.sys_ops_job_cf.description2 IS 'Arabic description.';
COMMENT ON COLUMN public.sys_ops_job_cf.category IS 'Functional grouping used for filtering (OUTBOX, EXPIRY, CLEANUP, ...).';
COMMENT ON COLUMN public.sys_ops_job_cf.module IS 'Owning product module (ntf, fin, auth, housekeeping, ops).';
COMMENT ON COLUMN public.sys_ops_job_cf.sub_system IS 'Optional finer area inside the module.';
COMMENT ON COLUMN public.sys_ops_job_cf.kind IS 'Execution engine. Only PG_CRON is implemented; BULLMQ and HTTP are reserved.';
COMMENT ON COLUMN public.sys_ops_job_cf.cron_job_name IS 'pg_cron jobname controlled by this row; join key to cron.job.jobname.';
COMMENT ON COLUMN public.sys_ops_job_cf.default_schedule IS 'INTENDED 5-field cron schedule taken from the creating migration; basis of SCHEDULE_DRIFT.';
COMMENT ON COLUMN public.sys_ops_job_cf.schedule IS 'Operator override of the schedule; NULL means default_schedule applies.';
COMMENT ON COLUMN public.sys_ops_job_cf.desired_enabled IS 'INTENDED active flag; compared with cron.job.active to flag STATE_DRIFT.';
COMMENT ON COLUMN public.sys_ops_job_cf.run_now_allowed IS 'Whether HQ may trigger an immediate manual run. False for destructive housekeeping jobs.';
COMMENT ON COLUMN public.sys_ops_job_cf.completion_mode IS 'SYNC = outcome known when the command returns; ASYNC_HTTP = handed to net.http_post so success cannot be known synchronously (recorded as DISPATCHED).';
COMMENT ON COLUMN public.sys_ops_job_cf.source_migration IS 'Migration that created the cron job; NULL when the job has no tracked migration.';
COMMENT ON COLUMN public.sys_ops_job_cf.notes IS 'Operator/developer notes, for example uncertainty about the intended state.';
COMMENT ON COLUMN public.sys_ops_job_cf.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_ops_job_cf.created_by IS 'HQ user who created the row, when known.';
COMMENT ON COLUMN public.sys_ops_job_cf.created_info IS 'Creation provenance label (migration or seed).';
COMMENT ON COLUMN public.sys_ops_job_cf.updated_at IS 'Last modification time, maintained by trigger.';
COMMENT ON COLUMN public.sys_ops_job_cf.updated_by IS 'HQ user who last modified the row, when a UUID is known.';
COMMENT ON COLUMN public.sys_ops_job_cf.updated_info IS 'Last-change provenance (actor label and action).';
COMMENT ON COLUMN public.sys_ops_job_cf.is_active IS 'false hides the job from the manager without deleting history.';
COMMENT ON COLUMN public.sys_ops_job_cf.rec_status IS '1=active, 0=soft-deleted.';
COMMENT ON COLUMN public.sys_ops_job_cf.rec_order IS 'Optional manual display order.';
COMMENT ON COLUMN public.sys_ops_job_cf.rec_notes IS 'Standard free-text record note.';
COMMENT ON CONSTRAINT uq_sys_ops_job_cf_code ON public.sys_ops_job_cf IS 'job_code is the API path key and run-log FK target.';
COMMENT ON CONSTRAINT uq_sys_ops_job_cf_cron ON public.sys_ops_job_cf IS 'One registry row controls exactly one pg_cron job.';
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_kind ON public.sys_ops_job_cf IS 'Only PG_CRON is implemented; extend together with an executor.';
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_mode ON public.sys_ops_job_cf IS 'Allowed manual-run classification modes.';
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_defsch ON public.sys_ops_job_cf IS 'Strict numeric 5-field cron shape; prevents injection into cron.alter_job.';
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_sched ON public.sys_ops_job_cf IS 'Strict numeric 5-field cron shape for the override; NULL allowed.';
COMMENT ON CONSTRAINT ck_sys_ops_job_cf_recst ON public.sys_ops_job_cf IS 'rec_status is 1 (active) or 0 (soft-deleted).';
COMMENT ON INDEX public.idx_sys_ops_job_cf_mod_cat IS 'Supports the manager list filtered by module and category.';

-- Keep updated_at fresh using the shared trigger function created in 0038.
DROP TRIGGER IF EXISTS trg_ops_job_cf_upd_at ON public.sys_ops_job_cf;
CREATE TRIGGER trg_ops_job_cf_upd_at
  BEFORE UPDATE ON public.sys_ops_job_cf
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
COMMENT ON TRIGGER trg_ops_job_cf_upd_at ON public.sys_ops_job_cf IS 'Maintains updated_at on every update.';

-- -----------------------------------------------------------------------------
-- 2. sys_ops_job_run_dtl - durable run log (survives cron.job_run_details truncation)
-- -----------------------------------------------------------------------------

-- Append-only log of job runs. Rows come from two sources: manual runs written by
-- fn_ops_job_run_now (trigger_type MANUAL) and scheduled runs copied from
-- cron.job_run_details by fn_ops_job_capture_runs (trigger_type SCHEDULE). Pruned to
-- 90 days by fn_ops_job_capture_runs so minute-level jobs cannot grow it unbounded.
CREATE TABLE IF NOT EXISTS public.sys_ops_job_run_dtl (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- Surrogate identity of the run record.
  job_code     TEXT NOT NULL,                                -- Registry job this run belongs to (FK to sys_ops_job_cf.job_code).
  started_at   TIMESTAMPTZ NOT NULL,                         -- When the run started.
  finished_at  TIMESTAMPTZ,                                  -- When the run ended; NULL if unknown.
  status       TEXT NOT NULL,                                -- SUCCESS, FAILED, DISPATCHED (handed to async HTTP worker, outcome unknown) or SKIPPED.
  message      TEXT,                                         -- Error text or short result; never contains the command or secrets.
  trigger_type TEXT NOT NULL,                                -- SCHEDULE (captured from pg_cron) or MANUAL (run now from HQ).
  actor        TEXT,                                         -- HQ operator identifier for MANUAL runs; NULL for SCHEDULE.
  cron_run_id  BIGINT,                                       -- cron.job_run_details.runid for SCHEDULE rows; makes capture idempotent.
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),           -- When this log row was written.
  created_by   UUID,                                         -- HQ user UUID when known; the text actor column is authoritative for display.
  created_info TEXT,                                         -- Writer provenance (function name).

  -- Job must exist in the registry. RESTRICT: history is never silently removed with a job.
  CONSTRAINT fk_ops_job_run_job FOREIGN KEY (job_code)
    REFERENCES public.sys_ops_job_cf (job_code) ON DELETE RESTRICT,
  CONSTRAINT ck_ops_job_run_status CHECK (status IN ('SUCCESS', 'FAILED', 'DISPATCHED', 'SKIPPED')),
  CONSTRAINT ck_ops_job_run_trig CHECK (trigger_type IN ('SCHEDULE', 'MANUAL'))
);

-- Supports the per-job history drawer (latest runs first) and the last-run lookup in fn_ops_job_list.
CREATE INDEX IF NOT EXISTS idx_ops_job_run_job_start
  ON public.sys_ops_job_run_dtl (job_code, started_at DESC);

-- Makes fn_ops_job_capture_runs idempotent: one row per (job, pg_cron runid). Partial
-- because MANUAL rows have no runid.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_job_run_cronid
  ON public.sys_ops_job_run_dtl (job_code, cron_run_id)
  WHERE cron_run_id IS NOT NULL;

-- Supports the 90-day retention prune in fn_ops_job_capture_runs.
CREATE INDEX IF NOT EXISTS idx_ops_job_run_started
  ON public.sys_ops_job_run_dtl (started_at);

COMMENT ON TABLE public.sys_ops_job_run_dtl IS
  'Durable, append-only job run log (manual + captured scheduled runs); survives the 14-day truncation of cron.job_run_details. Pruned to 90 days.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.id IS 'Surrogate identity of the run record.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.job_code IS 'Registry job this run belongs to.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.started_at IS 'When the run started.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.finished_at IS 'When the run ended; NULL if unknown.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.status IS 'SUCCESS, FAILED, DISPATCHED (async HTTP hand-off, outcome unknown) or SKIPPED.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.message IS 'Error text or short result; never contains the command or secrets.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.trigger_type IS 'SCHEDULE (captured from pg_cron) or MANUAL (run now from HQ).';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.actor IS 'HQ operator identifier for MANUAL runs; NULL for SCHEDULE.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.cron_run_id IS 'cron.job_run_details.runid for SCHEDULE rows; idempotency key.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.created_at IS 'When this log row was written.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.created_by IS 'HQ user UUID when known.';
COMMENT ON COLUMN public.sys_ops_job_run_dtl.created_info IS 'Writer provenance (function name).';
COMMENT ON CONSTRAINT fk_ops_job_run_job ON public.sys_ops_job_run_dtl IS 'Run belongs to a registered job; RESTRICT keeps history.';
COMMENT ON CONSTRAINT ck_ops_job_run_status ON public.sys_ops_job_run_dtl IS 'Allowed run outcomes.';
COMMENT ON CONSTRAINT ck_ops_job_run_trig ON public.sys_ops_job_run_dtl IS 'Allowed run origins.';
COMMENT ON INDEX public.idx_ops_job_run_job_start IS 'Per-job history and last-run lookup, newest first.';
COMMENT ON INDEX public.uq_ops_job_run_cronid IS 'Idempotent capture: one row per (job, pg_cron runid).';
COMMENT ON INDEX public.idx_ops_job_run_started IS 'Supports the 90-day retention prune.';

-- -----------------------------------------------------------------------------
-- 3. Access control: platform-global tables, service_role only
-- -----------------------------------------------------------------------------

-- RLS enabled with NO policies = deny for anon/authenticated. service_role bypasses RLS.
ALTER TABLE public.sys_ops_job_cf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_ops_job_run_dtl ENABLE ROW LEVEL SECURITY;

-- Explicit revoke so no client role can touch the tables even if a policy is added later by mistake.
REVOKE ALL ON public.sys_ops_job_cf FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sys_ops_job_run_dtl FROM PUBLIC, anon, authenticated;
-- HQ platform-api uses the service-role client.
GRANT SELECT, INSERT, UPDATE ON public.sys_ops_job_cf TO service_role;
GRANT SELECT, INSERT ON public.sys_ops_job_run_dtl TO service_role;

-- -----------------------------------------------------------------------------
-- 4. fn_ops_job_capture_runs - copy finished cron runs into the durable log
-- -----------------------------------------------------------------------------

-- Copies finished runs of REGISTERED jobs from cron.job_run_details into
-- sys_ops_job_run_dtl (trigger_type SCHEDULE), idempotently via (job_code, cron_run_id),
-- then prunes log rows older than 90 days. Returns the number of rows captured.
-- Recursion note: this function is itself scheduled (ops-job-run-capture) and registered.
-- A run only appears in cron.job_run_details after it finishes, so each run captures the
-- PREVIOUS runs including earlier runs of itself; it never re-enters itself and the
-- unique index prevents duplicates. Runs shorter than the capture interval of other jobs
-- are still captured as long as they are still in cron.job_run_details (14-day window).
CREATE OR REPLACE FUNCTION public.fn_ops_job_capture_runs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  JOIN public.sys_ops_job_cf c ON c.cron_job_name = j.jobname
  WHERE d.status IN ('succeeded', 'failed')
    AND d.start_time IS NOT NULL
  ON CONFLICT (job_code, cron_run_id) WHERE cron_run_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS v_captured = ROW_COUNT;

  -- Retention: keep 90 days so minute-level jobs (about 1440 rows/day each) stay bounded.
  DELETE FROM public.sys_ops_job_run_dtl WHERE started_at < now() - interval '90 days';

  RETURN v_captured;
END;
$$;

COMMENT ON FUNCTION public.fn_ops_job_capture_runs() IS
  'Idempotently copies finished pg_cron runs of registered jobs into sys_ops_job_run_dtl and prunes rows older than 90 days. Called by pg_cron job ops-job-run-capture.';

-- -----------------------------------------------------------------------------
-- 5. fn_ops_job_list - registry joined with live cron state, drift flags, last run
-- -----------------------------------------------------------------------------

-- Read-only. Returns every registered job with: intended state (registry), actual state
-- (cron.job), drift flags and the most recent run. Unregistered cron jobs are excluded by
-- design. drift_flags may contain: MISSING_IN_CRON (no cron.job row for the job),
-- SCHEDULE_DRIFT (actual schedule differs from override/default), STATE_DRIFT (actual
-- active differs from desired_enabled). last_run_* takes the most recent of the latest
-- cron.job_run_details row and the latest sys_ops_job_run_dtl row.
CREATE OR REPLACE FUNCTION public.fn_ops_job_list()
RETURNS TABLE (
  job_code            TEXT,
  name                TEXT,
  name2               TEXT,
  description         TEXT,
  description2        TEXT,
  category            TEXT,
  module              TEXT,
  sub_system          TEXT,
  kind                TEXT,
  cron_job_name       TEXT,
  default_schedule    TEXT,
  schedule_override   TEXT,
  effective_schedule  TEXT,
  actual_schedule     TEXT,
  actual_active       BOOLEAN,
  desired_enabled     BOOLEAN,
  cron_jobid          BIGINT,
  command_present     BOOLEAN,
  run_now_allowed     BOOLEAN,
  completion_mode     TEXT,
  source_migration    TEXT,
  notes               TEXT,
  is_active           BOOLEAN,
  drift_flags         TEXT[],
  last_run_at         TIMESTAMPTZ,
  last_run_status     TEXT,
  last_run_message    TEXT,
  last_run_source     TEXT,
  last_run_trigger    TEXT,
  last_run_actor      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    c.job_code,
    c.name,
    c.name2,
    c.description,
    c.description2,
    c.category,
    c.module,
    c.sub_system,
    c.kind,
    c.cron_job_name,
    c.default_schedule,
    c.schedule,
    COALESCE(c.schedule, c.default_schedule),
    j.schedule,
    j.active,
    c.desired_enabled,
    j.jobid,
    COALESCE(j.command IS NOT NULL AND btrim(j.command) <> '', false),
    c.run_now_allowed,
    c.completion_mode,
    c.source_migration,
    c.notes,
    c.is_active,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN j.jobid IS NULL THEN 'MISSING_IN_CRON' END,
      CASE WHEN j.jobid IS NOT NULL
             AND btrim(j.schedule) IS DISTINCT FROM COALESCE(c.schedule, c.default_schedule)
           THEN 'SCHEDULE_DRIFT' END,
      CASE WHEN j.jobid IS NOT NULL AND j.active IS DISTINCT FROM c.desired_enabled
           THEN 'STATE_DRIFT' END
    ], NULL),
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
  LEFT JOIN cron.job j ON j.jobname = c.cron_job_name
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
$$;

COMMENT ON FUNCTION public.fn_ops_job_list() IS
  'Read-only registry list joined with live cron.job state, drift flags (MISSING_IN_CRON, SCHEDULE_DRIFT, STATE_DRIFT) and latest run. Unregistered cron jobs are excluded.';

-- -----------------------------------------------------------------------------
-- 6. fn_ops_job_set_state - the only way HQ changes a cron job
-- -----------------------------------------------------------------------------

-- Enables/disables a registered job and/or changes its schedule via cron.alter_job, then
-- records the new intended state in the registry. NULL argument = leave unchanged.
-- Passing a schedule equal to default_schedule clears the override (recovery path).
-- Never touches the job command. Returns jsonb {ok, code, message, job_code, before, after}.
-- code: UPDATED, NOTHING_TO_CHANGE, NOT_FOUND, INVALID_SCHEDULE, NOT_IN_CRON, ALTER_FAILED.
CREATE OR REPLACE FUNCTION public.fn_ops_job_set_state(
  p_job_code TEXT,
  p_enabled  BOOLEAN,
  p_schedule TEXT,
  p_actor    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

COMMENT ON FUNCTION public.fn_ops_job_set_state(TEXT, BOOLEAN, TEXT, TEXT) IS
  'Enable/disable and/or reschedule a registered pg_cron job via cron.alter_job after strict 5-field validation; updates the intended state in sys_ops_job_cf. Never changes the command. Returns a structured jsonb result.';

-- -----------------------------------------------------------------------------
-- 7. fn_ops_job_run_now - run the stored command once, record the outcome
-- -----------------------------------------------------------------------------

-- Executes EXACTLY the command text currently stored in cron.job for a registered job
-- whose run_now_allowed = true; the caller can never supply SQL. Records a MANUAL row
-- in sys_ops_job_run_dtl. Status honesty: for completion_mode SYNC the command finished,
-- so SUCCESS/FAILED is real. For ASYNC_HTTP jobs (the trigger functions that call
-- net.http_post) the HTTP request is only queued; success cannot be known here, so the
-- status is DISPATCHED. Note: a trigger function that finds its runtime config
-- (sys_*_runtime_cf base_url / outbox_secret_key) missing raises only a WARNING and
-- returns, which this function cannot observe, so DISPATCHED means "handed off", not
-- "processed". Never raises to the caller; returns jsonb
-- {ok, code, status, message, job_code, started_at, finished_at}.
-- code: EXECUTED, FAILED, NOT_FOUND, RUN_NOT_ALLOWED, NOT_IN_CRON, ALREADY_RUNNING.
CREATE OR REPLACE FUNCTION public.fn_ops_job_run_now(
  p_job_code TEXT,
  p_actor    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '120s'
AS $$
DECLARE
  v_cfg      public.sys_ops_job_cf%ROWTYPE;
  v_command  TEXT;
  v_started  TIMESTAMPTZ;
  v_finished TIMESTAMPTZ;
  v_status   TEXT;
  v_message  TEXT;
  v_rows     BIGINT;
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
  EXCEPTION
    -- OTHERS does not match query_canceled (statement_timeout), so it is caught explicitly.
    WHEN query_canceled THEN
      v_status := 'FAILED';
      v_message := 'Timed out after 120s';
    WHEN OTHERS THEN
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
EXCEPTION
  WHEN query_canceled THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FAILED', 'status', 'FAILED',
      'message', 'Timed out', 'job_code', p_job_code);
  WHEN OTHERS THEN
    -- Last-resort guard (for example a failure while logging): never raise to the caller.
    RETURN jsonb_build_object('ok', false, 'code', 'FAILED', 'status', 'FAILED',
      'message', left(SQLERRM, 500), 'job_code', p_job_code);
END;
$$;

COMMENT ON FUNCTION public.fn_ops_job_run_now(TEXT, TEXT) IS
  'Runs the command already stored in cron.job for a registered, run_now_allowed job and logs a MANUAL run. ASYNC_HTTP jobs report DISPATCHED (hand-off only). Caller can never supply SQL; never raises.';

-- -----------------------------------------------------------------------------
-- 8. Function privileges: service_role only
-- -----------------------------------------------------------------------------

-- SECURITY DEFINER functions are callable by PUBLIC by default; revoke from every client
-- role and grant only to service_role (HQ platform-api). The migration owner (postgres)
-- keeps EXECUTE, which is what pg_cron uses for ops-job-run-capture.
REVOKE ALL ON FUNCTION public.fn_ops_job_capture_runs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_list() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_set_state(TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_run_now(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_capture_runs() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_list() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_set_state(TEXT, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_run_now(TEXT, TEXT) TO service_role;

-- -----------------------------------------------------------------------------
-- 9. Seed the registry (idempotent). Intended schedules come from the creating
--    migrations; live drift (e.g. ntf-outbox-processor at */30) is therefore visible.
-- -----------------------------------------------------------------------------

INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2,
  category, module, sub_system, kind, cron_job_name,
  default_schedule, desired_enabled, run_now_allowed, completion_mode,
  source_migration, notes, created_info
)
SELECT s.job_code, s.name, s.name2, s.description, s.description2,
       s.category, s.module, s.sub_system, 'PG_CRON', s.job_code,
       s.default_schedule, s.desired_enabled, s.run_now_allowed, s.completion_mode,
       s.source_migration, s.notes, '0610 seed'
FROM (
  VALUES
  ('ntf-outbox-processor', 'Notification outbox processor', 'معالج صندوق الإشعارات الصادرة',
   'Calls the tenant app process-outbox endpoint through net.http_post (via ntf_trigger_outbox_proc) so QUEUED notifications are dispatched to providers. Intended to run every minute.',
   'يستدعي نقطة معالجة الصندوق في تطبيق المستأجر عبر net.http_post (من خلال ntf_trigger_outbox_proc) لإرسال الإشعارات المصطفة إلى المزودين. المقصود تشغيله كل دقيقة.',
   'OUTBOX', 'ntf', 'dispatch', '* * * * *', true, true, 'ASYNC_HTTP', '0350, 0355', NULL::TEXT),
  ('ntf-outbox-retry', 'Notification outbox retry sweep', 'إعادة جدولة الإشعارات الفاشلة مؤقتا',
   'Re-queues FAILED_TEMPORARY outbox rows whose next_retry_at has passed and whose retry_count is below max_retries so the processor picks them up again.',
   'يعيد وضع صفوف الصندوق ذات الحالة FAILED_TEMPORARY في الطابور عند حلول موعد إعادة المحاولة وقبل بلوغ الحد الأقصى للمحاولات.',
   'OUTBOX', 'ntf', 'dispatch', '*/5 * * * *', true, true, 'SYNC', '0350', NULL),
  ('ntf-campaign-scheduler', 'Notification campaign scheduler', 'جدولة حملات الإشعارات',
   'Calls the campaign processor endpoint through net.http_post (via ntf_trigger_campaign_proc) so due campaigns are expanded into outbox rows. Intended to run every minute.',
   'يستدعي نقطة معالجة الحملات عبر net.http_post (من خلال ntf_trigger_campaign_proc) لتحويل الحملات المستحقة إلى صفوف في الصندوق. المقصود تشغيله كل دقيقة.',
   'CAMPAIGN', 'ntf', 'campaigns', '* * * * *', true, true, 'ASYNC_HTTP', '0362', NULL),
  ('ntf-reconcile-outbox', 'Notification outbox reconciliation', 'مطابقة صندوق الإشعارات',
   'Calls the reconcile-outbox endpoint through net.http_post to settle outbox rows stuck between states. Needs the app.next_js_base_url and app.outbox_secret_key settings; a manual run from HQ may fail if those session settings are not available.',
   'يستدعي نقطة مطابقة الصندوق عبر net.http_post لمعالجة الصفوف العالقة بين الحالات. يحتاج إعدادات app.next_js_base_url و app.outbox_secret_key وقد يفشل التشغيل اليدوي إن لم تتوفر.',
   'OUTBOX', 'ntf', 'dispatch', '*/5 * * * *', true, true, 'ASYNC_HTTP', '0604',
   'Command reads app.* settings via current_setting; a manual run may fail if they are unset in the HQ session.'),
  ('ntf-sweep-stale-push-subs', 'Stale push subscription sweep', 'تنظيف اشتراكات الإشعارات الفورية القديمة',
   'Weekly: deactivates push subscriptions with repeated delivery failures or that stayed unverified for 90+ days.',
   'أسبوعيا: يعطل اشتراكات الإشعارات الفورية ذات الإخفاقات المتكررة أو غير الموثقة لأكثر من 90 يوما.',
   'CLEANUP', 'ntf', 'push', '0 3 * * 0', true, true, 'SYNC', '0353', NULL),
  ('ntf-retention-sweep', 'Notification retention sweep', 'تنظيف الإشعارات حسب مدة الاحتفاظ',
   'Daily: purges notification rows that have been terminal for longer than the retention window (180 days).',
   'يوميا: يحذف صفوف الإشعارات التي بقيت في حالة نهائية أكثر من مدة الاحتفاظ (180 يوما).',
   'CLEANUP', 'ntf', 'retention', '0 4 * * *', true, true, 'SYNC', '0609', NULL),
  ('fin-outbox-processor', 'Financial outbox processor', 'معالج صندوق الأحداث المالية',
   'Calls the finance outbox endpoint through net.http_post (via fin_trigger_outbox_proc) to deliver domain events. Intended to run every minute.',
   'يستدعي نقطة معالجة صندوق المالية عبر net.http_post (من خلال fin_trigger_outbox_proc) لتسليم الأحداث. المقصود تشغيله كل دقيقة.',
   'OUTBOX', 'fin', 'outbox', '* * * * *', true, true, 'ASYNC_HTTP', '0410', NULL),
  ('fin-gift-card-expiry', 'Gift card expiry', 'انتهاء صلاحية بطاقات الهدايا',
   'Daily 02:00: triggers the finance job that expires gift cards past their expiry date.',
   'يوميا الساعة 02:00: يشغل مهمة المالية التي تنهي صلاحية بطاقات الهدايا المنتهية.',
   'EXPIRY', 'fin', 'gift_cards', '0 2 * * *', true, true, 'ASYNC_HTTP', '0429', NULL),
  ('fin-idempotency-cleanup', 'Idempotency key cleanup', 'تنظيف مفاتيح منع التكرار',
   'Daily 03:00: triggers the finance job that removes expired idempotency keys.',
   'يوميا الساعة 03:00: يشغل مهمة المالية التي تحذف مفاتيح منع التكرار المنتهية.',
   'CLEANUP', 'fin', 'idempotency', '0 3 * * *', true, true, 'ASYNC_HTTP', '0429', NULL),
  ('fin-erp-posting-retry', 'ERP posting retry', 'إعادة محاولة الترحيل إلى ERP',
   'Hourly at minute 15: triggers the finance job that retries failed ERP postings.',
   'كل ساعة عند الدقيقة 15: يشغل مهمة المالية التي تعيد محاولة الترحيل الفاشل إلى ERP.',
   'RETRY', 'fin', 'erp', '15 * * * *', true, true, 'ASYNC_HTTP', '0429', NULL),
  ('fin-credit-note-expiry', 'Credit note expiry', 'انتهاء صلاحية إشعارات الدائن',
   'Daily 02:05: triggers the finance job that expires credit notes past their expiry date.',
   'يوميا الساعة 02:05: يشغل مهمة المالية التي تنهي صلاحية إشعارات الدائن المنتهية.',
   'EXPIRY', 'fin', 'credit_notes', '5 2 * * *', true, true, 'ASYNC_HTTP', '0505', NULL),
  ('fin-loyalty-points-expiry', 'Loyalty points expiry', 'انتهاء صلاحية نقاط الولاء',
   'Daily 02:10: triggers the finance job that expires loyalty points (FIFO).',
   'يوميا الساعة 02:10: يشغل مهمة المالية التي تنهي صلاحية نقاط الولاء بنظام الأقدم أولا.',
   'EXPIRY', 'fin', 'loyalty', '10 2 * * *', true, true, 'ASYNC_HTTP', '0511', NULL),
  ('fin-pos-session-rollover', 'POS session rollover', 'ترحيل جلسات نقاط البيع',
   'Every 15 minutes: triggers the finance job that rolls over POS sessions at each branch local midnight.',
   'كل 15 دقيقة: يشغل مهمة المالية التي ترحل جلسات نقاط البيع عند منتصف ليل كل فرع.',
   'ROLLOVER', 'fin', 'pos', '*/15 * * * *', true, true, 'ASYNC_HTTP', '0558', NULL),
  ('auth-session-sweep', 'Auth session sweep', 'تنظيف جلسات المصادقة',
   'Every 5 minutes: ends live-but-expired user sessions (time-sensitive security sweep).',
   'كل 5 دقائق: ينهي جلسات المستخدمين المنتهية الصلاحية (إجراء أمني حساس للوقت).',
   'SECURITY', 'auth', 'sessions', '*/5 * * * *', true, true, 'SYNC', '0576', NULL),
  ('cleanup-net-http-response', 'Truncate net._http_response', 'تفريغ سجل استجابات net.http',
   'Every 14 days: truncates the pg_net response table so it does not grow without bound. Manual run is disabled because it deletes data.',
   'كل 14 يوما: يفرغ جدول استجابات pg_net لمنع نموه. التشغيل اليدوي معطل لأنه يحذف بيانات.',
   'CLEANUP', 'housekeeping', NULL, '0 3 */14 * *', true, false, 'SYNC', NULL,
   'No tracked migration creates this job (found live 2026-10-14). Intended state not verifiable from code; desired_enabled=true assumed because it is live and active.'),
  ('cleanup-cron-job-run-details', 'Truncate cron.job_run_details', 'تفريغ سجل تشغيل pg_cron',
   'Every 14 days: truncates cron.job_run_details. Run history is preserved in sys_ops_job_run_dtl by ops-job-run-capture. Manual run is disabled because it deletes data.',
   'كل 14 يوما: يفرغ cron.job_run_details. يحفظ سجل التشغيل في sys_ops_job_run_dtl عبر ops-job-run-capture. التشغيل اليدوي معطل لأنه يحذف بيانات.',
   'CLEANUP', 'housekeeping', NULL, '30 3 */14 * *', true, false, 'SYNC', NULL,
   'No tracked migration creates this job (found live 2026-10-14). Intended state not verifiable from code; desired_enabled=true assumed because it is live and active.'),
  ('ops-job-run-capture', 'Job run history capture', 'التقاط سجل تشغيل المهام',
   'Every 5 minutes: copies finished runs of registered jobs from cron.job_run_details into the durable run log so history survives the 14-day truncation, and prunes log rows older than 90 days.',
   'كل 5 دقائق: ينسخ تشغيلات المهام المسجلة المنتهية من cron.job_run_details إلى السجل الدائم ليبقى السجل بعد التفريغ كل 14 يوما، ويحذف ما يزيد عن 90 يوما.',
   'OPS', 'ops', 'job_manager', '*/5 * * * *', true, true, 'SYNC', '0610', NULL)
) AS s(job_code, name, name2, description, description2, category, module, sub_system,
       default_schedule, desired_enabled, run_now_allowed, completion_mode, source_migration, notes)
ON CONFLICT (job_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 10. Schedule the capture job (idempotent re-run: unschedule first)
-- -----------------------------------------------------------------------------

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ops-job-run-capture';

-- Command is fixed here by migration; the Job Manager can only change its schedule/state.
SELECT cron.schedule(
  'ops-job-run-capture',
  '*/5 * * * *',
  $$ SELECT public.fn_ops_job_capture_runs() $$
);

-- -----------------------------------------------------------------------------
-- 11. HQ permissions (same pattern as hq_notifications:* in 0602)
-- -----------------------------------------------------------------------------

-- Catalog rows only. SUPER_ADMIN already holds the global "*" grant and therefore
-- covers both codes. No other role is granted here (most conservative); operators
-- assign hq_ops:read / hq_ops:manage_jobs to other HQ roles on the HQ roles screen.
INSERT INTO public.hq_permissions (
  permission_code, permission_name, permission_name_ar,
  resource_code, action_code, is_system, is_active, created_info
)
SELECT seed.code, seed.name_en, seed.name_ar,
       split_part(seed.code, ':', 1), split_part(seed.code, ':', 2),
       true, true, '0610 ops job registry'
FROM (
  VALUES
    ('hq_ops:read', 'View platform operations', 'عرض عمليات المنصة'),
    ('hq_ops:manage_jobs', 'Manage scheduled jobs', 'إدارة المهام المجدولة')
) AS seed(code, name_en, name_ar)
ON CONFLICT (permission_code) DO NOTHING;

COMMIT;
