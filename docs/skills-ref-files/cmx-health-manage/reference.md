# Setup Health — Shared Reference (`cmx-health-manage`)

Single-source reference for the `cmx-health-manage` skill across Antigravity, Codex, Claude Code, and Cursor.

---

## 1. SQL Migration Template — Add a Setup Health Check

Pick the next migration sequence from `supabase/migrations/` (`last_seq + 1`), name it `{seq}_setup_health_<descriptive_snake_case>.sql`, and **never apply it yourself** (STOP and ask the user to review/apply).

```sql
-- =============================================================================
-- Migration: {SEQ}_setup_health_<short_name>.sql
-- Purpose:   Add Setup Health check <CHECK_CODE> (<short explanation of what it
--            detects and why it matters>).
-- Affected:  fn_shc_<name> (new), sys_setup_health_check_cd (<CHECK_CODE>).
-- Related:   0709 (registry, guard, dispatcher), 0738 (registry v2: ok_name,
--            ok_name2, feature_flag_keys, fn_setup_health_run check list),
--            0831 (fn_ops_zone timezone rule).
-- Contract:  fn_shc_<check>(uuid, uuid) -> jsonb, read-only, SECURITY INVOKER,
--            fn_shc_guard_tenant first, every org_* read filters tenant_org_id.
--
-- Rollback (forward-only, manual):
--   DELETE FROM public.sys_setup_health_check_cd WHERE check_code = '<CHECK_CODE>';
--   DROP FUNCTION public.fn_shc_<name>(UUID, UUID) RESTRICT;
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Check function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_shc_<name>(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_tz         TEXT;
  v_today      DATE;
  v_bad_count  INTEGER := 0;
  v_samples    JSONB := '[]'::jsonb;
BEGIN
  -- Mandatory first line: blocks cross-tenant end-user JWT calls (SQLSTATE 42501).
  PERFORM public.fn_shc_guard_tenant(p_tenant);

  -- Only needed if the check evaluates "today" / local business date:
  -- Never silently fall back to UTC; report TIMEZONE_NOT_CONFIGURED instead (0831).
  v_tz := public.fn_ops_zone(p_tenant, 'accept_order', p_branch);
  IF v_tz IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'FAIL',
      'count', 1,
      'sample_ids', '[]'::jsonb,
      'details', jsonb_build_object('reason', 'TIMEZONE_NOT_CONFIGURED')
    );
  END IF;
  v_today := (pg_catalog.now() AT TIME ZONE v_tz)::date;

  -- Every org_* read MUST explicitly filter tenant_org_id = p_tenant.
  -- Cap sample_ids to at most 5 entries.
  SELECT count(*)::INTEGER,
         COALESCE(
           (SELECT jsonb_agg(s.id) FROM (
              SELECT r.id
              FROM public.org_<target_table> r
              WHERE r.tenant_org_id = p_tenant
                AND r.is_active IS TRUE
                AND r.rec_status = 1
                AND (p_branch IS NULL OR r.branch_id = p_branch)
                -- <failing predicate>
              ORDER BY r.id
              LIMIT 5
            ) s),
           '[]'::jsonb
         )
  INTO v_bad_count, v_samples
  FROM public.org_<target_table> r
  WHERE r.tenant_org_id = p_tenant
    AND r.is_active IS TRUE
    AND r.rec_status = 1
    AND (p_branch IS NULL OR r.branch_id = p_branch);
    -- <failing predicate>

  RETURN jsonb_build_object(
    'status',     CASE WHEN v_bad_count = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      v_bad_count,
    'sample_ids', v_samples,
    'details',    jsonb_build_object('evaluated_date', v_today)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_shc_<name>(UUID, UUID) IS
  'Setup Health <CHECK_CODE>: FAIL when <condition>; OK when <condition>; NA when <condition or omit>. Tenant-filtered, read-only.';

REVOKE ALL ON FUNCTION public.fn_shc_<name>(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_<name>(UUID, UUID) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. Registry row (idempotent; Registry v2 requires ok_name, ok_name2, feature_flag_keys)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_setup_health_check_cd (
  check_code, domain_code, severity,
  name, name2, ok_name, ok_name2,
  description, description2,
  fix_route, hq_fix_route, fix_permission, feature_flag_keys,
  shows_banner, is_hq_only, fn_name, display_order, created_by, created_info
)
VALUES (
  '<CHECK_CODE>', '<DOMAIN_CODE>', 'WARNING',
  '<English problem title>', '<Arabic problem title>',
  '<English passing title>', '<Arabic passing title>',
  '<English plain explanation of why it matters and how to fix>',
  '<Arabic plain explanation of why it matters and how to fix>',
  '/dashboard/<fix-path>', '/tenants/{tenantId}/<hq-fix-path>', '<resource:action>', '{}'::text[],
  FALSE, FALSE, 'fn_shc_<name>', 50, 'system_admin', '{SEQ} setup health <short_name>'
)
ON CONFLICT (check_code) DO UPDATE
SET domain_code       = EXCLUDED.domain_code,
    severity          = EXCLUDED.severity,
    name              = EXCLUDED.name,
    name2             = EXCLUDED.name2,
    ok_name           = EXCLUDED.ok_name,
    ok_name2          = EXCLUDED.ok_name2,
    description       = EXCLUDED.description,
    description2      = EXCLUDED.description2,
    fix_route         = EXCLUDED.fix_route,
    hq_fix_route      = EXCLUDED.hq_fix_route,
    fix_permission    = EXCLUDED.fix_permission,
    feature_flag_keys = EXCLUDED.feature_flag_keys,
    shows_banner      = EXCLUDED.shows_banner,
    is_hq_only        = EXCLUDED.is_hq_only,
    fn_name           = EXCLUDED.fn_name,
    display_order     = EXCLUDED.display_order,
    updated_at        = NOW(),
    updated_by        = 'system_admin',
    updated_info      = '{SEQ} setup health <short_name>';

-- -----------------------------------------------------------------------------
-- 3. Self-verification: every active tenant gets 1 row per active check, 0 ERROR
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_checks INTEGER;
  v_bad    RECORD;
BEGIN
  SELECT count(*) INTO v_checks
  FROM public.sys_setup_health_check_cd
  WHERE is_active AND rec_status = 1;

  FOR v_bad IN
    SELECT t.id, x.check_code, x.details
    FROM public.org_tenants_mst t
    CROSS JOIN LATERAL public.fn_setup_health_run(t.id, NULL::uuid, NULL::text, NULL::text[]) x
    WHERE t.is_active AND t.rec_status = 1 AND x.status = 'ERROR'
    LIMIT 1
  LOOP
    RAISE EXCEPTION '{SEQ}: check % returned ERROR for tenant %: %', v_bad.check_code, v_bad.id, v_bad.details;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.org_tenants_mst t
    WHERE t.is_active AND t.rec_status = 1
      AND (SELECT count(*) FROM public.fn_setup_health_run(t.id, NULL::uuid, NULL::text, NULL::text[])) <> v_checks
  ) THEN
    RAISE EXCEPTION '{SEQ}: a tenant did not get one row per active check';
  END IF;
END $$;

COMMIT;
```

