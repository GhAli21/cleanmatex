-- ============================================================================
-- 0470_live_normalized_workflow_profile_runtime.sql
-- Purpose: Make normalized profile-version rows the only workflow-policy
--          authority at runtime. Compiled artifacts remain historical audit
--          records only and are not required to publish, assign, create, or
--          operate an order.
-- Ownership: CleanMateX tenant repository owns the shared-schema migration.
-- Consumers: cleanmatex tenant runtime and cleanmatexsaas HQ configuration.
-- Safety: Forward-only and non-destructive. It does not delete artifact rows
--         or historical order values; application deployment switches reads
--         to normalized tables after this migration is reviewed and applied.
-- Dependencies: 0457, 0458, 0464, 0468, 0469.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Active orders bind to one profile version, not a serialized artifact.
--    Artifact columns stay nullable for historical audit during development,
--    but the runtime no longer interprets or requires them.
-- ---------------------------------------------------------------------------
ALTER TABLE public.org_orders_mst
  DROP CONSTRAINT IF EXISTS chk_ord_wf_sem_snapshot,
  DROP CONSTRAINT IF EXISTS chk_ord_wf_snap_required,
  ADD CONSTRAINT chk_ord_wf_prof_binding CHECK (
    (
      wf_profile_id IS NULL
      AND wf_version_no IS NULL
      AND wf_profile_version_id IS NULL
    ) OR (
      wf_profile_id IS NOT NULL
      AND wf_version_no IS NOT NULL
      AND wf_profile_version_id IS NOT NULL
    )
  ) NOT VALID;

COMMENT ON CONSTRAINT chk_ord_wf_prof_binding ON public.org_orders_mst IS
  'Keeps the direct workflow profile-version binding complete for new or changed orders while preserving historical development records.';

CREATE INDEX IF NOT EXISTS idx_ord_wf_prof_version
  ON public.org_orders_mst (tenant_org_id, wf_profile_version_id)
  WHERE wf_profile_version_id IS NOT NULL;

COMMENT ON INDEX public.idx_ord_wf_prof_version IS
  'Supports tenant-scoped operational and audit lookup by the live profile version bound to an order.';

COMMENT ON COLUMN public.org_orders_mst.wf_profile_id IS
  'Profile identity selected for this order at creation. Reassignment affects only later orders.';
COMMENT ON COLUMN public.org_orders_mst.wf_version_no IS
  'Profile version number selected for this order at creation. Existing orders never follow a later tenant assignment automatically.';
COMMENT ON COLUMN public.org_orders_mst.wf_profile_version_id IS
  'Stable normalized profile-version row used by this order at runtime.';
COMMENT ON COLUMN public.org_orders_mst.wf_profile_artifact_id IS
  'Historical compiler artifact reference retained temporarily for development-data audit; it is not a workflow runtime dependency.';
COMMENT ON COLUMN public.org_orders_mst.wf_profile_revision IS
  'Historical policy revision audit value. Runtime resolves normalized records for the order profile version.';
COMMENT ON COLUMN public.org_orders_mst.wf_profile_checksum IS
  'Historical compiler checksum audit value. It is not used for workflow authorization or routing.';
COMMENT ON COLUMN public.org_orders_mst.wf_profile_schema_version IS
  'Historical compiler serialization schema audit value. It is not used by the live normalized runtime.';

-- ---------------------------------------------------------------------------
-- 2) Relational validation replaces compiler-artifact publication checks.
--    This is an internal guard helper, not a client-callable RPC contract.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_validate_live(
  p_version_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_policy_cf
    WHERE version_id = p_version_id
      AND is_active = true
      AND rec_status = 1
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: version % requires an active policy row',
      p_version_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_init_cf
    WHERE version_id = p_version_id
      AND is_active = true
      AND rec_status = 1
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: version % requires at least one active initial rule',
      p_version_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_module_cf
    WHERE version_id = p_version_id
      AND module_mode = 'primary_owner'
      AND is_enabled = true
      AND is_active = true
      AND rec_status = 1
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: version % requires at least one enabled primary owner module',
      p_version_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_exec_cf AS executable
    WHERE executable.version_id = p_version_id
      AND executable.is_active = true
      AND executable.rec_status = 1
      AND NOT EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_exec_ch_cf AS channel
        WHERE channel.exec_id = executable.exec_id
          AND channel.is_active = true
          AND channel.rec_status = 1
      )
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: every active executable requires at least one active channel';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_exec_cf AS executable
    WHERE executable.version_id = p_version_id
      AND executable.is_active = true
      AND executable.rec_status = 1
      AND NOT EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS module_row
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS membership
          ON membership.version_id = module_row.version_id
         AND membership.screen_key = module_row.screen_key
        WHERE module_row.version_id = executable.version_id
          AND module_row.screen_key = executable.screen_key
          AND module_row.module_mode <> 'observer'
          AND module_row.is_enabled = true
          AND module_row.is_active = true
          AND module_row.rec_status = 1
          AND membership.status_code = executable.from_status
          AND membership.visibility_mode = 'owner'
          AND membership.is_active = true
          AND membership.rec_status = 1
      )
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: every active executable requires owner visibility for its source status';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_init_cf AS initial_rule
    WHERE initial_rule.version_id = p_version_id
      AND initial_rule.is_active = true
      AND initial_rule.rec_status = 1
      AND NOT EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS module_row
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS membership
          ON membership.version_id = module_row.version_id
         AND membership.screen_key = module_row.screen_key
        WHERE module_row.version_id = initial_rule.version_id
          AND module_row.module_mode = 'primary_owner'
          AND module_row.is_enabled = true
          AND module_row.is_active = true
          AND module_row.rec_status = 1
          AND membership.status_code = initial_rule.initial_status
          AND membership.visibility_mode = 'owner'
          AND membership.is_active = true
          AND membership.rec_status = 1
      )
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: every active initial rule requires an enabled primary owner for its initial status';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_validate_live(UUID) FROM PUBLIC;

