-- ============================================================================
-- 0468_fix_sys_wf_prof_cfg_guard_exec_child_version_id.sql
-- ============================================================================
-- Purpose:
--   Fix PostgreSQL error 42703 ("record new has no field version_id") when
--   saving executable channels or gates.
--
-- Cause:
--   sys_wf_prof_cfg_guard is attached to sys_wf_prof_ver_exec_ch_cf and
--   sys_wf_prof_ver_exec_gate_cf, which key off exec_id and have no
--   version_id column. The 0461 guard still read NEW.version_id before the
--   atomic-command bypass, so Save actions and gates failed even when
--   cmx.semantic_policy_command was set.
--
-- Fix:
--   1) Honor the transaction-local command bypass before touching NEW/OLD
--      column names that are not shared by every guarded table.
--   2) Resolve version_id from the parent executable for channel and gate
--      rows so ad-hoc writes remain lifecycle-guarded.
--
-- Safety:
--   CREATE OR REPLACE only. No schema/data changes. Triggers stay attached.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sys_wf_prof_cfg_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_id UUID;
  v_exec_id UUID;
  v_status TEXT;
BEGIN
  -- Must run before any NEW.version_id access. Channel and gate rows do not
  -- have that column; reading it raises 42703 even during the atomic save.
  IF current_setting('cmx.semantic_policy_command', true) = '1' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME IN ('sys_wf_prof_ver_exec_ch_cf', 'sys_wf_prof_ver_exec_gate_cf') THEN
    IF TG_OP = 'DELETE' THEN
      v_exec_id := OLD.exec_id;
    ELSE
      v_exec_id := NEW.exec_id;
    END IF;

    SELECT exec_row.version_id
    INTO v_version_id
    FROM public.sys_wf_prof_ver_exec_cf AS exec_row
    WHERE exec_row.exec_id = v_exec_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_version_id := OLD.version_id;
  ELSE
    v_version_id := NEW.version_id;
  END IF;

  SELECT version_status
  INTO v_status
  FROM public.sys_wf_profile_ver_mst
  WHERE version_id = v_version_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Workflow profile version % does not exist', v_version_id;
  END IF;

  IF v_status IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION
      'Workflow profile config for % version % is immutable',
      v_status,
      v_version_id;
  END IF;

  UPDATE public.sys_wf_profile_ver_mst
  SET
    policy_revision = policy_revision + 1,
    current_artifact_id = NULL,
    compiled_schema_version = NULL,
    compiled_checksum = NULL,
    compiled_at = NULL,
    compiled_by = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE version_id = v_version_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sys_wf_prof_cfg_guard() IS
  'Blocks Published or Retired policy edits and invalidates one current artifact after an ad-hoc Draft or Pilot policy-row edit. Channel and gate rows resolve version_id through the parent executable. The atomic semantic policy command uses a transaction-local bypass after locking and validating the complete replacement.';

COMMIT;
