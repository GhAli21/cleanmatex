-- =============================================================================
-- 0654_fix_sys_oc_edit_policy_save.sql that was in  0638_order_change_edit_policy_rename.sql
-- sys_oc_edit_policy_save raises PT409 (HTTP 409) instead of 40001 on stale revision, to stop PostgREST's endless retry
-- =============================================================================

BEGIN;


-- Atomic matrix replacement used by HQ authoring.
CREATE Or replace FUNCTION public.sys_oc_edit_policy_save(
  p_edit_policy_id UUID, p_expected_revision INTEGER, p_name TEXT, p_name2 TEXT,
  p_description TEXT, p_description2 TEXT, p_rules JSONB, p_actor_id UUID
)
RETURNS TABLE(edit_policy_id UUID, policy_revision INTEGER, lifecycle_status TEXT)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
#variable_conflict use_column
DECLARE
  v_policy public.sys_oc_edit_policy_mst%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_rules) <> 'array' THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_save: p_rules must be a JSON array' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_policy
  FROM public.sys_oc_edit_policy_mst
  WHERE id = p_edit_policy_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_save: Edit Policy % does not exist', p_edit_policy_id USING ERRCODE = 'P0002';
  END IF;
  IF v_policy.lifecycle_status NOT IN ('DRAFT', 'PILOT') THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_save: only DRAFT or PILOT policies are editable' USING ERRCODE = '23514';
  END IF;
  IF v_policy.policy_revision <> p_expected_revision THEN
    --Before RAISE EXCEPTION 'sys_oc_edit_policy_save: stale policy revision' USING ERRCODE = '40001';
	RAISE EXCEPTION USING
  ERRCODE = 'PT409',
  MESSAGE = 'sys_oc_edit_policy_save: stale policy revision',
  --DETAIL  = format('expected %s, current %s', p_expected_revision, v_current_revision);
  DETAIL  = format('expected %s, current %s', p_expected_revision, v_policy.policy_revision);
  
  END IF;

  -- Transaction-local flag: the rule guard skips its per-row revision bump so
  -- the aggregate advances exactly once for the whole matrix.
  PERFORM set_config('cmx.edit_policy_save', 'on', true);
  DELETE FROM public.sys_oc_edit_policy_rule_dtl AS rule_row
  WHERE rule_row.edit_policy_id = p_edit_policy_id;
  INSERT INTO public.sys_oc_edit_policy_rule_dtl (
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

  UPDATE public.sys_oc_edit_policy_mst AS policy
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

COMMENT ON FUNCTION public.sys_oc_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) IS 'Atomically replaces one Draft or Pilot Edit Policy matrix after optimistic revision verification. Return columns are kept behind table columns so the rule delete cannot confuse edit_policy_id with the function result.';

REVOKE ALL ON FUNCTION public.sys_oc_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sys_oc_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;

COMMIT;