COMMENT ON FUNCTION public.sys_wf_prof_ver_validate_live(UUID) IS
  'Internal relational completeness guard for Pilot, Published, and assigned workflow profile versions; not a runtime policy resolver or public RPC.';

-- ---------------------------------------------------------------------------
-- 3) Lifecycle remains strict, but Pilot/Published validity is now proven
--    from live normalized records rather than an artifact/checksum pair.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.version_status IN ('PILOT', 'PUBLISHED', 'RETIRED') THEN
      RAISE EXCEPTION
        'sys_wf_profile_ver_mst: cannot delete % version %',
        OLD.version_status,
        OLD.version_no;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.version_status = 'RETIRED' THEN
    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: RETIRED version % is immutable',
      OLD.version_no;
  END IF;

  IF OLD.version_status = 'PUBLISHED' THEN
    IF NEW.version_status = 'RETIRED'
       AND NEW.version_id IS NOT DISTINCT FROM OLD.version_id
       AND NEW.profile_id IS NOT DISTINCT FROM OLD.profile_id
       AND NEW.version_no IS NOT DISTINCT FROM OLD.version_no
       AND NEW.name IS NOT DISTINCT FROM OLD.name
       AND NEW.name2 IS NOT DISTINCT FROM OLD.name2
       AND NEW.change_summary IS NOT DISTINCT FROM OLD.change_summary
       AND NEW.change_summary2 IS NOT DISTINCT FROM OLD.change_summary2
       AND NEW.based_on_template_id IS NOT DISTINCT FROM OLD.based_on_template_id
       AND NEW.use_preparation_screen IS NOT DISTINCT FROM OLD.use_preparation_screen
       AND NEW.use_assembly_screen IS NOT DISTINCT FROM OLD.use_assembly_screen
       AND NEW.use_qa_screen IS NOT DISTINCT FROM OLD.use_qa_screen
       AND NEW.use_packing_screen IS NOT DISTINCT FROM OLD.use_packing_screen
       AND NEW.track_individual_piece IS NOT DISTINCT FROM OLD.track_individual_piece
       AND NEW.orders_split_enabled IS NOT DISTINCT FROM OLD.orders_split_enabled
       AND NEW.allow_back_steps IS NOT DISTINCT FROM OLD.allow_back_steps
       AND NEW.config_json IS NOT DISTINCT FROM OLD.config_json
       AND NEW.policy_revision IS NOT DISTINCT FROM OLD.policy_revision
       AND NEW.compiled_schema_version IS NOT DISTINCT FROM OLD.compiled_schema_version
       AND NEW.compiled_checksum IS NOT DISTINCT FROM OLD.compiled_checksum
       AND NEW.compiled_at IS NOT DISTINCT FROM OLD.compiled_at
       AND NEW.compiled_by IS NOT DISTINCT FROM OLD.compiled_by
       AND NEW.current_artifact_id IS NOT DISTINCT FROM OLD.current_artifact_id
       AND NEW.pilot_started_at IS NOT DISTINCT FROM OLD.pilot_started_at
       AND NEW.pilot_started_by IS NOT DISTINCT FROM OLD.pilot_started_by
       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
       AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
       AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
       AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
       AND NEW.rec_status IS NOT DISTINCT FROM OLD.rec_status
    THEN
      NEW.retired_at := COALESCE(NEW.retired_at, CURRENT_TIMESTAMP);
      NEW.updated_at := CURRENT_TIMESTAMP;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: PUBLISHED version % is immutable; clone a Draft/Pilot version instead',
      OLD.version_no;
  END IF;

  IF OLD.version_status = 'DRAFT' AND NEW.version_status NOT IN ('DRAFT', 'PILOT') THEN
    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: DRAFT version % must enter PILOT before PUBLISHED',
      OLD.version_no;
  END IF;

  IF OLD.version_status = 'PILOT' AND NEW.version_status NOT IN ('PILOT', 'PUBLISHED') THEN
    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: PILOT version % can only remain PILOT or become PUBLISHED',
      OLD.version_no;
  END IF;

  IF NEW.version_status IN ('PILOT', 'PUBLISHED') THEN
    PERFORM public.sys_wf_prof_ver_validate_live(NEW.version_id);
  END IF;

  IF NEW.version_status = 'PILOT' THEN
    NEW.pilot_started_at := COALESCE(NEW.pilot_started_at, CURRENT_TIMESTAMP);
  END IF;

  IF NEW.version_status = 'PUBLISHED' THEN
    NEW.published_at := COALESCE(NEW.published_at, CURRENT_TIMESTAMP);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sys_wf_prof_ver_guard() IS
  'Enforces Draft to Pilot to Published to Retired lifecycle, published immutability, and live relational policy validation without compiler artifacts.';

