-- =============================================================================
-- Migration: 0755_ops_job_action_contract.sql
-- Status:    DRAFT ONLY. Review and apply manually; this migration is never run
--            by an agent.
-- Purpose:   I11 Phase 1 compatibility cutover for the HQ Ops Jobs control plane.
--            Adds a database-owned action allowlist, exposes it through a V2 list
--            function, and makes V2 mutations deny every action by default.
--            Registers the existing DB-native tax-kit-update scheduler row as
--            observation-only without creating, deleting, or altering cron.job.
-- Safety:    No cron.schedule, cron.unschedule, or cron.alter_job call exists in
--            this migration. Legacy functions and stored recovery commands remain
--            untouched for backwards compatibility but are not called through V2
--            unless a future reviewed migration grants the matching action.
-- Reversal:  Forward-only. Do not remove the V2 functions or capability column
--            until every HQ caller has been moved or retired and a dependency
--            review has been completed.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- The allowlist is deliberately additive. OBSERVE is the only initial capability:
-- it keeps the existing scheduler visible while the I11 executor migration is proven.
ALTER TABLE public.sys_ops_job_cf
  ADD COLUMN IF NOT EXISTS operator_actions TEXT[] NOT NULL DEFAULT ARRAY['OBSERVE']::TEXT[];

COMMENT ON COLUMN public.sys_ops_job_cf.operator_actions IS
  'Database-owned HQ action allowlist. OBSERVE permits read-only visibility; SET_STATE, RESTORE, and RUN_NOW require explicit future approval for the job executor.';

ALTER TABLE public.sys_ops_job_cf
  DROP CONSTRAINT IF EXISTS ck_sys_ops_job_cf_actions;

ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_actions CHECK (
    cardinality(operator_actions) > 0
    AND operator_actions <@ ARRAY['OBSERVE', 'SET_STATE', 'RESTORE', 'RUN_NOW']::TEXT[]
  );

COMMENT ON CONSTRAINT ck_sys_ops_job_cf_actions ON public.sys_ops_job_cf IS
  'Operator action allowlist is non-empty and limited to the reviewed HQ control-plane actions.';

-- A migration-tracked job is allowed to omit a recovery command when RESTORE is
-- not approved. This lets the tax registry row be factual without preserving a
-- command-execution path that I11 is retiring.
ALTER TABLE public.sys_ops_job_cf
  DROP CONSTRAINT IF EXISTS ck_sys_ops_job_cf_restore_cmd;

ALTER TABLE public.sys_ops_job_cf
  ADD CONSTRAINT ck_sys_ops_job_cf_restore_cmd CHECK (
    source_migration IS NULL
    OR (restore_command IS NOT NULL AND btrim(restore_command) <> '')
    OR NOT ('RESTORE' = ANY (operator_actions))
  );

COMMENT ON CONSTRAINT ck_sys_ops_job_cf_restore_cmd ON public.sys_ops_job_cf IS
  'A job granted RESTORE must keep a non-empty migration-owned recovery command; observation-only jobs may not expose recovery execution.';

-- Refuse application against a scheduler that differs from the I11 remote baseline.
-- This reads cron.job only and intentionally does not modify it.
DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM cron.job
    WHERE jobname = 'tax-kit-update'
      AND active
      AND schedule = '5 2 * * *'
      AND btrim(command) = 'SELECT public.fn_tax_kit_update_all()'
  ) <> 1 THEN
    RAISE EXCEPTION '0755: expected exactly one active tax-kit-update cron row with the approved command and schedule';
  END IF;
END $$;

-- Attach the known existing scheduler row to the control-plane registry. There is
-- deliberately no recovery command and no mutable action capability in this phase.
INSERT INTO public.sys_ops_job_cf (
  job_code, name, name2, description, description2,
  category, module, sub_system, kind, cron_job_name,
  default_schedule, desired_enabled, run_now_allowed, completion_mode,
  source_migration, restore_command, operator_actions, notes, created_info
) VALUES (
  'tax-kit-update', 'Tax kit update', 'تحديث حزمة الضرائب',
  'Every night: applies the latest effective tax kit to eligible organizations. The existing pg_cron row is observed only during the I11 execution-model freeze.',
  'كل ليلة: يطبّق أحدث حزمة ضريبية سارية على المنشآت المؤهلة. تُراقَب مهمة pg_cron الحالية فقط خلال تجميد نموذج التنفيذ I11.',
  'MAINTENANCE', 'tax', 'kit_updates', 'PG_CRON', 'tax-kit-update',
  '5 2 * * *', true, false, 'SYNC',
  '0726', NULL, ARRAY['OBSERVE']::TEXT[],
  'Existing DB-native pg_cron row; no scheduler mutation or command execution is authorized by 0755.',
  '0755 I11 registry normalization'
)
ON CONFLICT (job_code) DO NOTHING;

