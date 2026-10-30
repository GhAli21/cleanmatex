-- ============================================================
-- Migration: 0651_hq_ff_eff_values_set.sql
-- Purpose:   Set-based feature-flag batch evaluation. The current
--            hq_ff_get_effective_values_batch loops over every requested key
--            (302 active flags when keys are omitted) and calls
--            hq_ff_get_effective_value once per key, each in its own
--            exception subtransaction. Measured 159 ms mean over 3,154 calls.
--            This adds a single-query equivalent. Additive only: the batch
--            function is rewired in a follow-up migration after an
--            old-vs-new equivalence check.
-- Semantics: identical to hq_ff_get_effective_value per key:
--            unknown/inactive flag -> false;
--            active approved override within its effective window -> override value;
--            plan_bound flag with a plan_specific_value mapping for the tenant's
--            current trial/active subscription -> that value;
--            otherwise -> flag default_value.
--            (The legacy enabled_plan_codes branch also returns default_value,
--            so it needs no separate case.)
-- Affected:  hq_ff_get_eff_values_set (new)
-- Related:   0158 (hq_ff_get_effective_values_batch), 0159
-- ============================================================

-- Returns {flag_key: effective_value} for a tenant in one query.
-- p_flag_keys NULL or empty = every active flag. SECURITY DEFINER with a
-- pinned search_path, matching hq_ff_get_effective_values_batch (it reads HQ
-- flag catalogs that tenant roles cannot read directly). Every org_* read
-- filters tenant_org_id = p_tenant_id explicitly.
CREATE OR REPLACE FUNCTION public.hq_ff_get_eff_values_set(
  p_tenant_id UUID,
  p_flag_keys TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  WITH keys AS (
    SELECT DISTINCT k.flag_key
    FROM unnest(
      CASE WHEN p_flag_keys IS NULL OR array_length(p_flag_keys, 1) IS NULL
           THEN ARRAY(SELECT f.flag_key FROM public.hq_ff_feature_flags_mst f WHERE f.is_active = true)
           ELSE p_flag_keys
      END
    ) AS k(flag_key)
    WHERE k.flag_key IS NOT NULL
  ),
  sub AS (
    -- Tenant's current subscription, read once (was once per plan_bound flag).
    SELECT s.plan_code
    FROM public.org_pln_subscriptions_mst s
    WHERE s.tenant_org_id = p_tenant_id
      AND s.is_active = true
      AND s.status IN ('trial', 'active')
    ORDER BY s.created_at DESC
    LIMIT 1
  )
  SELECT COALESCE(
    jsonb_object_agg(
      k.flag_key,
      CASE
        WHEN f.flag_key IS NULL THEN to_jsonb(false)
        WHEN ov.found THEN ov.override_value
        WHEN f.plan_binding_type = 'plan_bound' AND m.plan_specific_value IS NOT NULL THEN m.plan_specific_value
        ELSE f.default_value
      END
    ),
    '{}'::JSONB
  )
  FROM keys k
  LEFT JOIN public.hq_ff_feature_flags_mst f
         ON f.flag_key = k.flag_key AND f.is_active = true
  LEFT JOIN LATERAL (
    SELECT true AS found, o.override_value
    FROM public.org_ff_overrides_cf o
    WHERE o.tenant_org_id = p_tenant_id
      AND o.flag_key = k.flag_key
      AND o.is_active = true
      AND o.approval_status = 'approved'
      AND (o.effective_from IS NULL OR o.effective_from <= CURRENT_TIMESTAMP)
      AND (o.effective_until IS NULL OR o.effective_until >= CURRENT_TIMESTAMP)
    ORDER BY o.created_at DESC
    LIMIT 1
  ) ov ON true
  LEFT JOIN sub ON true
  LEFT JOIN public.sys_ff_pln_flag_mappings_dtl m
         ON m.plan_code = sub.plan_code
        AND m.flag_key = k.flag_key
        AND m.is_enabled = true
        AND m.is_active = true;
$function$;

COMMENT ON FUNCTION public.hq_ff_get_eff_values_set(UUID, TEXT[]) IS
  'Set-based effective feature-flag values for a tenant ({flag_key: value}); same rules as hq_ff_get_effective_value. NULL/empty keys = all active flags. 0651.';

-- Grants: server-only. The function is SECURITY DEFINER and takes p_tenant_id
-- from the caller, so browser and customer sessions (anon/authenticated) must not
-- call it, or they could read any tenant's flags. web-admin evaluates flags in
-- server code (lib/services/feature-flags.service.ts) with the service-role client.
REVOKE EXECUTE ON FUNCTION public.hq_ff_get_eff_values_set(UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hq_ff_get_eff_values_set(UUID, TEXT[]) TO service_role;
