-- =============================================================================
-- 0638_order_change_edit_policy_rename.sql
-- Move every Edit Policy database object out of the workflow (_wf_) namespace
-- into the Order Change (_oc_) namespace.
--
-- Why: Edit Policy began inside the workflow engine (0597, WP05-B) when each
-- policy belonged to one workflow profile version. Since 0637 policies are
-- reusable and independent of any version, and on 2026-10-23 the HQ module,
-- API route and screens became the separate "Order Change Config" domain.
-- The _wf_ prefix now misstates ownership. Columns that genuinely reference
-- the workflow domain (workflow_status, workflow_profile_id,
-- workflow_profile_version_id) keep their names on purpose.
--
-- Name map (all names stay within the 30-character limit):
--   sys_wf_edit_policy_mst       -> sys_oc_edit_policy_mst
--   sys_wf_edit_policy_rule_dtl  -> sys_oc_edit_policy_rule_dtl
--   org_wf_edit_policy_asg_cf    -> org_oc_edit_policy_asg_cf
--   sys_wf_edit_policy_def_cf    -> sys_oc_edit_policy_def_cf
--   sys_wf_order_edit_ops_cd     -> sys_oc_order_edit_ops_cd
--   sys_wf_order_edit_op_tgt_cd  -> sys_oc_order_edit_op_tgt_cd
--   sys_wf_resolve_edit_policy   -> sys_oc_resolve_edit_policy
--   sys_wf_edit_policy_save      -> sys_oc_edit_policy_save
--   sys_wf_edit_cov_status       -> sys_oc_edit_cov_status
--   sys_wf_edit_policy_guard     -> sys_oc_edit_policy_guard
--   sys_wf_edit_rule_guard       -> sys_oc_edit_rule_guard
--   sys_wf_edit_def_guard        -> sys_oc_edit_def_guard
--   sys_wf_edit_catalog_guard    -> sys_oc_edit_catalog_guard
--   org_wf_edit_asg_guard        -> org_oc_edit_asg_guard
--   constraints / indexes        *_wf_edit_*  -> *_oc_edit_*
--   triggers                     *_wf_edit_*  -> *_oc_edit_*
--   RLS policy org_wf_edit_asg_tenant_read -> org_oc_edit_asg_tenant_read
--
-- How:
--   * ALTER ... RENAME keeps data, OIDs, FKs, indexes, RLS, grants and every
--     existing COMMENT (comments are attached by OID, not by name).
--   * Function bodies are stored as text, so table renames do not follow into
--     them. Each function is recreated under its new name with a body that
--     names the new tables, its triggers are re-pointed, and the old function
--     is dropped. Bodies are byte-for-byte the live definitions read from the
--     catalog before authoring, changed only in object names and the guard
--     error-message prefixes (HQ maps errors by those prefixes).
--   * sys_oc_edit_catalog_guard compares TG_TABLE_NAME with the target-pair
--     table name as a string literal; that literal is updated, otherwise target
--     validation would silently stop running after the rename.
--   * Discovery (read-only, remote catalog): no view, other function, or
--     policy outside this set references these objects.
--
-- Deployment: breaking rename. The tenant app (web-admin + Prisma) and HQ
-- (platform-api + generated types) must ship the matching code right after
-- this migration. Pre-launch: demo data only, so no compatibility shim.
-- Rollback: a reverse migration applying the inverse name map.
-- =============================================================================

BEGIN;

-- Block concurrent reads/writes while names and trigger functions are swapped,
-- so no statement can observe a half-renamed set.
LOCK TABLE
  public.sys_wf_edit_policy_mst,
  public.sys_wf_edit_policy_rule_dtl,
  public.org_wf_edit_policy_asg_cf,
  public.sys_wf_edit_policy_def_cf,
  public.sys_wf_order_edit_ops_cd,
  public.sys_wf_order_edit_op_tgt_cd
IN ACCESS EXCLUSIVE MODE;

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_wf_edit_policy_mst      RENAME TO sys_oc_edit_policy_mst;
ALTER TABLE public.sys_wf_edit_policy_rule_dtl RENAME TO sys_oc_edit_policy_rule_dtl;
ALTER TABLE public.org_wf_edit_policy_asg_cf   RENAME TO org_oc_edit_policy_asg_cf;
ALTER TABLE public.sys_wf_edit_policy_def_cf   RENAME TO sys_oc_edit_policy_def_cf;
ALTER TABLE public.sys_wf_order_edit_ops_cd    RENAME TO sys_oc_order_edit_ops_cd;
ALTER TABLE public.sys_wf_order_edit_op_tgt_cd RENAME TO sys_oc_order_edit_op_tgt_cd;

