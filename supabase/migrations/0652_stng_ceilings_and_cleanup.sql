-- ============================================================
-- Migration: 0652_stng_ceilings_and_cleanup.sql
-- Purpose:   (1) Entitlement ceilings (owner decision 2026-10-28): plan
--                constraints and feature flags are applied LAST, as caps on the
--                final value, so tenant/branch/user overrides can no longer
--                bypass them. A disabled flag or plan deny forces the setting's
--                *disabled value*, not its default (a default of true used to keep
--                a feature "on" with its flag off).
--            (2) Deactivate 24 catalog settings that nothing reads (no web-admin,
--                cmx-api, HQ or SQL-function consumer, verified 2026-10-28).
--                Their screens were toggles with no effect, and the resolver
--                evaluated them on every call. Rows, profile values and overrides
--                are kept (is_active=false) so any one can be reactivated.
--            (3) Deactivate the 15 plan constraints: every one targets a setting
--                code that does not exist in the catalog (dead config).
--                The table stays for real constraints under the new ceiling rules.
-- Verify:    resolver fingerprint over the 17 kept settings x 7 contexts must stay
--            27355a0ff472c357315a3e004b87182a (captured before this migration).
-- Affected:  sys_tenant_settings_cd (new column, 24 rows deactivated),
--            sys_plan_setting_constraints (15 rows deactivated),
--            fn_stng_resolve_settings_set (fold order)
-- Related:   0647/0648 (set-based resolver)
-- Docs:      docs/features/Order_Fin/Performance_Enhance/Settings_Entitlement_Precedence_Recommendation.md
-- ============================================================

-- ------------------------------------------------------------
-- (1a) Disabled value per setting
-- ------------------------------------------------------------
ALTER TABLE public.sys_tenant_settings_cd
  ADD COLUMN IF NOT EXISTS stng_disabled_value_jsonb JSONB;  -- Value forced when a required flag is off or the plan denies the setting; NULL = boolean false / otherwise the catalog default

COMMENT ON COLUMN public.sys_tenant_settings_cd.stng_disabled_value_jsonb IS
  'Value the resolver forces when a required feature flag is off or the tenant plan denies this setting. NULL = false for boolean defaults, otherwise stng_default_value_jsonb. 0652.';

-- ------------------------------------------------------------
-- (2) Deactivate unused settings. updated_* records why; nothing is deleted.
-- ------------------------------------------------------------
UPDATE public.sys_tenant_settings_cd
SET is_active    = false,
    updated_at   = CURRENT_TIMESTAMP,
    updated_by   = 'migration_0652',
    updated_info = 'Deactivated: no consumer in web-admin, cmx-api, HQ or SQL functions (2026-10-28 audit). Reactivate with is_active=true when a feature reads it.'
WHERE setting_code IN (
  'AUTO_CLOSE_DAYS', 'B2B_CONTRACTS_ENABLED', 'ERP_LITE_ENABLED', 'ERP_LITE_FIRST_PERIOD_START',
  'ERP_LITE_FISCAL_YEAR_START', 'ERP_LITE_PERIOD_CLOSE_ENABLED', 'ORD_ALLOW_BACKWARD_TRANSITIONS',
  'ORD_QUICK_DROP_ENABLED', 'ORD_READY_BY_REQUIRED', 'PEAK_SEASON_START', 'SERVICE_PREF_ALLOW_NOTES',
  'SERVICE_PREF_BUNDLES_SHOW_SAVINGS', 'SERVICE_PREF_DEFAULT_PACKING', 'SERVICE_PREF_REQUIRE_CONFIRMATION',
  'SERVICE_PREF_SHOW_PRICE_ON_COUNTER', 'SYS_TIMEZONE', 'TENANT_DATE_FORMAT', 'TENANT_FIRST_DAY_OF_WEEK',
  'TENANT_LANGUAGE', 'TENANT_LOCALE', 'TENANT_TIME_FORMAT', 'UI_RTL_ENABLED', 'WF_TEMPLATE_DEFAULT',
  'TENANT_VAT_ENABLED'
)
AND is_active = true;

