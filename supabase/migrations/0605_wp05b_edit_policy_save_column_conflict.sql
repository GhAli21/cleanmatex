-- ============================================================================
-- Migration: 0605_wp05b_edit_policy_save_column_conflict.sql
-- Purpose:   Let HQ save a complete Edit Policy matrix. The 0599 command
--            declares a return column named edit_policy_id, and Postgres then
--            treats that name as a PL/pgSQL variable. The rule delete compared
--            the unqualified column edit_policy_id with that variable, so every
--            matrix save failed with "column reference edit_policy_id is
--            ambiguous" (42702) before any rule was stored.
-- Affected:  public.sys_wf_edit_policy_save
-- Related:   0599_wp05b_edit_policy_save_command.sql
-- ============================================================================
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- #variable_conflict use_column keeps table columns ahead of the return-table
-- variables. The delete and the final header update also use qualified names
-- so a future return-column rename cannot recreate this failure.
CREATE OR REPLACE FUNCTION public.sys_wf_edit_policy_save(
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
#variable_conflict use_column
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
  DELETE FROM public.sys_wf_edit_policy_rule_dtl AS rule_row
  WHERE rule_row.edit_policy_id = p_edit_policy_id;
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
COMMENT ON FUNCTION public.sys_wf_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) IS 'Atomically replaces one Draft or Pilot Edit Policy matrix after optimistic revision verification. Return columns are kept behind table columns so the rule delete cannot confuse edit_policy_id with the function result.';

-- CREATE OR REPLACE keeps existing privileges. Restate the boundary so browser
-- roles still cannot call the commercial-policy writer directly.
REVOKE ALL ON FUNCTION public.sys_wf_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sys_wf_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;

COMMIT;