COMMENT ON TABLE public.sys_oc_edit_policy_mst IS 'Order Change domain: reusable HQ-owned Edit Policy aggregate; overrides and defaults choose authority independently of its optional authored-against workflow version.';
COMMENT ON TABLE public.sys_oc_edit_policy_rule_dtl IS 'Order Change domain: explicit reusable status/operation/target decisions; missing live cells deny and published matrices remain immutable.';
COMMENT ON TABLE public.org_oc_edit_policy_asg_cf IS 'Order Change domain: organization-wide or profile-family Edit Policy overrides with immutable identity and retained inactive history; tenant RLS stays in force.';
COMMENT ON TABLE public.sys_oc_edit_policy_def_cf IS 'Order Change domain: HQ-only published Edit Policy default for one workflow version; no tenant data, no browser grants, no seeded authority.';
COMMENT ON TABLE public.sys_oc_order_edit_ops_cd IS 'Order Change domain: migration-owned extensible operation catalog with bilingual labels; registration never ships a writer or grants permission.';
COMMENT ON TABLE public.sys_oc_order_edit_op_tgt_cd IS 'Order Change domain: extensible reviewed operation/target pairs; defaults require decisions for every live pair and missing rules deny.';

-- -----------------------------------------------------------------------------
-- 2. Constraints (renaming a PK/UNIQUE constraint also renames its index).
--    Existing constraint comments carry over unchanged.
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_oc_edit_policy_mst RENAME CONSTRAINT pk_wf_edit_policy       TO pk_oc_edit_policy;
ALTER TABLE public.sys_oc_edit_policy_mst RENAME CONSTRAINT uq_wf_edit_policy_code  TO uq_oc_edit_policy_code;
ALTER TABLE public.sys_oc_edit_policy_mst RENAME CONSTRAINT ck_wf_edit_pol_code     TO ck_oc_edit_pol_code;
ALTER TABLE public.sys_oc_edit_policy_mst RENAME CONSTRAINT ck_wf_edit_pol_life     TO ck_oc_edit_pol_life;
ALTER TABLE public.sys_oc_edit_policy_mst RENAME CONSTRAINT ck_wf_edit_pol_rev      TO ck_oc_edit_pol_rev;
ALTER TABLE public.sys_oc_edit_policy_mst RENAME CONSTRAINT ck_wf_edit_pol_status   TO ck_oc_edit_pol_status;
ALTER TABLE public.sys_oc_edit_policy_mst RENAME CONSTRAINT fk_wf_edit_pol_profile  TO fk_oc_edit_pol_profile;
ALTER TABLE public.sys_oc_edit_policy_mst RENAME CONSTRAINT fk_wf_edit_pol_pilot_by TO fk_oc_edit_pol_pilot_by;
ALTER TABLE public.sys_oc_edit_policy_mst RENAME CONSTRAINT fk_wf_edit_pol_pub_by   TO fk_oc_edit_pol_pub_by;
ALTER TABLE public.sys_oc_edit_policy_mst RENAME CONSTRAINT fk_wf_edit_pol_ret_by   TO fk_oc_edit_pol_ret_by;

ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT pk_wf_edit_rule          TO pk_oc_edit_rule;
ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT uq_wf_edit_rule_key      TO uq_oc_edit_rule_key;
ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT ck_wf_edit_rule_decision TO ck_oc_edit_rule_decision;
ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT ck_wf_edit_rule_override TO ck_oc_edit_rule_override;
ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT ck_wf_edit_rule_reason   TO ck_oc_edit_rule_reason;
ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT ck_wf_edit_rule_status   TO ck_oc_edit_rule_status;
ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT fk_wf_edit_rule_policy   TO fk_oc_edit_rule_policy;
ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT fk_wf_edit_rule_op_tgt   TO fk_oc_edit_rule_op_tgt;
ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT fk_wf_edit_rule_status   TO fk_oc_edit_rule_status;
ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT fk_wf_edit_rule_req_perm TO fk_oc_edit_rule_req_perm;
ALTER TABLE public.sys_oc_edit_policy_rule_dtl RENAME CONSTRAINT fk_wf_edit_rule_ovr_perm TO fk_oc_edit_rule_ovr_perm;

