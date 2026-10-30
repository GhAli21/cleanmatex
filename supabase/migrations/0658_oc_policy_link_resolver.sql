-- ============================================================
-- Migration: 0658_oc_policy_link_resolver.sql
-- Purpose:   Separate effective Edit Policy link selection from
--            workflow-status rule expansion while preserving the
--            existing resolver RPC contract.
-- Affected:  sys_oc_resolve_policy_link, sys_oc_resolve_edit_policy
-- Related:   0638 (Order Change namespace), 0656 (profile defaults)
-- ============================================================

BEGIN;

-- Resolves one reusable Edit Policy from the workflow identity persisted on an
-- order. Context is validated before precedence so an organization override
-- cannot authorize a legacy order whose workflow binding is incomplete.
CREATE OR REPLACE FUNCTION public.sys_oc_resolve_policy_link(
  p_tenant_org_id UUID,
  p_profile_id UUID,
  p_profile_version_id UUID
)
RETURNS TABLE (
  resolution_level TEXT,
  deny_reason TEXT,
  edit_policy_id UUID,
  policy_revision INTEGER,
  policy_code TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_count BIGINT;
  v_ids UUID[];
  v_policy_id UUID;
  v_policy public.sys_oc_edit_policy_mst%ROWTYPE;
BEGIN
  resolution_level := 'DENY';
  deny_reason := 'NO_AUTHORITY';

  -- A complete order-stamped workflow identity is required even when an
  -- organization override would otherwise win.
  IF p_tenant_org_id IS NULL OR p_profile_id IS NULL OR p_profile_version_id IS NULL THEN
    deny_reason := 'WORKFLOW_CONTEXT_INVALID';
    RETURN NEXT;
    RETURN;
  END IF;

  -- A caller outside the order service cannot combine a version with an
  -- unrelated profile. Retired versions remain valid for historical orders.
  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_profile_ver_mst AS profile_version
    WHERE profile_version.version_id = p_profile_version_id
      AND profile_version.profile_id = p_profile_id
  ) THEN
    deny_reason := 'WORKFLOW_CONTEXT_INVALID';
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT COUNT(*), array_agg(assignment.edit_policy_id)
  INTO v_count, v_ids
  FROM public.org_oc_edit_policy_asg_cf AS assignment
  WHERE assignment.tenant_org_id = p_tenant_org_id
    AND assignment.scope = 'ORGANIZATION'
    AND assignment.rec_status = 1
    AND assignment.is_active = true;

  IF v_count > 1 THEN
    deny_reason := 'AMBIGUOUS_ORGANIZATION';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_count = 1 THEN
    resolution_level := 'ORGANIZATION';
    v_policy_id := v_ids[1];
  END IF;

  IF v_policy_id IS NULL THEN
    SELECT COUNT(*), array_agg(default_link.edit_policy_id)
    INTO v_count, v_ids
    FROM public.sys_oc_edit_policy_def_cf AS default_link
    WHERE default_link.workflow_profile_version_id = p_profile_version_id
      AND default_link.rec_status = 1
      AND default_link.is_active = true;

    IF v_count > 1 THEN
      deny_reason := 'AMBIGUOUS_DEFAULT';
      RETURN NEXT;
      RETURN;
    END IF;

    IF v_count = 1 THEN
      resolution_level := 'VERSION_DEFAULT';
      v_policy_id := v_ids[1];
    END IF;
  END IF;

  IF v_policy_id IS NULL THEN
    SELECT COUNT(*), array_agg(profile_link.edit_policy_id)
    INTO v_count, v_ids
    FROM public.sys_oc_edit_policy_profile_def_cf AS profile_link
    WHERE profile_link.workflow_profile_id = p_profile_id
      AND profile_link.rec_status = 1
      AND profile_link.is_active = true;

    IF v_count > 1 THEN
      deny_reason := 'AMBIGUOUS_PROFILE';
      RETURN NEXT;
      RETURN;
    END IF;

    IF v_count = 1 THEN
      resolution_level := 'PROFILE';
      v_policy_id := v_ids[1];
    END IF;
  END IF;

  IF v_policy_id IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT policy.*
  INTO v_policy
  FROM public.sys_oc_edit_policy_mst AS policy
  WHERE policy.id = v_policy_id;

  -- A selected higher-priority link blocks fallback when its policy is no
  -- longer usable; silently choosing a lower policy would change authority.
  IF NOT FOUND
    OR v_policy.rec_status <> 1
    OR v_policy.is_active <> true
    OR v_policy.lifecycle_status NOT IN ('PILOT', 'PUBLISHED')
    OR (resolution_level IN ('VERSION_DEFAULT', 'PROFILE') AND v_policy.lifecycle_status <> 'PUBLISHED') THEN
    resolution_level := 'DENY';
    deny_reason := 'POLICY_NOT_USABLE';
    RETURN NEXT;
    RETURN;
  END IF;

  edit_policy_id := v_policy.id;
  policy_revision := v_policy.policy_revision;
  policy_code := v_policy.policy_code;
  deny_reason := 'NONE';
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.sys_oc_resolve_policy_link(UUID, UUID, UUID) IS
  'Validates an order-stamped workflow profile/version pair, then resolves one usable Edit Policy by organization, version, and profile precedence. Returns one fail-closed identity row and never expands status rules.';

