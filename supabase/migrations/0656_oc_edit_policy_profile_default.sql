-- Edit Policy placement: one reusable policy, three links.
-- 1. sys_oc_edit_policy_profile_def_cf — this workflow profile, every version, every organization now and later.
-- 2. sys_oc_edit_policy_def_cf — this workflow profile version, every organization now and later (already exists).
-- 3. org_oc_edit_policy_asg_cf — this organization, regardless of profile or version.
-- Resolution order stays organization, then version, then profile. The resolver signature is unchanged
-- so the Organization app keeps calling sys_oc_resolve_edit_policy.
-- A live per-organization profile row is retired: that link applied to one organization only.

-- -----------------------------------------------------------------------------
-- 1. Platform profile default. No tenant column: a future organization inherits it
--    when it is assigned the workflow profile.
-- -----------------------------------------------------------------------------
CREATE TABLE public.sys_oc_edit_policy_profile_def_cf (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  workflow_profile_id UUID NOT NULL,
  edit_policy_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT pk_oc_edit_profile_def PRIMARY KEY (id),
  CONSTRAINT fk_oc_edit_profile_def_profile FOREIGN KEY (workflow_profile_id)
    REFERENCES public.sys_wf_profiles_cd (profile_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT fk_oc_edit_profile_def_pol FOREIGN KEY (edit_policy_id)
    REFERENCES public.sys_oc_edit_policy_mst (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT ck_oc_edit_profile_def_status CHECK (rec_status IN (0, 1))
);
COMMENT ON TABLE public.sys_oc_edit_policy_profile_def_cf IS 'HQ-only Edit Policy for every version of one workflow profile. Every organization using that profile inherits it, including an organization assigned later. A version default wins for that version only.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.id IS 'Stable link identity. Replacement deactivates this row and inserts another.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.workflow_profile_id IS 'Workflow profile whose versions use this policy unless a version has its own default.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.edit_policy_id IS 'Reusable Edit Policy. A live link requires an active Published policy that covers every active version.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.created_at IS 'When this link was recorded.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.created_by IS 'HQ actor that created the link when known.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.created_info IS 'Non-secret provenance of the link.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.updated_at IS 'When this link was last deactivated or otherwise updated.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.updated_by IS 'HQ actor of the last update when known.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.updated_info IS 'Non-secret provenance of the last update.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.rec_status IS '1 is the governed row. 0 is soft-deleted history.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.rec_order IS 'Optional display order. It is not resolution precedence.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.rec_notes IS 'Optional non-secret operator note kept with the history row.';
COMMENT ON COLUMN public.sys_oc_edit_policy_profile_def_cf.is_active IS 'Together with rec_status = 1, marks the one live policy for the profile.';
COMMENT ON CONSTRAINT pk_oc_edit_profile_def ON public.sys_oc_edit_policy_profile_def_cf IS 'Keeps each profile-default history row independently addressable.';
COMMENT ON CONSTRAINT fk_oc_edit_profile_def_profile ON public.sys_oc_edit_policy_profile_def_cf IS 'Restricts deletion of a workflow profile that still has profile-default history.';
COMMENT ON CONSTRAINT fk_oc_edit_profile_def_pol ON public.sys_oc_edit_policy_profile_def_cf IS 'Restricts deletion of an Edit Policy that still has profile-default history.';
COMMENT ON CONSTRAINT ck_oc_edit_profile_def_status ON public.sys_oc_edit_policy_profile_def_cf IS 'Permits only the explicit active and soft-deleted record states.';

CREATE UNIQUE INDEX uq_oc_edit_profile_def_live ON public.sys_oc_edit_policy_profile_def_cf (workflow_profile_id)
  WHERE rec_status = 1 AND is_active = true;
COMMENT ON INDEX public.uq_oc_edit_profile_def_live IS 'One live Edit Policy for a workflow profile. Inactive history rows remain.';
CREATE INDEX idx_oc_edit_profile_def_pol ON public.sys_oc_edit_policy_profile_def_cf (edit_policy_id)
  WHERE rec_status = 1 AND is_active = true;
COMMENT ON INDEX public.idx_oc_edit_profile_def_pol IS 'Finds the live profile defaults that point at one Edit Policy.';

REVOKE ALL ON TABLE public.sys_oc_edit_policy_profile_def_cf FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sys_oc_edit_policy_profile_def_cf TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Guard. A live link needs a Published policy and full coverage of every
--    active Pilot or Published version of the profile.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.sys_oc_edit_profile_def_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_version_id UUID;
  v_version_count INTEGER := 0;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_profile_def_cf: deactivate profile defaults instead of deleting history' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.workflow_profile_id IS DISTINCT FROM OLD.workflow_profile_id
    OR NEW.edit_policy_id IS DISTINCT FROM OLD.edit_policy_id
  ) THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_profile_def_cf: profile default identity is immutable; deactivate and insert' USING ERRCODE = '23514';
  END IF;
  IF NEW.rec_status <> 1 OR NEW.is_active <> true THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM public.sys_oc_edit_policy_mst AS policy
  WHERE policy.id = NEW.edit_policy_id
    AND policy.lifecycle_status = 'PUBLISHED'
    AND policy.rec_status = 1
    AND policy.is_active = true
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_profile_def_cf: profile default requires an active PUBLISHED Edit Policy' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.sys_wf_profiles_cd AS profile
  WHERE profile.profile_id = NEW.workflow_profile_id
    AND profile.rec_status = 1
    AND profile.is_active = true
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_profile_def_cf: workflow profile is not active' USING ERRCODE = '23514';
  END IF;
  FOR v_version_id IN
    SELECT version.version_id
    FROM public.sys_wf_profile_ver_mst AS version
    WHERE version.profile_id = NEW.workflow_profile_id
      AND version.version_status IN ('PILOT', 'PUBLISHED')
      AND version.rec_status = 1
      AND version.is_active = true
    FOR SHARE
  LOOP
    v_version_count := v_version_count + 1;
    IF NOT EXISTS (
      SELECT 1 FROM public.sys_wf_prof_ver_mod_st_cf AS membership
      WHERE membership.version_id = v_version_id
        AND membership.rec_status = 1
        AND membership.is_active = true
    ) THEN
      RAISE EXCEPTION 'sys_oc_edit_policy_profile_def_cf: workflow version % has no active statuses', v_version_id USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.sys_oc_edit_cov_status(NEW.edit_policy_id, v_version_id)) THEN
      RAISE EXCEPTION 'sys_oc_edit_policy_profile_def_cf: profile default is missing decisions for workflow version %', v_version_id USING ERRCODE = '23514';
    END IF;
  END LOOP;
  IF v_version_count = 0 THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_profile_def_cf: workflow profile has no active version' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_oc_edit_profile_def_guard() IS 'Allows one live Published Edit Policy per workflow profile only when every active version is fully covered. Deactivation stays possible.';
