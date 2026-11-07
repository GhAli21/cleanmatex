-- =============================================================================
-- Migration: 0709_setup_health_registry.sql
-- Purpose:   Setup Health (docs/features/Setup_Health/PLAN.md §3.1, §3.4, §3.5).
--            One database-side list of setup checks, so the tenant app and HQ
--            (the SaaS Backoffice) show the same results without copying code.
--            Creates the domain and check registries, the dispatcher, the first
--            non-tax check functions, and seeds every non-tax check.
-- Affected:  sys_setup_health_domain_cd (new), sys_setup_health_check_cd (new),
--            fn_setup_health_run (new), fn_shc_guard_tenant (new),
--            fn_shc_cal_no_business_hours (new), fn_shc_speed_no_rules (new),
--            fn_shc_erp_lite_not_ready (new). CAL_HOLIDAYS_ESTIMATED comes in a
--            later migration, once the Speeds public-holidays table exists.
-- Related:   0707 (Service Speeds: org_branches_mst.business_hours,
--            org_speed_price_rules_cf turnaround columns)
--            must be applied BEFORE this file. 0215 (vw_fin_tenant_readiness).
--            TAX_* checks are added later by Tax Engine M8 using this registry.
--
-- Design contract (kept stable for Tax M8):
--   * A check = one registry row + one function
--       fn_shc_<check>(p_tenant UUID, p_branch UUID) RETURNS JSONB
--       {status: OK|FAIL|NA, count: int, sample_ids: [uuid|text], details: {}}
--   * Check functions are plpgsql (body resolved at first call), STABLE,
--     read-only, SECURITY INVOKER, call fn_shc_guard_tenant(p_tenant) first,
--     and filter every org_* read by tenant_org_id.
--   * fn_setup_health_run calls each active check by name; a check that throws
--     returns one ERROR row instead of failing the whole run.
--   * Adding a domain or check = a migration with rows + functions only.
--
-- Rollback (forward-only, manual): DROP the five functions, then
--   DROP TABLE sys_setup_health_check_cd RESTRICT;
--   DROP TABLE sys_setup_health_domain_cd RESTRICT;
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Domain registry
-- -----------------------------------------------------------------------------
-- Groups checks on the screens (Tax, Calendar, Speeds, ...). Platform-owned
-- lookup; no tenant data, so no tenant_org_id and no RLS.
CREATE TABLE IF NOT EXISTS public.sys_setup_health_domain_cd (
  domain_code    TEXT        NOT NULL,                  -- Stable code, e.g. TAX, CALENDAR; never renamed
  name           TEXT        NOT NULL,                  -- English label
  name2          TEXT        NOT NULL,                  -- Arabic label
  display_order  INTEGER     NOT NULL DEFAULT 0,        -- Group order on screens (ascending)
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,     -- FALSE hides the whole group
  rec_status     SMALLINT    NOT NULL DEFAULT 1,        -- 1=active, 0=soft-deleted
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),    -- Row creation time
  created_by     TEXT,                                  -- Actor that created the row
  created_info   TEXT,                                  -- Free-text origin (migration name)
  updated_at     TIMESTAMPTZ,                           -- Last change time
  updated_by     TEXT,                                  -- Actor of last change
  updated_info   TEXT,                                  -- Free-text reason of last change
  CONSTRAINT pk_sys_shc_domain PRIMARY KEY (domain_code),
  CONSTRAINT chk_shc_domain_code CHECK (domain_code ~ '^[A-Z][A-Z0-9_]*$')
);

COMMENT ON TABLE public.sys_setup_health_domain_cd IS
  'Setup Health domains: groups of checks shown together (Tax, Calendar, Speeds, ERP-Lite, ...). Platform data.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.domain_code IS 'Stable domain code (UPPER_SNAKE). Referenced by sys_setup_health_check_cd.domain_code; never renamed.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.name IS 'English domain label.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.name2 IS 'Arabic domain label.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.display_order IS 'Order of the domain group on screens, ascending.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.is_active IS 'FALSE hides every check of this domain.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.rec_status IS '1=active, 0=soft-deleted.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.created_by IS 'Actor that created the row.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.created_info IS 'Origin of the row (for seeds: the migration).';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.updated_at IS 'Last change time.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.updated_by IS 'Actor of the last change.';