ALTER TABLE public.org_oc_edit_policy_asg_cf RENAME CONSTRAINT pk_wf_edit_asg        TO pk_oc_edit_asg;
ALTER TABLE public.org_oc_edit_policy_asg_cf RENAME CONSTRAINT ck_wf_edit_asg_scope  TO ck_oc_edit_asg_scope;
ALTER TABLE public.org_oc_edit_policy_asg_cf RENAME CONSTRAINT ck_wf_edit_asg_status TO ck_oc_edit_asg_status;
ALTER TABLE public.org_oc_edit_policy_asg_cf RENAME CONSTRAINT fk_wf_edit_asg_pol    TO fk_oc_edit_asg_pol;
ALTER TABLE public.org_oc_edit_policy_asg_cf RENAME CONSTRAINT fk_wf_edit_asg_prof   TO fk_oc_edit_asg_prof;
ALTER TABLE public.org_oc_edit_policy_asg_cf RENAME CONSTRAINT fk_wf_edit_asg_tenant TO fk_oc_edit_asg_tenant;

ALTER TABLE public.sys_oc_edit_policy_def_cf RENAME CONSTRAINT pk_wf_edit_def        TO pk_oc_edit_def;
ALTER TABLE public.sys_oc_edit_policy_def_cf RENAME CONSTRAINT ck_wf_edit_def_status TO ck_oc_edit_def_status;
ALTER TABLE public.sys_oc_edit_policy_def_cf RENAME CONSTRAINT fk_wf_edit_def_pol    TO fk_oc_edit_def_pol;
ALTER TABLE public.sys_oc_edit_policy_def_cf RENAME CONSTRAINT fk_wf_edit_def_ver    TO fk_oc_edit_def_ver;

ALTER TABLE public.sys_oc_order_edit_ops_cd RENAME CONSTRAINT pk_wf_edit_ops       TO pk_oc_edit_ops;
ALTER TABLE public.sys_oc_order_edit_ops_cd RENAME CONSTRAINT ck_wf_edit_op_code   TO ck_oc_edit_op_code;
ALTER TABLE public.sys_oc_order_edit_ops_cd RENAME CONSTRAINT ck_wf_edit_op_status TO ck_oc_edit_op_status;

ALTER TABLE public.sys_oc_order_edit_op_tgt_cd RENAME CONSTRAINT pk_wf_edit_op_tgt        TO pk_oc_edit_op_tgt;
ALTER TABLE public.sys_oc_order_edit_op_tgt_cd RENAME CONSTRAINT ck_wf_edit_op_tgt_status TO ck_oc_edit_op_tgt_status;
ALTER TABLE public.sys_oc_order_edit_op_tgt_cd RENAME CONSTRAINT ck_wf_edit_op_tgt_type   TO ck_oc_edit_op_tgt_type;
ALTER TABLE public.sys_oc_order_edit_op_tgt_cd RENAME CONSTRAINT fk_wf_edit_op_tgt_op     TO fk_oc_edit_op_tgt_op;

-- -----------------------------------------------------------------------------
-- 3. Standalone indexes (partial-unique slots and lookup indexes; not backed by
--    constraints, so they are renamed directly). Existing comments carry over.
-- -----------------------------------------------------------------------------
ALTER INDEX public.uq_wf_edit_asg_org      RENAME TO uq_oc_edit_asg_org;
ALTER INDEX public.uq_wf_edit_asg_prof     RENAME TO uq_oc_edit_asg_prof;
ALTER INDEX public.uq_wf_edit_def_ver      RENAME TO uq_oc_edit_def_ver;
ALTER INDEX public.idx_wf_edit_asg_tenant  RENAME TO idx_oc_edit_asg_tenant;
ALTER INDEX public.idx_wf_edit_def_pol     RENAME TO idx_oc_edit_def_pol;
ALTER INDEX public.idx_wf_edit_pol_profile RENAME TO idx_oc_edit_pol_profile;
ALTER INDEX public.idx_wf_edit_rule_live   RENAME TO idx_oc_edit_rule_live;

-- -----------------------------------------------------------------------------
-- 4. RLS policy (definition unchanged: tenant_org_id = current_tenant_id(),
--    SELECT, authenticated). Browser table privileges remain revoked.
-- -----------------------------------------------------------------------------
ALTER POLICY org_wf_edit_asg_tenant_read ON public.org_oc_edit_policy_asg_cf RENAME TO org_oc_edit_asg_tenant_read;
COMMENT ON POLICY org_oc_edit_asg_tenant_read ON public.org_oc_edit_policy_asg_cf IS 'Defense-in-depth tenant predicate for any future approved read grant; browser table privileges remain revoked until membership-safe access is approved.';

-- -----------------------------------------------------------------------------
-- 5. Functions recreated under _oc_ names. Each keeps SECURITY INVOKER (the
--    default), its volatility, and a pinned search_path.
-- -----------------------------------------------------------------------------