REVOKE ALL ON FUNCTION public.sys_oc_edit_profile_def_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sys_oc_edit_profile_def_guard() TO service_role;

CREATE TRIGGER trg_oc_edit_profile_def_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.sys_oc_edit_policy_profile_def_cf
FOR EACH ROW EXECUTE FUNCTION public.sys_oc_edit_profile_def_guard();
COMMENT ON TRIGGER trg_oc_edit_profile_def_guard ON public.sys_oc_edit_policy_profile_def_cf IS 'Checks identity, Published policy, and full coverage of every active version before a profile default goes live.';

-- -----------------------------------------------------------------------------
-- 3. Organization table stays the organization override only.
--    Retire live per-organization profile rows, then refuse a new live one.
-- -----------------------------------------------------------------------------
UPDATE public.org_oc_edit_policy_asg_cf
SET is_active = false,
    updated_at = CURRENT_TIMESTAMP,
    updated_info = 'Retired: a workflow profile Edit Policy applies to every organization, not one organization'
WHERE scope = 'PROFILE'
  AND rec_status = 1
  AND is_active = true;

CREATE OR REPLACE FUNCTION public.org_oc_edit_asg_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'org_oc_edit_policy_asg_cf: deactivate assignments instead of deleting audit evidence' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.workflow_profile_version_id IS NOT NULL THEN
    RAISE EXCEPTION 'org_oc_edit_policy_asg_cf: new overrides must leave the historical version null' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_org_id IS DISTINCT FROM OLD.tenant_org_id
    OR NEW.scope IS DISTINCT FROM OLD.scope
    OR NEW.workflow_profile_id IS DISTINCT FROM OLD.workflow_profile_id
    OR NEW.workflow_profile_version_id IS DISTINCT FROM OLD.workflow_profile_version_id
    OR NEW.edit_policy_id IS DISTINCT FROM OLD.edit_policy_id
    OR (OLD.scope = 'ORGANIZATION' AND OLD.rec_status = 1 AND OLD.is_active = true
      AND NEW.gap_acknowledged IS DISTINCT FROM OLD.gap_acknowledged)
  ) THEN
    RAISE EXCEPTION 'org_oc_edit_policy_asg_cf: assignment identity is immutable; deactivate and insert' USING ERRCODE = '23514';
  END IF;
  IF NEW.rec_status <> 1 OR NEW.is_active <> true THEN
    RETURN NEW;
  END IF;
  IF NEW.scope IS DISTINCT FROM 'ORGANIZATION' OR NEW.workflow_profile_id IS NOT NULL THEN
    RAISE EXCEPTION 'org_oc_edit_policy_asg_cf: an organization override has no workflow profile; set a profile or version default instead' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.sys_oc_edit_policy_mst AS policy
  WHERE policy.id = NEW.edit_policy_id
    AND policy.lifecycle_status IN ('PILOT', 'PUBLISHED')
    AND policy.rec_status = 1
    AND policy.is_active = true
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'org_oc_edit_policy_asg_cf: live override requires an active PILOT or PUBLISHED policy' USING ERRCODE = '23514';
  END IF;
  IF NEW.gap_acknowledged IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'org_oc_edit_policy_asg_cf: organization override requires gap acknowledgement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.org_oc_edit_asg_guard() IS 'Organization overrides are organization-wide. A workflow profile or version policy is stored in the platform default tables.';