-- V2 is additive so deployed legacy callers remain compatible until the HQ API is
-- switched. The list exposes capabilities, never commands or recovery metadata.
CREATE OR REPLACE FUNCTION public.fn_ops_job_list_v2()
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
  operator_actions    TEXT[],
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
SET search_path = pg_catalog, public, cron, pg_temp
AS $$
  SELECT
    c.job_code, c.name, c.name2, c.description, c.description2,
    c.category, c.module, c.sub_system, c.kind, c.cron_job_name,
    c.default_schedule, c.schedule, COALESCE(c.schedule, c.default_schedule),
    j.schedule, j.active, c.desired_enabled, j.jobid,
    COALESCE(j.command IS NOT NULL AND btrim(j.command) <> '', false),
    c.run_now_allowed, c.completion_mode, c.source_migration, c.notes, c.is_active,
    c.operator_actions,
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

COMMENT ON FUNCTION public.fn_ops_job_list_v2() IS
  'Read-only Ops Jobs registry list with live scheduler state, drift, last-run facts, and database-owned operator action capabilities. Commands and recovery commands are not returned.';

-- V2 mutation gates are narrow wrappers over the legacy implementations. A future
-- migration can grant a capability per reviewed executor; until then every mutation
-- returns ACTION_NOT_ALLOWED before it can reach a scheduler command.
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
  'Capability-gated compatibility wrapper for the legacy scheduler state function; rejects jobs without SET_STATE before any scheduler mutation.';

CREATE OR REPLACE FUNCTION public.fn_ops_job_restore_v2(p_job_code TEXT, p_actor TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, cron, pg_temp
AS $$
BEGIN
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
  'Capability-gated compatibility wrapper for legacy scheduler restore; rejects jobs without RESTORE before any recovery command can execute.';

CREATE OR REPLACE FUNCTION public.fn_ops_job_run_now_v2(p_job_code TEXT, p_actor TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, cron, pg_temp
AS $$
BEGIN
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
  'Capability-gated compatibility wrapper for legacy manual execution; rejects jobs without RUN_NOW before a stored scheduler command can execute.';

REVOKE ALL ON FUNCTION public.fn_ops_job_list_v2() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_set_state_v2(TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_restore_v2(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ops_job_run_now_v2(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_list_v2() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_set_state_v2(TEXT, BOOLEAN, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_restore_v2(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ops_job_run_now_v2(TEXT, TEXT) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_ops_job_cf
    WHERE job_code = 'tax-kit-update'
      AND cron_job_name = 'tax-kit-update'
      AND default_schedule = '5 2 * * *'
      AND desired_enabled
      AND operator_actions = ARRAY['OBSERVE']::TEXT[]
      AND restore_command IS NULL
  ) THEN
    RAISE EXCEPTION '0755: tax-kit-update registry contract was not recorded';
  END IF;

  IF has_function_privilege('anon', 'public.fn_ops_job_list_v2()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ops_job_list_v2()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fn_ops_job_set_state_v2(text,boolean,text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ops_job_set_state_v2(text,boolean,text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fn_ops_job_restore_v2(text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ops_job_restore_v2(text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fn_ops_job_run_now_v2(text,text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ops_job_run_now_v2(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION '0755: a browser role can execute an Ops Jobs V2 function';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.fn_ops_job_list_v2()', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.fn_ops_job_set_state_v2(text,boolean,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.fn_ops_job_restore_v2(text,text)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.fn_ops_job_run_now_v2(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION '0755: service_role is missing an Ops Jobs V2 grant';
  END IF;
END $$;

COMMIT;