-- Coverage gaps of one policy against one workflow version; used by the default
-- guard and HQ default inspection.
CREATE FUNCTION public.sys_oc_edit_cov_status(policy_id UUID, version_id UUID)
RETURNS TABLE(status_code TEXT, operation_code TEXT, target_type TEXT)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT DISTINCT membership.status_code, pair.operation_code, pair.target_type
  FROM public.sys_wf_prof_ver_mod_st_cf AS membership
  CROSS JOIN public.sys_oc_order_edit_op_tgt_cd AS pair
  WHERE membership.version_id = $2 AND membership.rec_status = 1 AND membership.is_active = true
    AND pair.rec_status = 1 AND pair.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.sys_oc_edit_policy_rule_dtl AS rule
      WHERE rule.edit_policy_id = $1 AND rule.workflow_status = membership.status_code
        AND rule.operation_code = pair.operation_code AND rule.target_type = pair.target_type
        AND rule.rec_status = 1 AND rule.is_active = true
    )
  ORDER BY membership.status_code, pair.operation_code, pair.target_type;
$function$;
COMMENT ON FUNCTION public.sys_oc_edit_cov_status(UUID, UUID) IS 'Returns missing live status/operation/target triples for a version default; deduplicates screen membership and never assumes a fixed catalog size.';