-- ---------------------------------------------------------------------------
-- 4) Editing a Draft or Pilot advances its policy revision for optimistic
--    concurrency only. Artifact metadata is deliberately not runtime state.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sys_wf_prof_cfg_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version_id UUID;
  v_status TEXT;
BEGIN
  v_version_id := COALESCE(NEW.version_id, OLD.version_id);

  SELECT version_status
  INTO v_status
  FROM public.sys_wf_profile_ver_mst
  WHERE version_id = v_version_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'sys_wf_profile_ver_mst: version % does not exist', v_version_id;
  END IF;

  IF v_status IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: % version policy is immutable',
      v_status;
  END IF;

  UPDATE public.sys_wf_profile_ver_mst
  SET
    policy_revision = policy_revision + 1,
    updated_at = CURRENT_TIMESTAMP
  WHERE version_id = v_version_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sys_wf_prof_cfg_guard() IS
  'Prevents published or retired policy mutation and advances the normalized policy revision after a Draft or Pilot edit.';

-- ---------------------------------------------------------------------------
-- 5) Assignments select executable live versions. A Pilot remains restricted
--    to an HQ test/demo tenant but no artifact freshness check is performed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_wf_prof_asg_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
  v_version_id UUID;
  v_is_test_demo BOOLEAN;
BEGIN
  IF COALESCE(NEW.is_active, true) = false
     OR COALESCE(NEW.rec_status, 1) <> 1
     OR NEW.wf_version_no IS NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT version_id, version_status
  INTO v_version_id, v_status
  FROM public.sys_wf_profile_ver_mst
  WHERE profile_id = NEW.wf_profile_id
    AND version_no = NEW.wf_version_no;

  IF v_status IS NULL THEN
    RAISE EXCEPTION
      'org_wf_profile_assign_cf: workflow profile version % does not exist for profile %',
      NEW.wf_version_no,
      NEW.wf_profile_id;
  END IF;

  IF v_status = 'PILOT' THEN
    SELECT COALESCE(is_hq_test_demo, false)
    INTO v_is_test_demo
    FROM public.org_tenants_mst
    WHERE id = NEW.tenant_org_id;

    IF COALESCE(v_is_test_demo, false) = false THEN
      RAISE EXCEPTION
        'org_wf_profile_assign_cf: PILOT versions may be assigned only to HQ test/demo tenants';
    END IF;
  ELSIF v_status <> 'PUBLISHED' THEN
    RAISE EXCEPTION
      'org_wf_profile_assign_cf: active assignments require a PILOT or PUBLISHED profile version';
  END IF;

  PERFORM public.sys_wf_prof_ver_validate_live(v_version_id);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.org_wf_prof_asg_guard() IS
  'Allows active tenant assignments only to relationally valid Pilot or Published versions and restricts Pilot versions to HQ test/demo tenants.';

-- ---------------------------------------------------------------------------
-- 6) The partial-fulfilment switches are operational policy choices. Their
--    values must not be forced false by the earlier compiler-era constraint.
-- ---------------------------------------------------------------------------
ALTER TABLE public.sys_wf_prof_ver_policy_cf
  DROP CONSTRAINT IF EXISTS chk_wf_prof_policy_partial;

COMMENT ON TABLE public.sys_wf_prof_ver_policy_cf IS
  'Normalized version-level operational policy consumed directly by runtime services; it is not compiled into a runtime artifact.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.partial_pickup_enabled IS
  'Whether this profile version permits an authorized partial customer pickup workflow.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.partial_delivery_enabled IS
  'Whether this profile version permits an authorized partial delivery workflow.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.returns_enabled IS
  'Whether this profile version enables the return workflow once its service is configured.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.otp_enabled IS
  'Whether this profile version requires OTP once an OTP service is deliberately enabled; false keeps OTP out of the current flow.';
COMMENT ON COLUMN public.sys_wf_prof_ver_policy_cf.conditional_routing_enabled IS
  'Whether this profile version permits configured conditional routing rules once those rules are available.';

COMMIT;