-- Preserves the server RPC shape used by Organization Preview/Apply and HQ
-- Effective Preview while delegating link precedence to one reusable function.
CREATE OR REPLACE FUNCTION public.sys_oc_resolve_edit_policy(
  p_tenant_org_id UUID,
  p_profile_id UUID,
  p_profile_version_id UUID,
  p_workflow_status TEXT
)
RETURNS TABLE (
  resolution_level TEXT,
  deny_reason TEXT,
  edit_policy_id UUID,
  policy_revision INTEGER,
  policy_code TEXT,
  workflow_status TEXT,
  operation_code TEXT,
  target_type TEXT,
  decision TEXT,
  reason_code TEXT,
  message_key TEXT,
  requires_reason BOOLEAN,
  required_permission_code TEXT,
  override_permission_code TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_link RECORD;
BEGIN
  workflow_status := p_workflow_status;

  SELECT link.*
  INTO v_link
  FROM public.sys_oc_resolve_policy_link(
    p_tenant_org_id,
    p_profile_id,
    p_profile_version_id
  ) AS link;

  resolution_level := v_link.resolution_level;
  deny_reason := v_link.deny_reason;
  edit_policy_id := v_link.edit_policy_id;
  policy_revision := v_link.policy_revision;
  policy_code := v_link.policy_code;

  IF edit_policy_id IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  -- A global status code is not authority for this order unless it is active
  -- in the exact workflow version stamped on the order.
  IF p_workflow_status IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_mod_st_cf AS membership
    WHERE membership.version_id = p_profile_version_id
      AND membership.status_code = p_workflow_status
      AND membership.rec_status = 1
      AND membership.is_active = true
  ) THEN
    deny_reason := 'STATUS_NOT_COVERED';
    RETURN NEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_link.resolution_level,
    v_link.deny_reason,
    v_link.edit_policy_id,
    v_link.policy_revision,
    v_link.policy_code,
    p_workflow_status,
    rule.operation_code,
    rule.target_type,
    rule.decision,
    rule.reason_code,
    rule.message_key,
    rule.requires_reason,
    rule.required_permission_code,
    rule.override_permission_code
  FROM public.sys_oc_edit_policy_rule_dtl AS rule
  WHERE rule.edit_policy_id = v_link.edit_policy_id
    AND rule.workflow_status = p_workflow_status
    AND rule.rec_status = 1
    AND rule.is_active = true
  ORDER BY rule.operation_code, rule.target_type;

  IF NOT FOUND THEN
    deny_reason := 'STATUS_NOT_COVERED';
    RETURN NEXT;
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.sys_oc_resolve_edit_policy(UUID, UUID, UUID, TEXT) IS
  'Preserves the Organization and HQ resolver contract. It obtains one policy identity from sys_oc_resolve_policy_link, verifies the status belongs to the supplied workflow version, and returns active operation decisions or a fail-closed sentinel row.';

-- Both resolvers are server-only authority boundaries. PostgreSQL grants new
-- functions to PUBLIC by default, so every client-facing role is revoked.
REVOKE ALL ON FUNCTION public.sys_oc_resolve_policy_link(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sys_oc_resolve_edit_policy(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sys_oc_resolve_policy_link(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sys_oc_resolve_edit_policy(UUID, UUID, UUID, TEXT) TO service_role;

COMMIT;
