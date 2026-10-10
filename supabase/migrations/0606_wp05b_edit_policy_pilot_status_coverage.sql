-- ============================================================================
-- Migration: 0606_wp05b_edit_policy_pilot_status_coverage.sql
-- Purpose:   Allow Pilot and Published promotion when the matrix covers every
--            active workflow status once. The 0599 guard multiplied every
--            screen membership row by 15. The same status is stored once per
--            screen, so a complete 16-status matrix of 240 rules was rejected
--            as 630 required.
-- Affected:  public.sys_wf_edit_policy_guard
-- Related:   0599_wp05b_edit_policy_save_command.sql
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.sys_wf_edit_policy_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_required_rule_count INTEGER;
  v_actual_rule_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.lifecycle_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: only DRAFT policies may be deleted; retire published policy evidence instead' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.policy_code IS DISTINCT FROM OLD.policy_code THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_mst: policy_code is immutable' USING ERRCODE = '23514';
  END IF;

  IF OLD.lifecycle_status = 'DRAFT' THEN
    IF NEW.lifecycle_status NOT IN ('DRAFT', 'PILOT') OR NEW.policy_revision <> OLD.policy_revision + 1 THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: Draft must remain Draft or enter Pilot and increment policy_revision by one' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.lifecycle_status = 'PILOT' THEN
    IF NEW.lifecycle_status NOT IN ('PILOT', 'PUBLISHED') OR NEW.policy_revision <> OLD.policy_revision + 1 THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: Pilot must remain Pilot or become Published and increment policy_revision by one' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.lifecycle_status = 'PUBLISHED' THEN
    IF NEW.lifecycle_status <> 'RETIRED'
      OR NEW.policy_revision IS DISTINCT FROM OLD.policy_revision
      OR NEW.workflow_profile_version_id IS DISTINCT FROM OLD.workflow_profile_version_id
      OR NEW.name IS DISTINCT FROM OLD.name OR NEW.name2 IS DISTINCT FROM OLD.name2
      OR NEW.description IS DISTINCT FROM OLD.description OR NEW.description2 IS DISTINCT FROM OLD.description2
      OR NEW.pilot_started_at IS DISTINCT FROM OLD.pilot_started_at OR NEW.pilot_started_by IS DISTINCT FROM OLD.pilot_started_by
      OR NEW.published_at IS DISTINCT FROM OLD.published_at OR NEW.published_by IS DISTINCT FROM OLD.published_by
      OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.created_info IS DISTINCT FROM OLD.created_info OR NEW.rec_status IS DISTINCT FROM OLD.rec_status
      OR NEW.rec_order IS DISTINCT FROM OLD.rec_order OR NEW.rec_notes IS DISTINCT FROM OLD.rec_notes
      OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: PUBLISHED policy is immutable except controlled retirement' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.lifecycle_status = 'RETIRED' THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_mst: RETIRED policy is immutable' USING ERRCODE = '23514';
  ELSE
    RAISE EXCEPTION 'sys_wf_edit_policy_mst: unknown existing lifecycle %', OLD.lifecycle_status USING ERRCODE = '23514';
  END IF;

  -- Count each active status once. Screen membership repeats the same status.
  IF NEW.lifecycle_status IN ('PILOT', 'PUBLISHED') AND NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
    SELECT COUNT(DISTINCT profile_status.status_code) * 15 INTO v_required_rule_count
    FROM public.sys_wf_prof_ver_mod_st_cf AS profile_status
    WHERE profile_status.version_id = NEW.workflow_profile_version_id
      AND profile_status.rec_status = 1
      AND profile_status.is_active = true;
    SELECT COUNT(*) INTO v_actual_rule_count
    FROM public.sys_wf_edit_policy_rule_dtl AS rule
    WHERE rule.edit_policy_id = NEW.id
      AND rule.rec_status = 1
      AND rule.is_active = true;
    IF v_required_rule_count = 0 OR v_actual_rule_count <> v_required_rule_count THEN
      RAISE EXCEPTION 'sys_wf_edit_policy_mst: Pilot/Published policy requires complete active status matrix (% required, % found)', v_required_rule_count, v_actual_rule_count USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_wf_edit_policy_guard() IS 'Protects Edit Policy lifecycle and immutable published evidence, and rejects Pilot or Published promotion until every distinct active profile status has the complete 15-pair matrix.';

COMMIT;