-- The single resolution algorithm shared by the tenant runtime and HQ preview.
CREATE FUNCTION public.sys_oc_resolve_edit_policy(
  p_tenant_org_id UUID, p_profile_id UUID, p_profile_version_id UUID, p_workflow_status TEXT
)
RETURNS TABLE (
  resolution_level TEXT, deny_reason TEXT, edit_policy_id UUID, policy_revision INTEGER,
  policy_code TEXT, workflow_status TEXT, operation_code TEXT, target_type TEXT,
  decision TEXT, reason_code TEXT, message_key TEXT, requires_reason BOOLEAN,
  required_permission_code TEXT, override_permission_code TEXT
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
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
  -- Organization authority deliberately precedes every narrower authority.
  SELECT COUNT(*), array_agg(assignment.edit_policy_id) INTO v_count, v_ids
  FROM public.org_oc_edit_policy_asg_cf AS assignment
  WHERE assignment.tenant_org_id = p_tenant_org_id AND assignment.scope = 'ORGANIZATION'
    AND assignment.rec_status = 1 AND assignment.is_active = true;
  IF v_count > 1 THEN deny_reason := 'AMBIGUOUS_ORGANIZATION'; RETURN NEXT; RETURN; END IF;
  IF v_count = 1 THEN
    resolution_level := 'ORGANIZATION'; v_policy_id := v_ids[1];
  ELSIF p_profile_id IS NOT NULL THEN
    SELECT COUNT(*), array_agg(assignment.edit_policy_id) INTO v_count, v_ids
    FROM public.org_oc_edit_policy_asg_cf AS assignment
    WHERE assignment.tenant_org_id = p_tenant_org_id AND assignment.scope = 'PROFILE'
      AND assignment.workflow_profile_id = p_profile_id
      AND assignment.rec_status = 1 AND assignment.is_active = true;
    IF v_count > 1 THEN deny_reason := 'AMBIGUOUS_PROFILE'; RETURN NEXT; RETURN; END IF;
    IF v_count = 1 THEN resolution_level := 'PROFILE'; v_policy_id := v_ids[1]; END IF;
  END IF;
  IF v_policy_id IS NULL AND p_profile_version_id IS NOT NULL THEN
    SELECT COUNT(*), array_agg(default_link.edit_policy_id) INTO v_count, v_ids
    FROM public.sys_oc_edit_policy_def_cf AS default_link
    WHERE default_link.workflow_profile_version_id = p_profile_version_id
      AND default_link.rec_status = 1 AND default_link.is_active = true;
    IF v_count > 1 THEN deny_reason := 'AMBIGUOUS_DEFAULT'; RETURN NEXT; RETURN; END IF;
    IF v_count = 1 THEN resolution_level := 'VERSION_DEFAULT'; v_policy_id := v_ids[1]; END IF;
  END IF;
  IF v_policy_id IS NULL THEN RETURN NEXT; RETURN; END IF;
  SELECT policy.* INTO v_policy FROM public.sys_oc_edit_policy_mst AS policy WHERE policy.id = v_policy_id;
  IF NOT FOUND OR v_policy.rec_status <> 1 OR v_policy.is_active <> true
    OR v_policy.lifecycle_status NOT IN ('PILOT', 'PUBLISHED')
    OR (resolution_level = 'VERSION_DEFAULT' AND v_policy.lifecycle_status <> 'PUBLISHED') THEN
    resolution_level := 'DENY'; deny_reason := 'POLICY_NOT_USABLE'; RETURN NEXT; RETURN;
  END IF;
  edit_policy_id := v_policy.id; policy_revision := v_policy.policy_revision; policy_code := v_policy.policy_code;
  deny_reason := 'NONE';
  RETURN QUERY SELECT resolution_level, deny_reason, v_policy.id, v_policy.policy_revision,
    v_policy.policy_code, p_workflow_status, rule.operation_code, rule.target_type,
    rule.decision, rule.reason_code, rule.message_key, rule.requires_reason,
    rule.required_permission_code, rule.override_permission_code
  FROM public.sys_oc_edit_policy_rule_dtl AS rule
  WHERE rule.edit_policy_id = v_policy.id AND rule.workflow_status = p_workflow_status
    AND rule.rec_status = 1 AND rule.is_active = true
  ORDER BY rule.operation_code, rule.target_type;
  IF NOT FOUND THEN deny_reason := 'STATUS_NOT_COVERED'; RETURN NEXT; END IF;
END;
$function$;
COMMENT ON FUNCTION public.sys_oc_resolve_edit_policy(UUID, UUID, UUID, TEXT) IS 'Fail-closed organization > profile > published version default resolution; ambiguous/broken links stop, missing status preserves winner identity, and every tenant read has an explicit predicate.';

-- Atomic matrix replacement used by HQ authoring.
CREATE FUNCTION public.sys_oc_edit_policy_save(
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
    RAISE EXCEPTION 'sys_oc_edit_policy_save: stale policy revision' USING ERRCODE = '40001';
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

-- Lifecycle, revision and immutability guard on the policy aggregate.
CREATE FUNCTION public.sys_oc_edit_policy_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.lifecycle_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'sys_oc_edit_policy_mst: only DRAFT policies may be deleted; retire published policy evidence instead' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.policy_code IS DISTINCT FROM OLD.policy_code THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_mst: policy_code is immutable' USING ERRCODE = '23514';
  END IF;

  IF OLD.lifecycle_status = 'DRAFT' THEN
    IF NEW.lifecycle_status NOT IN ('DRAFT', 'PILOT') OR NEW.policy_revision <> OLD.policy_revision + 1 THEN
      RAISE EXCEPTION 'sys_oc_edit_policy_mst: Draft must remain Draft or enter Pilot and increment policy_revision by one' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.lifecycle_status = 'PILOT' THEN
    IF NEW.lifecycle_status NOT IN ('PILOT', 'PUBLISHED') OR NEW.policy_revision <> OLD.policy_revision + 1 THEN
      RAISE EXCEPTION 'sys_oc_edit_policy_mst: Pilot must remain Pilot or become Published and increment policy_revision by one' USING ERRCODE = '23514';
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
      RAISE EXCEPTION 'sys_oc_edit_policy_mst: PUBLISHED policy is immutable except controlled retirement' USING ERRCODE = '23514';
    END IF;
  ELSIF OLD.lifecycle_status = 'RETIRED' THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_mst: RETIRED policy is immutable' USING ERRCODE = '23514';
  ELSE
    RAISE EXCEPTION 'sys_oc_edit_policy_mst: unknown existing lifecycle %', OLD.lifecycle_status USING ERRCODE = '23514';
  END IF;

  -- Reusable policies may intentionally cover only selected statuses. Full
  -- version coverage belongs to default activation, not policy promotion.
  IF NEW.lifecycle_status IN ('PILOT', 'PUBLISHED') AND NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sys_oc_edit_policy_rule_dtl AS rule
      WHERE rule.edit_policy_id = NEW.id AND rule.rec_status = 1 AND rule.is_active = true
    ) THEN
      RAISE EXCEPTION 'sys_oc_edit_policy_mst: promotion requires at least one live rule' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.sys_oc_edit_policy_rule_dtl AS rule
      WHERE rule.edit_policy_id = NEW.id AND rule.rec_status = 1 AND rule.is_active = true
        AND (NOT EXISTS (
          SELECT 1 FROM public.sys_wf_statuses_cd AS status
          WHERE status.status_code = rule.workflow_status AND status.rec_status = 1 AND status.is_active = true
        ) OR NOT EXISTS (
          SELECT 1 FROM public.sys_oc_order_edit_op_tgt_cd AS pair
          JOIN public.sys_oc_order_edit_ops_cd AS operation ON operation.operation_code = pair.operation_code
          WHERE pair.operation_code = rule.operation_code AND pair.target_type = rule.target_type
            AND pair.rec_status = 1 AND pair.is_active = true
            AND operation.rec_status = 1 AND operation.is_active = true
        ))
    ) THEN
      RAISE EXCEPTION 'sys_oc_edit_policy_mst: promotion requires active statuses and catalog pairs' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_oc_edit_policy_guard() IS 'Preserves controlled lifecycle, revision progression and published immutability; promotion needs nonempty valid live rules, while complete version coverage is enforced on defaults.';