---

## 2. Database Registry Constraints & Invariants

### `sys_setup_health_domain_cd`
| Constraint / Rule | Requirement |
|---|---|
| `pk_sys_shc_domain` | Primary key on `domain_code` (stable; never renamed) |
| `chk_shc_domain_code` | `domain_code ~ '^[A-Z][A-Z0-9_]*$'` |
| Bilingual labels | `name` (EN) and `name2` (AR) `NOT NULL` |
| Grants | `SELECT` for `authenticated`; `ALL` for `service_role`; revoked from `PUBLIC, anon` |

### `sys_setup_health_check_cd` (Registry v2 — migration `0738`)
| Constraint / Rule | Requirement |
|---|---|
| `pk_sys_shc_check` | Primary key on `check_code` (stable; never renamed) |
| `fk_shc_check_domain` | `domain_code` FK → `sys_setup_health_domain_cd(domain_code) ON DELETE RESTRICT` |
| `chk_shc_check_code` | `check_code ~ '^[A-Z][A-Z0-9_]*$'` |
| `chk_shc_severity` | `severity IN ('BLOCKER', 'WARNING', 'INFO')` |
| `chk_shc_fn_name` | `fn_name ~ '^fn_shc_[a-z0-9_]+$'` (dynamic `EXECUTE` safety) |
| `chk_shc_fix_perm` | `fix_permission IS NULL OR fix_permission ~ '^[a-z0-9_]+:([a-z0-9_]+|\*)$'` |
| `chk_shc_banner` | `NOT shows_banner OR (severity = 'BLOCKER' AND NOT is_hq_only)` |
| `chk_shc_ok_name` | `ok_name` and `ok_name2` `NOT NULL`, `btrim(...) <> ''` |
| `chk_shc_flag_keys` | `feature_flag_keys TEXT[] NOT NULL DEFAULT '{}'` with no `NULL` elements (old `feature_flag_key` column was dropped in `0738`) |
| `hq_fix_route` | Optional HQ path; literal `{tenantId}` is substituted by HQ |
| `fix_route` | Optional tenant path; `NULL` renders "contact support" in tenant UI |