COMMENT ON COLUMN public.sys_setup_health_domain_cd.updated_info IS 'Reason of the last change.';
COMMENT ON CONSTRAINT pk_sys_shc_domain ON public.sys_setup_health_domain_cd IS 'One row per domain code.';
COMMENT ON CONSTRAINT chk_shc_domain_code ON public.sys_setup_health_domain_cd IS 'Codes are UPPER_SNAKE so they match constants in both apps exactly.';

-- -----------------------------------------------------------------------------
-- 2. Check registry
-- -----------------------------------------------------------------------------
-- One row per check. Screens and APIs read only this table and the dispatcher,
-- so a new check needs no app change. Platform data; no tenant_org_id, no RLS.
CREATE TABLE IF NOT EXISTS public.sys_setup_health_check_cd (
  check_code        TEXT        NOT NULL,               -- Stable code, e.g. CAL_NO_BUSINESS_HOURS
  domain_code       TEXT        NOT NULL,               -- Group (FK sys_setup_health_domain_cd)
  severity          TEXT        NOT NULL,               -- BLOCKER / WARNING / INFO
  name              TEXT        NOT NULL,               -- English title (what is wrong)
  name2             TEXT        NOT NULL,               -- Arabic title
  description       TEXT        NOT NULL,               -- English: why it matters, plain words
  description2      TEXT        NOT NULL,               -- Arabic: why it matters
  fix_route         TEXT,                               -- Tenant app path; NULL = "contact support"
  hq_fix_route      TEXT,                               -- HQ path; {tenantId} is replaced by the tenant id
  fix_permission    TEXT,                               -- Tenant permission needed to open fix_route
  feature_flag_key  TEXT,                               -- Check hidden when this flag is off for the tenant
  shows_banner      BOOLEAN     NOT NULL DEFAULT FALSE, -- A failing BLOCKER shows the tenant app banner
  is_hq_only        BOOLEAN     NOT NULL DEFAULT FALSE, -- TRUE = shown in HQ only (platform-side data)
  fn_name           TEXT        NOT NULL,               -- Check function fn_shc_*(uuid, uuid) -> jsonb
  display_order     INTEGER     NOT NULL DEFAULT 0,     -- Order inside the domain group
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,  -- FALSE = not run
  rec_status        SMALLINT    NOT NULL DEFAULT 1,     -- 1=active, 0=soft-deleted
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Row creation time
  created_by        TEXT,                               -- Actor that created the row
  created_info      TEXT,                               -- Origin (migration name)
  updated_at        TIMESTAMPTZ,                        -- Last change time
  updated_by        TEXT,                               -- Actor of last change
  updated_info      TEXT,                               -- Reason of last change
  CONSTRAINT pk_sys_shc_check PRIMARY KEY (check_code),
  CONSTRAINT fk_shc_check_domain FOREIGN KEY (domain_code)
    REFERENCES public.sys_setup_health_domain_cd (domain_code) ON DELETE RESTRICT,
  CONSTRAINT chk_shc_check_code CHECK (check_code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT chk_shc_severity CHECK (severity IN ('BLOCKER', 'WARNING', 'INFO')),
  CONSTRAINT chk_shc_fn_name CHECK (fn_name ~ '^fn_shc_[a-z0-9_]+$'),
  CONSTRAINT chk_shc_fix_perm CHECK (fix_permission IS NULL OR fix_permission ~ '^[a-z0-9_]+:([a-z0-9_]+|\*)$'),
  CONSTRAINT chk_shc_banner CHECK (NOT shows_banner OR (severity = 'BLOCKER' AND NOT is_hq_only))
);

COMMENT ON TABLE public.sys_setup_health_check_cd IS
  'Setup Health check registry: what is checked, how serious it is, why it matters and where to fix it. Each row names a fn_shc_* function run by fn_setup_health_run. Platform data.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.check_code IS 'Stable check code (UPPER_SNAKE); also the i18n/constant key in both apps. Never renamed.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.domain_code IS 'Domain group of the check (sys_setup_health_domain_cd).';
COMMENT ON COLUMN public.sys_setup_health_check_cd.severity IS 'BLOCKER (something does not work), WARNING (works but wrong/incomplete), INFO (good to know).';
COMMENT ON COLUMN public.sys_setup_health_check_cd.name IS 'English title of the problem shown when the check fails.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.name2 IS 'Arabic title of the problem.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.description IS 'English explanation of why it matters, in plain words.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.description2 IS 'Arabic explanation of why it matters.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.fix_route IS 'Tenant app path of the screen that fixes it. NULL = the provider (HQ) fixes it; tenant users see "contact support".';
COMMENT ON COLUMN public.sys_setup_health_check_cd.hq_fix_route IS 'HQ path of the fix screen; the literal {tenantId} is replaced with the tenant id. NULL = no HQ fix screen.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.fix_permission IS 'Tenant permission (resource:action) needed to open fix_route; without it the user sees "contact support".';
COMMENT ON COLUMN public.sys_setup_health_check_cd.feature_flag_key IS 'Feature flag key (hq_ff_feature_flags_mst.flag_key); the check is hidden when the flag is off for the tenant. NULL = always shown.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.shows_banner IS 'TRUE = when failing, the tenant app shows a non-dismissible banner. Only BLOCKER, tenant-visible checks.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.is_hq_only IS 'TRUE = platform-side problem the tenant cannot fix (e.g. unconfirmed public holidays); shown only in HQ.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.fn_name IS 'Name of the check function fn_shc_*(p_tenant uuid, p_branch uuid) returning jsonb {status,count,sample_ids,details}. Restricted to the fn_shc_ prefix so the dispatcher cannot call arbitrary functions.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.display_order IS 'Order of the check inside its domain group, ascending.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.is_active IS 'FALSE = the dispatcher skips the check.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.rec_status IS '1=active, 0=soft-deleted (skipped).';
COMMENT ON COLUMN public.sys_setup_health_check_cd.created_at IS 'Row creation time.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.created_by IS 'Actor that created the row.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.created_info IS 'Origin of the row (for seeds: the migration).';
COMMENT ON COLUMN public.sys_setup_health_check_cd.updated_at IS 'Last change time.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.updated_by IS 'Actor of the last change.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.updated_info IS 'Reason of the last change.';
COMMENT ON CONSTRAINT pk_sys_shc_check ON public.sys_setup_health_check_cd IS 'One row per check code.';
COMMENT ON CONSTRAINT fk_shc_check_domain ON public.sys_setup_health_check_cd IS 'Every check belongs to a known domain; a domain with checks cannot be deleted.';
COMMENT ON CONSTRAINT chk_shc_check_code ON public.sys_setup_health_check_cd IS 'Codes are UPPER_SNAKE so they match app constants exactly.';
COMMENT ON CONSTRAINT chk_shc_severity ON public.sys_setup_health_check_cd IS 'Allowed severities.';
COMMENT ON CONSTRAINT chk_shc_fn_name ON public.sys_setup_health_check_cd IS 'Only fn_shc_* functions can be dispatched (dynamic EXECUTE safety).';
COMMENT ON CONSTRAINT chk_shc_fix_perm ON public.sys_setup_health_check_cd IS 'Permission codes follow resource:action (CLAUDE.md rule 13).';
COMMENT ON CONSTRAINT chk_shc_banner ON public.sys_setup_health_check_cd IS 'The tenant banner is only for blockers the tenant can see.';

-- Supports the dispatcher scan (active checks in display order, optional domain).
CREATE INDEX IF NOT EXISTS idx_shc_check_domain_ord
  ON public.sys_setup_health_check_cd (domain_code, display_order);
COMMENT ON INDEX public.idx_shc_check_domain_ord IS 'Dispatcher and screens list checks by domain in display order.';

-- Platform lookups: Supabase default privileges would give anon/authenticated
-- write access to new public tables, letting an end user rewrite check text,
-- fix routes or fn_name. Remove that; users read only, the service role (HQ)
-- and migrations write.
REVOKE ALL ON public.sys_setup_health_domain_cd, public.sys_setup_health_check_cd FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sys_setup_health_domain_cd, public.sys_setup_health_check_cd TO authenticated;
GRANT ALL ON public.sys_setup_health_domain_cd, public.sys_setup_health_check_cd TO service_role;

-- RLS as a second layer: signed-in users may only read; no write policy exists.
ALTER TABLE public.sys_setup_health_domain_cd ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sys_setup_health_check_cd ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_shc_domain_read ON public.sys_setup_health_domain_cd;
CREATE POLICY pol_shc_domain_read ON public.sys_setup_health_domain_cd
  FOR SELECT TO authenticated USING (TRUE);
COMMENT ON POLICY pol_shc_domain_read ON public.sys_setup_health_domain_cd IS
  'Platform data: every signed-in user may read domains; nobody but the service role writes.';

DROP POLICY IF EXISTS pol_shc_check_read ON public.sys_setup_health_check_cd;
CREATE POLICY pol_shc_check_read ON public.sys_setup_health_check_cd
  FOR SELECT TO authenticated USING (TRUE);
COMMENT ON POLICY pol_shc_check_read ON public.sys_setup_health_check_cd IS
  'Platform data: every signed-in user may read checks; nobody but the service role writes.';

-- -----------------------------------------------------------------------------
-- 3a. Tenant guard (every dispatcher/check function calls it first)
-- -----------------------------------------------------------------------------
-- Check functions can read views that run with owner rights (e.g.
-- vw_fin_tenant_readiness), so RLS alone does not stop an end user from passing
-- another tenant's id. An end-user JWT call must name a tenant the user belongs
-- to. Calls without an end-user JWT (server connection, migrations) and
-- service_role (HQ) are trusted server code.
CREATE OR REPLACE FUNCTION public.fn_shc_guard_tenant(p_tenant UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT EXISTS (SELECT 1 FROM org_users_mst ou
                     WHERE ou.user_id = auth.uid()
                       AND ou.tenant_org_id = p_tenant
                       AND ou.is_active = TRUE) THEN
    RAISE EXCEPTION 'setup health: tenant not accessible' USING ERRCODE = '42501';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_shc_guard_tenant(UUID) IS
  'Setup Health tenant guard: raises 42501 when an end-user (JWT) caller asks about a tenant they are not an active member of. Server connections and service_role pass. Called first by fn_setup_health_run and every fn_shc_* check (Tax M8 checks too).';
-- Definer function: only callable by the roles that may run checks.
REVOKE ALL ON FUNCTION public.fn_shc_guard_tenant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_guard_tenant(UUID) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Check functions (non-tax)
-- -----------------------------------------------------------------------------

-- CAL_NO_BUSINESS_HOURS: branches whose effective weekly hours are empty.
-- Effective = branch.business_hours, else the organization's (NULL inherits).
-- Without hours, ready-by falls back to clock hours (Speeds plan §5).
CREATE OR REPLACE FUNCTION public.fn_shc_cal_no_business_hours(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tenant_hours JSONB;
  v_ids          UUID[];
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  SELECT t.business_hours INTO v_tenant_hours
  FROM org_tenants_mst t
  WHERE t.id = p_tenant;

  SELECT array_agg(b.id ORDER BY b.is_main DESC, b.name)
  INTO v_ids
  FROM org_branches_mst b
  WHERE b.tenant_org_id = p_tenant
    AND (p_branch IS NULL OR b.id = p_branch)
    AND b.is_active = TRUE
    AND b.rec_status = 1
    AND COALESCE(NULLIF(b.business_hours, 'null'::jsonb), v_tenant_hours, '{}'::jsonb) IN ('{}'::jsonb, 'null'::jsonb, '[]'::jsonb);

  -- An organization with no active branch is judged on its own hours (sample = the tenant id).
  IF v_ids IS NULL AND p_branch IS NULL
     AND COALESCE(v_tenant_hours, '{}'::jsonb) IN ('{}'::jsonb, 'null'::jsonb, '[]'::jsonb)
     AND NOT EXISTS (SELECT 1 FROM org_branches_mst b
                     WHERE b.tenant_org_id = p_tenant AND b.is_active = TRUE AND b.rec_status = 1) THEN
    v_ids := ARRAY[p_tenant];
  END IF;

  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(cardinality(v_ids), 0) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      COALESCE(cardinality(v_ids), 0),
    'sample_ids', to_jsonb(COALESCE(v_ids[1:5], '{}'::uuid[])),
    'details',    jsonb_build_object('tenant_hours_set', COALESCE(v_tenant_hours, '{}'::jsonb) NOT IN ('{}'::jsonb, 'null'::jsonb, '[]'::jsonb))
  );
END;
$$;

COMMENT ON FUNCTION public.fn_shc_cal_no_business_hours(UUID, UUID) IS
  'Setup Health CAL_NO_BUSINESS_HOURS: FAIL when an active branch (or p_branch) has no weekly business hours of its own nor from the organization. count = branches; sample_ids = up to 5 branch ids. Tenant-filtered, read-only.';

-- SPEED_NO_RULES: the organization has no active speed rule, so only STANDARD is
-- offered (Speeds plan D5). INFO: a valid choice, but often an oversight.
CREATE OR REPLACE FUNCTION public.fn_shc_speed_no_rules(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  SELECT count(*) INTO v_count
  FROM org_speed_price_rules_cf r
  WHERE r.tenant_org_id = p_tenant
    AND (p_branch IS NULL OR r.branch_id IS NULL OR r.branch_id = p_branch)
    AND r.is_active = TRUE
    AND r.rec_status = 1
    AND (r.effective_from IS NULL OR r.effective_from <= CURRENT_DATE)
    AND (r.effective_to   IS NULL OR r.effective_to   >= CURRENT_DATE);

  RETURN jsonb_build_object(
    'status',     CASE WHEN v_count = 0 THEN 'FAIL' ELSE 'OK' END,
    'count',      CASE WHEN v_count = 0 THEN 1 ELSE 0 END,
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object('active_rules', v_count)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_shc_speed_no_rules(UUID, UUID) IS
  'Setup Health SPEED_NO_RULES: FAIL when no active, in-date speed price rule exists for the organization (or applies to p_branch), so only Standard speed is offered. Tenant-filtered, read-only.';

-- ERP_LITE_NOT_READY: wraps the existing ERP-Lite readiness view (0215) so the
-- definition of "ready" stays in one place.
CREATE OR REPLACE FUNCTION public.fn_shc_erp_lite_not_ready(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  -- shortcut: the view aggregates per tenant before the filter; fine at current tenant counts, give it a tenant-parameterised function if this check slows the run.
  SELECT r.readiness_status, r.missing_required_mappings, r.open_period_count,
         r.has_gov_assignment, r.open_exception_count, r.last_apply_status
  INTO v_row
  FROM vw_fin_tenant_readiness r
  WHERE r.tenant_org_id = p_tenant;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb,
                              'details', jsonb_build_object('reason', 'TENANT_INACTIVE'));
  END IF;

  RETURN jsonb_build_object(
    'status',     CASE WHEN v_row.readiness_status = 'READY' THEN 'OK' ELSE 'FAIL' END,
    'count',      CASE WHEN v_row.readiness_status = 'READY' THEN 0 ELSE 1 END,
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object(
                    'readiness_status',          v_row.readiness_status,
                    'missing_required_mappings', v_row.missing_required_mappings,
                    'open_period_count',         v_row.open_period_count,
                    'has_gov_assignment',        v_row.has_gov_assignment,
                    'open_exception_count',      v_row.open_exception_count,
                    'last_apply_status',         v_row.last_apply_status)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_shc_erp_lite_not_ready(UUID, UUID) IS
  'Setup Health ERP_LITE_NOT_READY: FAIL unless vw_fin_tenant_readiness says READY for the organization; details carry the readiness facts. NA for inactive organizations. Tenant-filtered, read-only.';

-- -----------------------------------------------------------------------------
-- 4. Dispatcher
-- -----------------------------------------------------------------------------
-- Runs every active check (optionally one domain) for one tenant and optional
-- branch. Returns registry metadata with each result so callers need one call.
-- SECURITY INVOKER: an authenticated caller still sees only its own tenant's
-- rows through RLS; HQ calls it with the service role.
CREATE OR REPLACE FUNCTION public.fn_setup_health_run(p_tenant UUID, p_branch UUID, p_domain TEXT)
RETURNS TABLE (
  check_code       TEXT,
  domain_code      TEXT,
  severity         TEXT,
  status           TEXT,
  issue_count      INTEGER,
  sample_ids       JSONB,
  details          JSONB,
  name             TEXT,
  name2            TEXT,
  description      TEXT,
  description2     TEXT,
  fix_route        TEXT,
  hq_fix_route     TEXT,
  fix_permission   TEXT,
  feature_flag_key TEXT,
  shows_banner     BOOLEAN,
  is_hq_only       BOOLEAN,
  domain_order     INTEGER,
  display_order    INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c        RECORD;
  v_result JSONB;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  IF p_tenant IS NULL THEN
    RAISE EXCEPTION 'fn_setup_health_run: p_tenant is required' USING ERRCODE = '22004';
  END IF;

  FOR c IN
    SELECT k.*, d.display_order AS d_order
    FROM sys_setup_health_check_cd k
    JOIN sys_setup_health_domain_cd d ON d.domain_code = k.domain_code
    WHERE k.is_active AND k.rec_status = 1
      AND d.is_active AND d.rec_status = 1
      AND (p_domain IS NULL OR k.domain_code = p_domain)
    ORDER BY d.display_order, k.display_order, k.check_code
  LOOP
    BEGIN
      EXECUTE format('SELECT public.%I($1, $2)', c.fn_name) INTO v_result USING p_tenant, p_branch;
      IF v_result IS NULL OR NOT (v_result ->> 'status') IN ('OK', 'FAIL', 'NA') THEN
        v_result := jsonb_build_object('status', 'ERROR', 'count', 0, 'sample_ids', '[]'::jsonb,
                                       'details', jsonb_build_object('message', 'invalid check result'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- One broken check must not hide the others.
      v_result := jsonb_build_object('status', 'ERROR', 'count', 0, 'sample_ids', '[]'::jsonb,
                                     'details', jsonb_build_object('sqlstate', SQLSTATE, 'message', SQLERRM));
    END;

    check_code       := c.check_code;
    domain_code      := c.domain_code;
    severity         := c.severity;
    status           := v_result ->> 'status';
    issue_count      := COALESCE((v_result ->> 'count')::INTEGER, 0);
    sample_ids       := COALESCE(v_result -> 'sample_ids', '[]'::jsonb);
    details          := COALESCE(v_result -> 'details', '{}'::jsonb);
    name             := c.name;
    name2            := c.name2;
    description      := c.description;
    description2     := c.description2;
    fix_route        := c.fix_route;
    hq_fix_route     := c.hq_fix_route;
    fix_permission   := c.fix_permission;
    feature_flag_key := c.feature_flag_key;
    shows_banner     := c.shows_banner;
    is_hq_only       := c.is_hq_only;
    domain_order     := c.d_order;
    display_order    := c.display_order;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.fn_setup_health_run(UUID, UUID, TEXT) IS
  'Setup Health dispatcher: runs each active check (optionally only p_domain) for p_tenant and optional p_branch, one row per check with registry metadata. A throwing or malformed check yields status ERROR for that row only. Feature-flag, HQ-only and permission filtering is done by the caller.';

-- Callers: tenant app server (authenticated / service role) and HQ (service role). Never anonymous.
REVOKE ALL ON FUNCTION public.fn_setup_health_run(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_shc_cal_no_business_hours(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_shc_speed_no_rules(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_shc_erp_lite_not_ready(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_setup_health_run(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_shc_cal_no_business_hours(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_shc_speed_no_rules(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_shc_erp_lite_not_ready(UUID, UUID) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 5. Seeds (idempotent; ON CONFLICT DO UPDATE keeps platform text current)
-- -----------------------------------------------------------------------------
-- All domains used by current and planned checks (PLAN §3.1), so Tax M8 and
-- later domains only add check rows.
INSERT INTO public.sys_setup_health_domain_cd (domain_code, name, name2, display_order, created_by, created_info)
VALUES
  ('TAX',      'Tax',                'الضريبة',               10, 'system_admin', '0709 setup health'),
  ('PAYMENTS', 'Payments',           'المدفوعات',             20, 'system_admin', '0709 setup health'),
  ('CALENDAR', 'Business calendar',  'تقويم العمل',           30, 'system_admin', '0709 setup health'),
  ('SPEEDS',   'Service speeds',     'سرعات الخدمة',          40, 'system_admin', '0709 setup health'),
  ('CATALOG',  'Catalog',            'الكتالوج',              50, 'system_admin', '0709 setup health'),
  ('BRANCHES', 'Branches',           'الفروع',                60, 'system_admin', '0709 setup health'),
  ('ERP_LITE', 'Accounting (ERP-Lite)', 'المحاسبة (ERP-Lite)', 70, 'system_admin', '0709 setup health')
ON CONFLICT (domain_code) DO UPDATE
SET name = EXCLUDED.name, name2 = EXCLUDED.name2, display_order = EXCLUDED.display_order,
    updated_at = NOW(), updated_by = 'system_admin', updated_info = '0709 setup health';

INSERT INTO public.sys_setup_health_check_cd (
  check_code, domain_code, severity, name, name2, description, description2,
  fix_route, hq_fix_route, fix_permission, feature_flag_key,
  shows_banner, is_hq_only, fn_name, display_order, created_by, created_info
)
VALUES
  ('CAL_NO_BUSINESS_HOURS', 'CALENDAR', 'WARNING',
   'Business hours are not set', 'ساعات العمل غير محددة',
   'Without opening hours, ready-by times are counted in clock hours and can fall at night or on your day off. Set your weekly hours so customers get a real promise.',
   'بدون ساعات العمل تُحسب مواعيد الجاهزية بالساعات المتواصلة وقد تقع ليلاً أو في يوم إجازتك. حدّد ساعات العمل الأسبوعية ليحصل العملاء على موعد حقيقي.',
   '/dashboard/settings/calendar', '/tenants/{tenantId}/branches', 'settings:organization', NULL,
   FALSE, FALSE, 'fn_shc_cal_no_business_hours', 10, 'system_admin', '0709 setup health'),
  ('SPEED_NO_RULES', 'SPEEDS', 'INFO',
   'Only Standard speed is offered', 'السرعة العادية فقط متاحة',
   'No speed pricing rule is active, so customers cannot choose Express, Next day or other faster speeds. Add a speed rule to offer them and charge for them.',
   'لا توجد قاعدة تسعير سرعة فعّالة، لذلك لا يستطيع العملاء اختيار المستعجل أو اليوم التالي أو السرعات الأخرى. أضف قاعدة سرعة لتقديمها وتحصيل رسومها.',
   '/dashboard/catalog/speed-pricing', '/tenants/{tenantId}/catalog', 'pricing:read', NULL,
   FALSE, FALSE, 'fn_shc_speed_no_rules', 10, 'system_admin', '0709 setup health'),
  ('ERP_LITE_NOT_READY', 'ERP_LITE', 'WARNING',
   'Accounting is not ready', 'المحاسبة غير جاهزة',
   'Some accounting setup is missing (account mappings, an open period or the accounting template), so sales may not post to your books correctly.',
   'بعض إعدادات المحاسبة ناقصة (ربط الحسابات أو فترة مفتوحة أو قالب المحاسبة)، لذلك قد لا تُرحَّل المبيعات إلى دفاترك بشكل صحيح.',
   '/dashboard/erp-lite/readiness', '/erp-lite-governance/tenants', 'erp_lite:view', 'erp_lite_readiness_enabled',
   FALSE, FALSE, 'fn_shc_erp_lite_not_ready', 10, 'system_admin', '0709 setup health')
ON CONFLICT (check_code) DO UPDATE
SET domain_code = EXCLUDED.domain_code, severity = EXCLUDED.severity,
    name = EXCLUDED.name, name2 = EXCLUDED.name2,
    description = EXCLUDED.description, description2 = EXCLUDED.description2,
    fix_route = EXCLUDED.fix_route, hq_fix_route = EXCLUDED.hq_fix_route,
    fix_permission = EXCLUDED.fix_permission, feature_flag_key = EXCLUDED.feature_flag_key,
    shows_banner = EXCLUDED.shows_banner, is_hq_only = EXCLUDED.is_hq_only,
    fn_name = EXCLUDED.fn_name, display_order = EXCLUDED.display_order,
    updated_at = NOW(), updated_by = 'system_admin', updated_info = '0709 setup health';

-- -----------------------------------------------------------------------------
-- 6. Verification (PLAN §3.5): every active tenant gets one row per active
--    check and no ERROR rows. Fails the migration if not.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_checks INTEGER;
  v_bad    RECORD;
BEGIN
  SELECT count(*) INTO v_checks FROM public.sys_setup_health_check_cd WHERE is_active AND rec_status = 1;

  FOR v_bad IN
    SELECT t.id, x.check_code, x.status, x.details
    FROM public.org_tenants_mst t
    CROSS JOIN LATERAL public.fn_setup_health_run(t.id, NULL, NULL) x
    WHERE t.is_active AND t.rec_status = 1 AND x.status = 'ERROR'
    LIMIT 1
  LOOP
    RAISE EXCEPTION '0709: check % returned ERROR for tenant %: %', v_bad.check_code, v_bad.id, v_bad.details;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.org_tenants_mst t
    WHERE t.is_active AND t.rec_status = 1
      AND (SELECT count(*) FROM public.fn_setup_health_run(t.id, NULL, NULL)) <> v_checks
  ) THEN
    RAISE EXCEPTION '0709: a tenant did not get one row per active check';
  END IF;
END $$;

COMMIT;