-- Matrix rule guard: immutable published matrices, active statuses, revision bump.
CREATE FUNCTION public.sys_oc_edit_rule_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE v_policy_id UUID; v_lifecycle TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.edit_policy_id IS DISTINCT FROM OLD.edit_policy_id THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_rule_dtl: rule policy identity is immutable' USING ERRCODE = '23514';
  END IF;
  v_policy_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.edit_policy_id ELSE NEW.edit_policy_id END;
  SELECT policy.lifecycle_status INTO v_lifecycle
  FROM public.sys_oc_edit_policy_mst AS policy WHERE policy.id = v_policy_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_rule_dtl: policy % does not exist', v_policy_id USING ERRCODE = '23514';
  END IF;
  IF v_lifecycle IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_rule_dtl: % policy rules are immutable', v_lifecycle USING ERRCODE = '23514';
  END IF;
  IF TG_OP <> 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.sys_wf_statuses_cd AS status
    WHERE status.status_code = NEW.workflow_status AND status.rec_status = 1 AND status.is_active = true
  ) THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_rule_dtl: workflow status % is not active', NEW.workflow_status USING ERRCODE = '23514';
  END IF;
  IF current_setting('cmx.edit_policy_save', true) IS DISTINCT FROM 'on' THEN
    -- Direct rule mutations invalidate reviews once; the atomic save command
    -- advances the aggregate once after replacing its entire matrix instead.
    UPDATE public.sys_oc_edit_policy_mst SET policy_revision = policy_revision + 1,
      updated_at = CURRENT_TIMESTAMP, updated_info = 'Edit Policy rule matrix changed'
    WHERE id = v_policy_id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_oc_edit_rule_guard() IS 'Protects immutable published matrices, validates active global statuses and retains exactly-once aggregate revisions for the atomic save command.';

-- Version default guard: immutable identity, published policy, usable version, full coverage.
CREATE FUNCTION public.sys_oc_edit_def_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_def_cf: deactivate defaults instead of deleting history' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id
    OR NEW.workflow_profile_version_id IS DISTINCT FROM OLD.workflow_profile_version_id
    OR NEW.edit_policy_id IS DISTINCT FROM OLD.edit_policy_id) THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_def_cf: default identity is immutable; deactivate and insert' USING ERRCODE = '23514';
  END IF;
  IF NEW.rec_status <> 1 OR NEW.is_active <> true THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.sys_oc_edit_policy_mst AS policy
  WHERE policy.id = NEW.edit_policy_id AND policy.lifecycle_status = 'PUBLISHED'
    AND policy.rec_status = 1 AND policy.is_active = true FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_def_cf: default requires an active PUBLISHED Edit Policy' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.sys_wf_profile_ver_mst AS version
  WHERE version.version_id = NEW.workflow_profile_version_id
    AND version.version_status IN ('PILOT', 'PUBLISHED')
    AND version.rec_status = 1 AND version.is_active = true FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_def_cf: default requires an active PILOT or PUBLISHED workflow version' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sys_wf_prof_ver_mod_st_cf AS membership
    WHERE membership.version_id = NEW.workflow_profile_version_id
      AND membership.rec_status = 1 AND membership.is_active = true
  ) THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_def_cf: profile version has no active statuses' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sys_oc_edit_cov_status(NEW.edit_policy_id, NEW.workflow_profile_version_id)) THEN
    RAISE EXCEPTION 'sys_oc_edit_policy_def_cf: default is missing live status/operation/target decisions' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_oc_edit_def_guard() IS 'Preserves default history and permits live links only for usable workflow versions, published policies and complete dynamic coverage; zero active statuses fail.';