### Stored Summary (`org_setup_health_sum_tr` — migrations `0717`, `0738`, `0801`)
- One row of counts per organization for the HQ tenant list only (`service_role` only; RLS enabled with no user policy).
- Written only by HQ (`fn_setup_health_refresh_sum(p_tenant)` on HQ Setup Health load, `fn_setup_health_run_bulk(..., p_store := true)` when `p_checks IS NULL`, and nightly `setup-health-refresh` at `02:15 UTC`).
- **Never** written by the tenant app (tenant app hides `is_hq_only` checks, so its counts differ from HQ).

---

## 3. Repository File Map

| Layer | Paths |
|---|---|
| Docs | `docs/features/Setup_Health/README.md`, `developer_guide.md`, `STATUS.md`, `PLAN.md`, `PLAN_2_RUN_SCOPE_AND_QA_FIXES.md`, `user_guide.md`, `QA_TEST_GUIDE.md` |
| Migrations | `supabase/migrations/0709_setup_health_registry.sql`, `0710_setup_health_perms_nav.sql`, `0716_setup_health_cal_holidays.sql`, `0717_setup_health_summary.sql`, `0724_setup_health_holidays_fix_route.sql`, `0726_tax_health_kit_updates.sql`, `0738_setup_health_registry_v2.sql`, `0739_setup_health_express_and_holiday_coverage.sql`, `0801_setup_health_refresh_set_state.sql`, `0831_doc_seq_and_setup_health_zone.sql` |
| Tenant constants & types | `web-admin/lib/constants/setup-health.ts`, `web-admin/lib/constants/permissions/setup-health-perm.ts`, `web-admin/lib/types/setup-health.ts` |
| Tenant service & API | `web-admin/lib/services/setup-health/setup-health.service.ts`, `web-admin/app/api/v1/setup-health/route.ts`, `web-admin/app/api/v1/setup-health/summary/route.ts` |
| Tenant UI & access | `web-admin/app/dashboard/setup-health/page.tsx`, `web-admin/src/features/setup-health/{access,api,hooks,ui}/*`, `web-admin/messages/{en,ar}/setupHealth.json` |
| Tenant shared touchpoints | `web-admin/app/dashboard/layout.tsx` (banner), `web-admin/src/features/dashboard/ui/DashboardContent.tsx` (home tile), `web-admin/config/navigation.ts` (`settings_setup_health`), `web-admin/src/features/access/page-access-registry.ts` |
| Tenant tests | `web-admin/__tests__/services/setup-health.service.test.ts`, `web-admin/__tests__/api/setup-health.route.test.ts`, `web-admin/__tests__/features/setup-health/`, `web-admin/__tests__/db-integration/setup-health.db.test.ts` |
| HQ (`cleanmatexsaas`) | `platform-api/src/modules/tenant-setup-health/`, `platform-web/src/features/tenants/{hooks/use-tenant-setup-health.ts,ui/tenant-setup-health-screen.tsx,ui/tenant-setup-health-run-dialog.tsx}`, `platform-web/app/tenants/[id]/setup-health/page.tsx` |
