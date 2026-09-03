-- ============================================================
-- Migration: 0487_wf_live_rpt_create_presets.sql
-- Purpose:   Structural write-lock subset for create presets.
--            live_rpt reports missing/unknown create_preset_code and
--            all-null matcher + draft (wildcard draft). HQ Check
--            policy maps EN/AR; this function stays locator-only.
-- Affected:  sys_wf_prof_ver_live_rpt
-- Related:   0479, 0480, 0481, 04_CREATE_HYDRATION_COLLECTION_HOLD_PLAN.md §5
-- ============================================================
-- Do not edit applied 0470–0486. Agents never apply this migration.
-- ROLLBACK: restore sys_wf_prof_ver_live_rpt from 0479.

BEGIN;

CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_live_rpt(
  p_version_id UUID
)
RETURNS TABLE (
  issue_code TEXT,
  issue_path TEXT,
  exec_id UUID,
  screen_key TEXT,
  action_code TEXT,
  from_status TEXT,
  to_status TEXT,
  owner_screen TEXT,
  rule_code TEXT,
  init_status TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Codes must match HQ WF_LIVE_STRUCTURAL_ISSUE_CODES exactly (DB-mirror).

  RETURN QUERY
  SELECT
    'profile_policy_missing'::TEXT,
    'policy'::TEXT,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_policy_cf
    WHERE version_id = p_version_id
      AND is_active = true
      AND rec_status = 1
  );

  RETURN QUERY
  SELECT
    'initial_rule_missing'::TEXT,
    'initial_rules'::TEXT,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_init_cf
    WHERE version_id = p_version_id
      AND is_active = true
      AND rec_status = 1
  );

  RETURN QUERY
  SELECT
    'profile_no_primary_owner_module'::TEXT,
    'modules'::TEXT,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_module_cf
    WHERE version_id = p_version_id
      AND module_mode = 'primary_owner'
      AND is_enabled = true
      AND is_active = true
      AND rec_status = 1
  );

  RETURN QUERY
  SELECT
    'execution_without_channel'::TEXT,
    'executions.' || executable.exec_id::TEXT,
    executable.exec_id,
    executable.screen_key,
    executable.action_code,
    executable.from_status,
    executable.to_status,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
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
    );

  RETURN QUERY
  SELECT
    'confirm_pickup_not_on_pickup_handover'::TEXT,
    'executions.' || executable.exec_id::TEXT,
    executable.exec_id,
    executable.screen_key,
    executable.action_code,
    executable.from_status,
    executable.to_status,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  FROM public.sys_wf_prof_ver_exec_cf AS executable
  WHERE executable.version_id = p_version_id
    AND executable.is_active = true
    AND executable.rec_status = 1
    AND executable.action_code = 'CONFIRM_PICKUP'
    AND executable.screen_key <> 'pickup_handover';

  -- Ordinary executables need owner visibility on the executing module.
  -- Platform observer-execute exceptions come from sys_wf_observer_exec_x_cd
  -- (migration-seeded only). Workboard module_mode=observer still cannot execute.
  RETURN QUERY
  SELECT
    'execution_not_from_status_owner'::TEXT,
    'executions.' || executable.exec_id::TEXT,
    executable.exec_id,
    executable.screen_key,
    executable.action_code,
    executable.from_status,
    executable.to_status,
    (
      SELECT owner_module.screen_key
      FROM public.sys_wf_prof_ver_module_cf AS owner_module
      INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS owned
        ON owned.version_id = owner_module.version_id
       AND owned.screen_key = owner_module.screen_key
      WHERE owner_module.version_id = executable.version_id
        AND owner_module.module_mode = 'primary_owner'
        AND owner_module.is_enabled = true
        AND owner_module.is_active = true
        AND owner_module.rec_status = 1
        AND owned.status_code = executable.from_status
        AND owned.visibility_mode = 'owner'
        AND owned.is_active = true
        AND owned.rec_status = 1
      ORDER BY owner_module.display_order
      LIMIT 1
    ),
    NULL::TEXT,
    NULL::TEXT
  FROM public.sys_wf_prof_ver_exec_cf AS executable
  WHERE executable.version_id = p_version_id
    AND executable.is_active = true
    AND executable.rec_status = 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.sys_wf_observer_exec_x_cd AS exception_row
      WHERE exception_row.is_active = true
        AND exception_row.rec_status = 1
        AND exception_row.screen_key = executable.screen_key
        AND exception_row.action_code = executable.action_code
        AND exception_row.from_status = executable.from_status
        AND exception_row.to_status = executable.to_status
        AND (
          exception_row.required_channel_code IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.sys_wf_prof_ver_exec_ch_cf AS required_channel
            WHERE required_channel.exec_id = executable.exec_id
              AND required_channel.channel_code = exception_row.required_channel_code
              AND required_channel.is_active = true
              AND required_channel.rec_status = 1
          )
        )
        AND EXISTS (
          SELECT 1
          FROM public.sys_wf_prof_ver_module_cf AS exec_module
          INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS observed
            ON observed.version_id = exec_module.version_id
           AND observed.screen_key = exec_module.screen_key
          WHERE exec_module.version_id = executable.version_id
            AND exec_module.screen_key = exception_row.screen_key
            AND exec_module.module_mode = exception_row.exec_module_mode
            AND exec_module.is_enabled = true
            AND exec_module.is_active = true
            AND exec_module.rec_status = 1
            AND observed.status_code = exception_row.from_status
            AND observed.visibility_mode = 'observer'
            AND observed.is_active = true
            AND observed.rec_status = 1
        )
        AND EXISTS (
          SELECT 1
          FROM public.sys_wf_prof_ver_module_cf AS owner_module
          INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS owned
            ON owned.version_id = owner_module.version_id
           AND owned.screen_key = owner_module.screen_key
          WHERE owner_module.version_id = executable.version_id
            AND owner_module.screen_key = exception_row.owner_screen_key
            AND owner_module.module_mode = 'primary_owner'
            AND owner_module.is_enabled = true
            AND owner_module.is_active = true
            AND owner_module.rec_status = 1
            AND owned.status_code = exception_row.from_status
            AND owned.visibility_mode = 'owner'
            AND owned.is_active = true
            AND owned.rec_status = 1
        )
    )
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
    );

  RETURN QUERY
  SELECT
    'initial_rule_status_without_owner'::TEXT,
    'initial_rules.' || initial_rule.rule_code,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    initial_rule.rule_code,
    initial_rule.initial_status
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
    );

  -- Active Initial rules must name a create preset (0480 column).
  RETURN QUERY
  SELECT
    'initial_rule_preset_missing'::TEXT,
    'initial_rules.' || initial_rule.rule_code,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    initial_rule.rule_code,
    initial_rule.initial_status
  FROM public.sys_wf_prof_ver_init_cf AS initial_rule
  WHERE initial_rule.version_id = p_version_id
    AND initial_rule.is_active = true
    AND initial_rule.rec_status = 1
    AND NULLIF(BTRIM(COALESCE(initial_rule.create_preset_code, '')), '') IS NULL;

  -- Named preset must exist and stay active in the platform catalog.
  RETURN QUERY
  SELECT
    'initial_rule_preset_unknown'::TEXT,
    'initial_rules.' || initial_rule.rule_code,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    initial_rule.rule_code,
    initial_rule.initial_status
  FROM public.sys_wf_prof_ver_init_cf AS initial_rule
  WHERE initial_rule.version_id = p_version_id
    AND initial_rule.is_active = true
    AND initial_rule.rec_status = 1
    AND NULLIF(BTRIM(COALESCE(initial_rule.create_preset_code, '')), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.sys_wf_create_presets_cd AS preset
      WHERE preset.create_preset_code = initial_rule.create_preset_code
        AND preset.is_active = true
        AND preset.rec_status = 1
    );

  -- All-null matchers + draft is the historic INIT_ONLINE_DRAFT wildcard bug.
  RETURN QUERY
  SELECT
    'initial_rule_wildcard_draft'::TEXT,
    'initial_rules.' || initial_rule.rule_code,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    initial_rule.rule_code,
    initial_rule.initial_status
  FROM public.sys_wf_prof_ver_init_cf AS initial_rule
  WHERE initial_rule.version_id = p_version_id
    AND initial_rule.is_active = true
    AND initial_rule.rec_status = 1
    AND initial_rule.initial_status = 'draft'
    AND NULLIF(BTRIM(COALESCE(initial_rule.order_source_code, '')), '') IS NULL
    AND NULLIF(BTRIM(COALESCE(initial_rule.order_type_id, '')), '') IS NULL
    AND initial_rule.is_retail IS NULL
    AND initial_rule.is_quick_drop IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_live_rpt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sys_wf_prof_ver_live_rpt(UUID) TO service_role;

COMMENT ON FUNCTION public.sys_wf_prof_ver_live_rpt(UUID) IS
  'Structural completeness report for one profile version. Returns catalog issue_code rows with locators and no EN/AR. HQ Check policy maps the rows; sys_wf_prof_ver_validate_live fails closed when any row exists. Create-preset missing/unknown and wildcard-draft rules are included. Observer-execute exceptions come from sys_wf_observer_exec_x_cd (migration-seeded). Not a runtime policy resolver.';

COMMIT;