-- Catalog guard shared by the operation and operation/target tables.
CREATE FUNCTION public.sys_oc_edit_catalog_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '%: deactivate catalog history instead of deleting it', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  IF NEW.operation_code IS NULL OR NEW.operation_code !~ '^[A-Z][A-Z0-9_]{2,63}$' THEN
    RAISE EXCEPTION '%: invalid operation code', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.operation_code IS DISTINCT FROM OLD.operation_code THEN
    RAISE EXCEPTION '%: operation_code is immutable', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;
  -- String comparison with the pair table name: must track any future rename.
  IF TG_TABLE_NAME = 'sys_oc_order_edit_op_tgt_cd' THEN
    IF NEW.target_type IS NULL OR NEW.target_type NOT IN ('ORDER', 'ITEM', 'PIECE', 'PREFERENCE') THEN
      RAISE EXCEPTION '%: invalid target type', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.target_type IS DISTINCT FROM OLD.target_type THEN
      RAISE EXCEPTION '%: pair identity is immutable; deactivate and insert', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.sys_oc_order_edit_ops_cd AS operation WHERE operation.operation_code = NEW.operation_code) THEN
      RAISE EXCEPTION '%: operation does not exist', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.sys_oc_edit_catalog_guard() IS 'Allows migration-owned catalog expansion; protects code and pair identities, four target types and retained history.';

-- Organization/profile override guard. Every tenant-scoped read filters tenant_org_id.
CREATE FUNCTION public.org_oc_edit_asg_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
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
  IF NEW.rec_status <> 1 OR NEW.is_active <> true THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.sys_oc_edit_policy_mst AS policy
  WHERE policy.id = NEW.edit_policy_id AND policy.lifecycle_status IN ('PILOT', 'PUBLISHED')
    AND policy.rec_status = 1 AND policy.is_active = true FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'org_oc_edit_policy_asg_cf: live override requires an active PILOT or PUBLISHED policy' USING ERRCODE = '23514';
  END IF;
  IF NEW.scope = 'PROFILE' THEN
    PERFORM 1 FROM public.org_wf_profile_assign_cf AS workflow_assignment
    WHERE workflow_assignment.tenant_org_id = NEW.tenant_org_id
      AND workflow_assignment.wf_profile_id = NEW.workflow_profile_id
      AND workflow_assignment.rec_status = 1 AND workflow_assignment.is_active = true FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'org_oc_edit_policy_asg_cf: profile override requires an active organization profile assignment' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.scope = 'ORGANIZATION' AND NEW.gap_acknowledged IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'org_oc_edit_policy_asg_cf: organization override requires gap acknowledgement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
COMMENT ON FUNCTION public.org_oc_edit_asg_guard() IS 'Preserves override identity/history and requires a usable policy, profile-family assignment or explicit organization acknowledgement for live links.';