-- ------------------------------------------------------------
-- (3) Deactivate plan constraints that target non-existent settings.
-- ------------------------------------------------------------
UPDATE public.sys_plan_setting_constraints c
SET is_active    = false,
    updated_at   = CURRENT_TIMESTAMP,
    updated_by   = 'migration_0652',
    updated_info = 'Deactivated: stng_code not in sys_tenant_settings_cd (dead config, 2026-10-28 audit).'
WHERE c.is_active = true
  AND NOT EXISTS (SELECT 1 FROM public.sys_tenant_settings_cd s WHERE s.setting_code = c.stng_code);

-- ------------------------------------------------------------
-- (1b) Resolver with ceilings.
-- Fold: configured value = best non-null of default(100) < profile(200+) <
--       tenant(500) < branch(600) < user(700) override; then ceilings in order:
--       PLAN_CONSTRAINT (deny -> disabled value; max/min clamp the FINAL value),
--       then FEATURE_FLAG (any required flag off -> disabled value).
--       A ceiling that applies is reported as the source layer, so the UI can say
--       "limited by your plan".
-- Output contract unchanged (same columns, per-setting ERROR_AT rows).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_stng_resolve_settings_set(
  p_tenant_id     UUID,
  p_branch_id     UUID   DEFAULT NULL,
  p_user_id       UUID   DEFAULT NULL,
  p_setting_codes TEXT[] DEFAULT NULL  -- NULL = every active catalog setting
)
RETURNS TABLE(
  stng_code         TEXT,
  stng_value_jsonb  JSONB,
  stng_source_layer TEXT,
  stng_source_id    TEXT,
  stng_computed_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $function$
#variable_conflict use_column
DECLARE
  v_now          TIMESTAMPTZ := CURRENT_TIMESTAMP;
  v_profile_code TEXT;
  v_tenant_plan  TEXT;
  v_plan_code    TEXT;
  v_chain        TEXT[] := ARRAY[]::TEXT[];
  v_chain_len    INTEGER;
  v_chain_err    TEXT;
  v_chain_state  TEXT;
  v_flag_cache   JSONB := '{}'::JSONB;  -- flag_key -> true when disabled
  v_flag_key     TEXT;
  v_flag_value   JSONB;
  v_disabled     BOOLEAN;
  v_off_value    JSONB;
  r              RECORD;
  -- Metadata of the last layer that had a row (used when no non-null value wins)
  v_layer        TEXT;
  v_src          TEXT;
  -- Best non-null configured candidate
  b_val          JSONB;
  b_layer        TEXT;
  b_src          TEXT;
  b_prio         INTEGER;
  -- Set when a ceiling decided the value (it is returned even if NULL)
  v_capped       BOOLEAN;
BEGIN
  -- Tenant context: read once. org_tenants_mst is the tenant root; id = tenant id.
  SELECT t.stng_profile_code, t.s_current_plan
    INTO v_profile_code, v_tenant_plan
  FROM public.org_tenants_mst t
  WHERE t.id = p_tenant_id AND t.is_active = true;

  SELECT COALESCE(
    (SELECT s.plan_code
       FROM public.org_pln_subscriptions_mst s
      WHERE s.tenant_org_id = p_tenant_id
        AND s.is_active = true
        AND s.status IN ('trial', 'active')
      ORDER BY s.created_at DESC
      LIMIT 1),
    v_tenant_plan,
    'FREE_TRIAL'
  ) INTO v_plan_code;

  -- Profile chain is leaf-first: chain[1] = tenant's own profile (highest profile priority).
  IF v_profile_code IS NOT NULL THEN
    BEGIN
      v_chain := public.fn_stng_get_profile_chain(v_profile_code);
    EXCEPTION WHEN OTHERS THEN
      v_chain_err   := SQLERRM;
      v_chain_state := SQLSTATE;
    END;
  END IF;
  v_chain_len := COALESCE(array_length(v_chain, 1), 0);

  FOR r IN
    WITH cat AS (
      SELECT c.setting_code,
             COALESCE(c.stng_is_required, false) AS is_required,
             COALESCE(c.stng_allows_null, true)  AS allows_null,
             c.stng_default_value_jsonb          AS default_value,
             -- Disabled value: explicit, else false for boolean settings, else the default.
             COALESCE(c.stng_disabled_value_jsonb,
                      CASE WHEN jsonb_typeof(c.stng_default_value_jsonb) = 'boolean'
                           THEN 'false'::JSONB ELSE c.stng_default_value_jsonb END) AS off_value,
             CASE jsonb_typeof(c.stng_depends_on_flags)
               WHEN 'array'  THEN c.stng_depends_on_flags
               WHEN 'object' THEN CASE WHEN jsonb_typeof(c.stng_depends_on_flags -> 'required_flags') = 'array'
                                       THEN c.stng_depends_on_flags -> 'required_flags' END
             END AS deps,
             jsonb_typeof(c.stng_depends_on_flags) IS NOT NULL
               AND jsonb_typeof(c.stng_depends_on_flags) <> 'null'
               AND NOT (jsonb_typeof(c.stng_depends_on_flags) = 'array'
                        OR COALESCE(jsonb_typeof(c.stng_depends_on_flags -> 'required_flags') = 'array', false)) AS deps_invalid
      FROM public.sys_tenant_settings_cd c
      WHERE c.is_active = true
        AND (p_setting_codes IS NULL OR c.setting_code = ANY (p_setting_codes))
    ),
    prof AS (
      SELECT pv.stng_code, ch.ord::INTEGER AS ord, ch.code, pv.stng_value_jsonb AS val
      FROM unnest(v_chain) WITH ORDINALITY AS ch(code, ord)
      JOIN public.sys_stng_profile_values_dtl pv
        ON pv.stng_profile_code = ch.code
       AND pv.is_active = true
      WHERE pv.stng_code IN (SELECT cat.setting_code FROM cat)
    ),
    ovr AS (
      -- Single tenant-scoped read of every override that can apply to this context.
      SELECT o.setting_code, o.branch_id, o.user_id, o.value_jsonb, o.updated_at, o.created_at
      FROM public.org_tenant_settings_cf o
      WHERE o.tenant_org_id = p_tenant_id
        AND o.is_active = true
        AND o.setting_code IN (SELECT cat.setting_code FROM cat)
        AND (   (o.branch_id IS NULL AND o.user_id IS NULL)
             OR (o.user_id IS NULL AND o.branch_id = p_branch_id)
             OR  o.user_id = p_user_id)
    ),
    cons AS (
      -- (plan_code, stng_code, constraint_type) is unique, so each type yields at most one value.
      SELECT pc.stng_code,
             bool_or(pc.constraint_type = 'deny') AS has_deny,
             (array_agg(pc.constraint_value) FILTER (WHERE pc.constraint_type = 'max_value'))[1] AS max_value,
             (array_agg(pc.constraint_value) FILTER (WHERE pc.constraint_type = 'min_value'))[1] AS min_value
      FROM public.sys_plan_setting_constraints pc
      WHERE pc.plan_code = v_plan_code
        AND pc.is_active = true
        AND pc.stng_code IN (SELECT cat.setting_code FROM cat)
      GROUP BY pc.stng_code
    )
    SELECT cat.*,
           pf.code AS prof_found_code,
           pb.code AS prof_best_code, pb.ord AS prof_best_ord, pb.val AS prof_best_val,
           COALESCE(cons.has_deny, false) AS has_deny, cons.max_value, cons.min_value,
           ot.found AS t_found, ot.value_jsonb AS t_val,
           ob.found AS b_found, ob.value_jsonb AS b_val,
           ou.found AS u_found, ou.value_jsonb AS u_val
    FROM cat
    LEFT JOIN LATERAL (SELECT p.code FROM prof p WHERE p.stng_code = cat.setting_code
                       ORDER BY p.ord LIMIT 1) pf ON true
    LEFT JOIN LATERAL (SELECT p.code, p.ord, p.val FROM prof p WHERE p.stng_code = cat.setting_code
                         AND p.val IS NOT NULL ORDER BY p.ord LIMIT 1) pb ON true
    LEFT JOIN cons ON cons.stng_code = cat.setting_code
    LEFT JOIN LATERAL (SELECT true AS found, o.value_jsonb FROM ovr o
                        WHERE o.setting_code = cat.setting_code AND o.branch_id IS NULL AND o.user_id IS NULL
                        ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST LIMIT 1) ot ON true
    LEFT JOIN LATERAL (SELECT true AS found, o.value_jsonb FROM ovr o
                        WHERE p_branch_id IS NOT NULL AND o.setting_code = cat.setting_code
                          AND o.branch_id = p_branch_id AND o.user_id IS NULL
                        ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST LIMIT 1) ob ON true
    LEFT JOIN LATERAL (SELECT true AS found, o.value_jsonb FROM ovr o
                        WHERE p_user_id IS NOT NULL AND o.setting_code = cat.setting_code
                          AND o.user_id = p_user_id
                        ORDER BY (o.branch_id IS NOT DISTINCT FROM p_branch_id) DESC, (o.branch_id IS NULL) DESC,
                                 o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST LIMIT 1) ou ON true
    ORDER BY cat.setting_code
  LOOP
    stng_code        := r.setting_code;
    stng_computed_at := v_now;

    IF v_chain_err IS NOT NULL THEN
      stng_value_jsonb  := jsonb_build_object('error', v_chain_err, 'detail', v_chain_state);
      stng_source_layer := 'ERROR_AT: Looking up Profile for Tenant ' || p_tenant_id;
      stng_source_id    := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF r.deps_invalid THEN
      stng_value_jsonb  := jsonb_build_object('error', 'Invalid stng_depends_on_flags shape (expected array or {"required_flags": [...]})', 'detail', '22023');
      stng_source_layer := 'ERROR_AT: Checking Feature Flag for ' || r.setting_code;
      stng_source_id    := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- ---- Configured value: default < profile < tenant < branch < user ----
    v_layer := 'SYSTEM_DEFAULT';
    v_src   := 'CATALOG';
    b_val := NULL; b_layer := NULL; b_src := NULL; b_prio := 0;
    v_capped := false;
    IF r.default_value IS NOT NULL THEN
      b_val := r.default_value; b_layer := 'SYSTEM_DEFAULT'; b_src := 'CATALOG'; b_prio := 100;
    END IF;

    IF r.prof_found_code IS NOT NULL THEN
      v_layer := 'SYSTEM_PROFILE';
      v_src   := r.prof_found_code;
    END IF;
    IF r.prof_best_val IS NOT NULL AND 200 + (v_chain_len - r.prof_best_ord + 1) * 10 > b_prio THEN
      b_val := r.prof_best_val; b_layer := 'SYSTEM_PROFILE'; b_src := r.prof_best_code;
      b_prio := 200 + (v_chain_len - r.prof_best_ord + 1) * 10;
    END IF;

    IF r.t_found THEN
      v_layer := 'TENANT_OVERRIDE'; v_src := p_tenant_id::TEXT;
      IF r.t_val IS NOT NULL AND 500 > b_prio THEN
        b_val := r.t_val; b_layer := 'TENANT_OVERRIDE'; b_src := p_tenant_id::TEXT; b_prio := 500;
      END IF;
    END IF;

    IF r.b_found THEN
      v_layer := 'BRANCH_OVERRIDE'; v_src := p_branch_id::TEXT;
      IF r.b_val IS NOT NULL AND 600 > b_prio THEN
        b_val := r.b_val; b_layer := 'BRANCH_OVERRIDE'; b_src := p_branch_id::TEXT; b_prio := 600;
      END IF;
    END IF;

    IF r.u_found THEN
      v_layer := 'USER_OVERRIDE'; v_src := p_user_id::TEXT;
      IF r.u_val IS NOT NULL AND 700 > b_prio THEN
        b_val := r.u_val; b_layer := 'USER_OVERRIDE'; b_src := p_user_id::TEXT; b_prio := 700;
      END IF;
    END IF;

    -- ---- Ceiling 1: PLAN_CONSTRAINT (non-numeric values are not clamped) ----
    IF r.has_deny THEN
      b_val := r.off_value; b_layer := 'PLAN_CONSTRAINT'; b_src := v_plan_code; v_capped := true;
    ELSE
      IF r.max_value IS NOT NULL AND b_val IS NOT NULL THEN
        IF COALESCE(pg_input_is_valid(b_val #>> '{}', 'numeric'), false)
           AND COALESCE(pg_input_is_valid(r.max_value #>> '{}', 'numeric'), false) THEN
          IF (b_val #>> '{}')::NUMERIC > (r.max_value #>> '{}')::NUMERIC THEN
            b_val := r.max_value; b_layer := 'PLAN_CONSTRAINT'; b_src := v_plan_code; v_capped := true;
          END IF;
        END IF;
      END IF;
      IF r.min_value IS NOT NULL AND b_val IS NOT NULL THEN
        IF COALESCE(pg_input_is_valid(b_val #>> '{}', 'numeric'), false)
           AND COALESCE(pg_input_is_valid(r.min_value #>> '{}', 'numeric'), false) THEN
          IF (b_val #>> '{}')::NUMERIC < (r.min_value #>> '{}')::NUMERIC THEN
            b_val := r.min_value; b_layer := 'PLAN_CONSTRAINT'; b_src := v_plan_code; v_capped := true;
          END IF;
        END IF;
      END IF;
    END IF;

    -- ---- Ceiling 2: FEATURE_FLAG (each distinct flag evaluated once per call; lookup failure = off) ----
    IF r.deps IS NOT NULL THEN
      v_disabled := false;
      FOR v_flag_key IN SELECT jsonb_array_elements_text(r.deps) LOOP
        IF NOT (v_flag_cache ? v_flag_key) THEN
          BEGIN
            SELECT f.value INTO v_flag_value
            FROM public.hq_ff_get_effective_value(p_tenant_id, v_flag_key) f
            LIMIT 1;
          EXCEPTION WHEN OTHERS THEN
            v_flag_value := 'false'::JSONB;
          END;
          v_flag_cache := v_flag_cache || jsonb_build_object(
            v_flag_key,
            v_flag_value IS NULL OR v_flag_value IN ('false'::JSONB, '0'::JSONB, '""'::JSONB, 'null'::JSONB)
          );
        END IF;
        IF (v_flag_cache ->> v_flag_key)::BOOLEAN THEN
          v_disabled := true;
          EXIT;
        END IF;
      END LOOP;
      IF v_disabled THEN
        b_val := r.off_value; b_layer := 'FEATURE_FLAG'; b_src := 'DISABLED'; v_capped := true;
      END IF;
    END IF;

    -- ---- Output and required/null validation ----
    IF b_val IS NOT NULL THEN
      stng_value_jsonb := b_val; stng_source_layer := b_layer; stng_source_id := b_src;
    ELSIF r.is_required AND NOT r.allows_null THEN
      stng_value_jsonb := jsonb_build_object(
        'error', 'Required setting "' || r.setting_code || '" has no non-null value at any layer (tenant: '
                 || COALESCE(p_tenant_id::TEXT, '<NULL>') || ', branch: ' || COALESCE(p_branch_id::TEXT, '<NULL>')
                 || ', user: ' || COALESCE(p_user_id::TEXT, '<NULL>') || ')',
        'detail', 'P0001');
      stng_source_layer := 'ERROR_AT: Validating Required/Null constraints for ' || r.setting_code;
      stng_source_id    := NULL;
    ELSIF v_capped THEN
      -- A ceiling forced NULL: attribute it to the ceiling.
      stng_value_jsonb := NULL; stng_source_layer := b_layer; stng_source_id := b_src;
    ELSE
      -- No non-null value anywhere: NULL value, attributed to the last layer that had a row.
      stng_value_jsonb := NULL; stng_source_layer := v_layer; stng_source_id := v_src;
    END IF;

    RETURN NEXT;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.fn_stng_resolve_settings_set(UUID, UUID, UUID, TEXT[]) IS
  'Set-based settings resolver. Configured value = best of default, profile chain, tenant/branch/user override; then ceilings: plan constraint (deny -> disabled value, max/min clamp final value), then feature flag (off -> disabled value). Reads each source once. 0652.';

-- ------------------------------------------------------------
-- Assertions
-- ------------------------------------------------------------
DO $verify$
DECLARE v INTEGER;
BEGIN
  SELECT count(*) INTO v FROM public.sys_tenant_settings_cd WHERE is_active = true;
  IF v <> 17 THEN
    RAISE NOTICE '0652: % active settings (17 expected on remote as of 2026-10-28; local may differ)', v;
  END IF;

  SELECT count(*) INTO v FROM public.sys_plan_setting_constraints c
  WHERE c.is_active = true AND NOT EXISTS (SELECT 1 FROM public.sys_tenant_settings_cd s WHERE s.setting_code = c.stng_code);
  IF v > 0 THEN RAISE EXCEPTION '0652: % active plan constraints still target unknown settings', v; END IF;
END
$verify$;