-- -----------------------------------------------------------------------------
-- 4. Resolver. Same arguments. Organization, then this version, then this profile.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sys_oc_resolve_edit_policy(
  p_tenant_org_id UUID, p_profile_id UUID, p_profile_version_id UUID, p_workflow_status TEXT
)
RETURNS TABLE (
  resolution_level TEXT, deny_reason TEXT, edit_policy_id UUID, policy_revision INTEGER,
  policy_code TEXT, workflow_status TEXT, operation_code TEXT, target_type TEXT,
  decision TEXT, reason_code TEXT, message_key TEXT, requires_reason BOOLEAN,
  required_permission_code TEXT, override_permission_code TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_count BIGINT;
  v_policy_id UUID;
  v_ids UUID[];
  v_policy public.sys_oc_edit_policy_mst%ROWTYPE;
BEGIN
  workflow_status := p_workflow_status;
  resolution_level := 'DENY';
  deny_reason := 'NO_AUTHORITY';
  SELECT COUNT(*), array_agg(assignment.edit_policy_id) INTO v_count, v_ids
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
  IF v_policy_id IS NULL AND p_profile_version_id IS NOT NULL THEN
    SELECT COUNT(*), array_agg(default_link.edit_policy_id) INTO v_count, v_ids
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
  IF v_policy_id IS NULL AND p_profile_id IS NOT NULL THEN
    SELECT COUNT(*), array_agg(profile_link.edit_policy_id) INTO v_count, v_ids
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
  SELECT policy.* INTO v_policy
  FROM public.sys_oc_edit_policy_mst AS policy
  WHERE policy.id = v_policy_id;
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
  RETURN QUERY
  SELECT resolution_level, deny_reason, v_policy.id, v_policy.policy_revision,
    v_policy.policy_code, p_workflow_status, rule.operation_code, rule.target_type,
    rule.decision, rule.reason_code, rule.message_key, rule.requires_reason,
    rule.required_permission_code, rule.override_permission_code
  FROM public.sys_oc_edit_policy_rule_dtl AS rule
  WHERE rule.edit_policy_id = v_policy.id
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
COMMENT ON FUNCTION public.sys_oc_resolve_edit_policy(UUID, UUID, UUID, TEXT) IS 'Fail-closed organization override, then workflow-version default, then workflow-profile default. A future organization inherits the platform rows. Ambiguous links deny. Every organization read filters tenant_org_id.';
