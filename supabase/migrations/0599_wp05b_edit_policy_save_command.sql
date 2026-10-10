-- ============================================================================
-- Migration: 0599_wp05b_edit_policy_save_command.sql
-- Purpose: Provide the atomic HQ authoring command and lifecycle coverage guard
-- for the Edit Policy tables introduced by 0597.
-- Why: PostgREST cannot atomically replace a policy matrix with an optimistic
-- revision check. Partial policy edits must never reach Pilot or Published use.
-- Security: Browser roles cannot execute the command; only trusted server code
-- may pass a server-derived HQ actor ID after application permission checks.
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- The controlled save command owns one revision increment for a complete matrix
-- replacement. Direct administrative rule changes remain individually versioned.
CREATE OR REPLACE FUNCTION public.sys_wf_edit_rule_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_policy_id UUID;
  v_lifecycle TEXT;
  v_profile_version_id UUID;
BEGIN
  v_policy_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.edit_policy_id ELSE NEW.edit_policy_id END;
  SELECT policy.lifecycle_status, policy.workflow_profile_version_id
    INTO v_lifecycle, v_profile_version_id
  FROM public.sys_wf_edit_policy_mst AS policy
  WHERE policy.id = v_policy_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_rule_dtl: policy % does not exist', v_policy_id USING ERRCODE = '23514';
  END IF;
  IF v_lifecycle IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_rule_dtl: % policy rules are immutable', v_lifecycle USING ERRCODE = '23514';
  END IF;
  IF TG_OP <> 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.sys_wf_prof_ver_mod_st_cf AS profile_status
    WHERE profile_status.version_id = v_profile_version_id
      AND profile_status.status_code = NEW.workflow_status
      AND profile_status.rec_status = 1
      AND profile_status.is_active = true
  ) THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_rule_dtl: workflow status % is not active in profile version %', NEW.workflow_status, v_profile_version_id USING ERRCODE = '23514';
  END IF;

  IF current_setting('cmx.edit_policy_save', true) IS DISTINCT FROM 'on' THEN
    -- Direct mutation gets its own freshness revision; the atomic command sets
    -- this transaction-local marker and advances the header exactly once.
    UPDATE public.sys_wf_edit_policy_mst
    SET policy_revision = policy_revision + 1,
        updated_at = CURRENT_TIMESTAMP,
        updated_info = 'Edit Policy rule matrix changed'
    WHERE id = v_policy_id;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_wf_edit_rule_guard() IS 'Blocks Published or Retired rule mutation, validates profile-status membership, and advances proof freshness unless the controlled atomic save command owns the single revision increment.';

-- Pilot and Published matrices must cover every active workflow status and all
-- 15 frozen operation-target pairs. Missing rows deny at runtime and also block
-- promotion, so an administrator cannot accidentally activate a partial policy.
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

  IF NEW.lifecycle_status IN ('PILOT', 'PUBLISHED') AND NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
    SELECT COUNT(*) * 15 INTO v_required_rule_count
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
COMMENT ON FUNCTION public.sys_wf_edit_policy_guard() IS 'Protects Edit Policy lifecycle and immutable published evidence, and rejects Pilot or Published promotion until all active profile statuses have the complete 15-pair matrix.';

CREATE FUNCTION public.sys_wf_edit_policy_save(
  p_edit_policy_id UUID,
  p_expected_revision INTEGER,
  p_name TEXT,
  p_name2 TEXT,
  p_description TEXT,
  p_description2 TEXT,
  p_rules JSONB,
  p_actor_id UUID
)
RETURNS TABLE (edit_policy_id UUID, policy_revision INTEGER, lifecycle_status TEXT)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_policy public.sys_wf_edit_policy_mst%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_rules) <> 'array' THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_save: p_rules must be a JSON array' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_policy
  FROM public.sys_wf_edit_policy_mst
  WHERE id = p_edit_policy_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_save: Edit Policy % does not exist', p_edit_policy_id USING ERRCODE = 'P0002';
  END IF;
  IF v_policy.lifecycle_status NOT IN ('DRAFT', 'PILOT') THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_save: only DRAFT or PILOT policies are editable' USING ERRCODE = '23514';
  END IF;
  IF v_policy.policy_revision <> p_expected_revision THEN
    RAISE EXCEPTION 'sys_wf_edit_policy_save: stale policy revision' USING ERRCODE = '40001';
  END IF;

  PERFORM set_config('cmx.edit_policy_save', 'on', true);
  DELETE FROM public.sys_wf_edit_policy_rule_dtl WHERE edit_policy_id = p_edit_policy_id;
  INSERT INTO public.sys_wf_edit_policy_rule_dtl (
    edit_policy_id, workflow_status, operation_code, target_type, decision,
    reason_code, message_key, requires_reason, required_permission_code,
    override_permission_code, rec_order, rec_notes, created_by, created_info
  )
  SELECT
    p_edit_policy_id,
    rule.workflow_status,
    rule.operation_code,
    rule.target_type,
    rule.decision,
    rule.reason_code,
    rule.message_key,
    rule.requires_reason,
    rule.required_permission_code,
    rule.override_permission_code,
    rule.rec_order,
    rule.rec_notes,
    p_actor_id,
    'HQ Edit Policy atomic matrix save'
  FROM jsonb_to_recordset(p_rules) AS rule(
    workflow_status TEXT, operation_code TEXT, target_type TEXT, decision TEXT,
    reason_code TEXT, message_key TEXT, requires_reason BOOLEAN,
    required_permission_code TEXT, override_permission_code TEXT,
    rec_order INTEGER, rec_notes TEXT
  );

  UPDATE public.sys_wf_edit_policy_mst AS policy
  SET name = p_name,
      name2 = p_name2,
      description = p_description,
      description2 = p_description2,
      policy_revision = policy.policy_revision + 1,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = p_actor_id,
      updated_info = 'HQ Edit Policy atomic matrix save'
  WHERE policy.id = p_edit_policy_id
  RETURNING policy.id, policy.policy_revision, policy.lifecycle_status
  INTO edit_policy_id, policy_revision, lifecycle_status;

  RETURN NEXT;
END;
$function$;
COMMENT ON FUNCTION public.sys_wf_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) IS 'Atomically replaces one Draft or Pilot Edit Policy matrix after optimistic revision verification, then advances freshness exactly once for review-proof invalidation.';

-- Browser and direct Data API roles cannot invoke the commercial-policy writer.
REVOKE ALL ON FUNCTION public.sys_wf_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sys_wf_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;

COMMIT;