-- -----------------------------------------------------------------------------
-- 6. Function privileges. Mirror the old ones exactly: owner (postgres, the
--    tenant server role) and service_role (HQ) only. PUBLIC, anon and
--    authenticated never execute these.
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.sys_oc_edit_cov_status(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sys_oc_resolve_edit_policy(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sys_oc_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sys_oc_edit_policy_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sys_oc_edit_rule_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sys_oc_edit_def_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sys_oc_edit_catalog_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.org_oc_edit_asg_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sys_oc_edit_cov_status(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sys_oc_resolve_edit_policy(UUID, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.sys_oc_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sys_oc_edit_policy_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.sys_oc_edit_rule_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.sys_oc_edit_def_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.sys_oc_edit_catalog_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.org_oc_edit_asg_guard() TO service_role;

-- -----------------------------------------------------------------------------
-- 7. Triggers re-pointed to the new functions. A trigger's function cannot be
--    changed in place, so each is dropped and recreated with identical timing
--    and events.
-- -----------------------------------------------------------------------------
DROP TRIGGER trg_sys_wf_edit_policy_guard ON public.sys_oc_edit_policy_mst RESTRICT;
CREATE TRIGGER trg_sys_oc_edit_policy_guard BEFORE UPDATE OR DELETE
ON public.sys_oc_edit_policy_mst FOR EACH ROW EXECUTE FUNCTION public.sys_oc_edit_policy_guard();
COMMENT ON TRIGGER trg_sys_oc_edit_policy_guard ON public.sys_oc_edit_policy_mst IS 'Preserves controlled lifecycle and immutable published evidence without requiring authored-version coverage on promotion.';

DROP TRIGGER trg_sys_wf_edit_rule_guard ON public.sys_oc_edit_policy_rule_dtl RESTRICT;
CREATE TRIGGER trg_sys_oc_edit_rule_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.sys_oc_edit_policy_rule_dtl FOR EACH ROW EXECUTE FUNCTION public.sys_oc_edit_rule_guard();
COMMENT ON TRIGGER trg_sys_oc_edit_rule_guard ON public.sys_oc_edit_policy_rule_dtl IS 'Protects published matrices and active global statuses while preserving atomic-save revision semantics.';

DROP TRIGGER trg_org_wf_edit_asg_guard ON public.org_oc_edit_policy_asg_cf RESTRICT;
CREATE TRIGGER trg_org_oc_edit_asg_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.org_oc_edit_policy_asg_cf FOR EACH ROW EXECUTE FUNCTION public.org_oc_edit_asg_guard();
COMMENT ON TRIGGER trg_org_oc_edit_asg_guard ON public.org_oc_edit_policy_asg_cf IS 'Guards scope identity and live override eligibility; inactive retirement skips lifecycle checks.';

DROP TRIGGER trg_wf_edit_def_guard ON public.sys_oc_edit_policy_def_cf RESTRICT;
CREATE TRIGGER trg_oc_edit_def_guard BEFORE INSERT OR UPDATE OR DELETE
ON public.sys_oc_edit_policy_def_cf FOR EACH ROW EXECUTE FUNCTION public.sys_oc_edit_def_guard();
COMMENT ON TRIGGER trg_oc_edit_def_guard ON public.sys_oc_edit_policy_def_cf IS 'Checks immutable identity and full coverage when activating a default; deactivation remains possible after authority breaks.';

DROP TRIGGER trg_wf_edit_ops_catalog ON public.sys_oc_order_edit_ops_cd RESTRICT;
CREATE TRIGGER trg_oc_edit_ops_catalog BEFORE INSERT OR UPDATE OR DELETE
ON public.sys_oc_order_edit_ops_cd FOR EACH ROW EXECUTE FUNCTION public.sys_oc_edit_catalog_guard();
COMMENT ON TRIGGER trg_oc_edit_ops_catalog ON public.sys_oc_order_edit_ops_cd IS 'Validates extensible reviewed operation codes and prevents identity changes or hard deletion.';

DROP TRIGGER trg_wf_edit_tgt_catalog ON public.sys_oc_order_edit_op_tgt_cd RESTRICT;
CREATE TRIGGER trg_oc_edit_tgt_catalog BEFORE INSERT OR UPDATE OR DELETE
ON public.sys_oc_order_edit_op_tgt_cd FOR EACH ROW EXECUTE FUNCTION public.sys_oc_edit_catalog_guard();
COMMENT ON TRIGGER trg_oc_edit_tgt_catalog ON public.sys_oc_order_edit_op_tgt_cd IS 'Validates four-target catalog pairs and preserves their historical identity without freezing additions.';

-- -----------------------------------------------------------------------------
-- 8. Remove the _wf_ functions. RESTRICT: nothing may still depend on them
--    (their triggers were dropped above; discovery found no other dependents).
-- -----------------------------------------------------------------------------
DROP FUNCTION public.sys_wf_resolve_edit_policy(UUID, UUID, UUID, TEXT) RESTRICT;
DROP FUNCTION public.sys_wf_edit_policy_save(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, JSONB, UUID) RESTRICT;
DROP FUNCTION public.sys_wf_edit_def_guard() RESTRICT;
DROP FUNCTION public.sys_wf_edit_cov_status(UUID, UUID) RESTRICT;
DROP FUNCTION public.sys_wf_edit_policy_guard() RESTRICT;
DROP FUNCTION public.sys_wf_edit_rule_guard() RESTRICT;
DROP FUNCTION public.sys_wf_edit_catalog_guard() RESTRICT;
DROP FUNCTION public.org_wf_edit_asg_guard() RESTRICT;

-- -----------------------------------------------------------------------------
-- 9. Self-check: fail the whole migration if any _wf_ Edit Policy object or a
--    function body still naming one survives.
-- -----------------------------------------------------------------------------
DO $verify$
DECLARE v_leftover TEXT;
BEGIN
  SELECT string_agg(name, ', ') INTO v_leftover FROM (
    SELECT c.relname::TEXT AS name FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname ~ '_wf_(edit|order_edit)'
    UNION ALL
    SELECT p.proname::TEXT FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND (p.proname ~ '_wf_(edit|order_edit|resolve_edit)'
        OR pg_get_functiondef(p.oid) ~ '(sys|org)_wf_(edit|order_edit)')
    UNION ALL
    SELECT t.tgname::TEXT FROM pg_trigger AS t WHERE NOT t.tgisinternal AND t.tgname ~ '_wf_edit'
    UNION ALL
    SELECT pol.polname::TEXT FROM pg_policy AS pol WHERE pol.polname ~ '_wf_edit'
    UNION ALL
    SELECT con.conname::TEXT FROM pg_constraint AS con WHERE con.conname ~ '_wf_edit'
  ) AS leftover;
  IF v_leftover IS NOT NULL THEN
    RAISE EXCEPTION '0638: Edit Policy objects still in the _wf_ namespace: %', v_leftover;
  END IF;
END;
$verify$;

COMMIT;
