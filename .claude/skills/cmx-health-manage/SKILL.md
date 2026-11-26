---
name: cmx-health-manage
description: >-
  Add, modify, retire, or audit CleanMateX Setup Health domains, SQL check
  functions (fn_shc_*), registry rows (sys_setup_health_*_cd), and tenant/HQ
  wiring. Invoke explicitly via /cmx-health-manage; do not auto-load.
disable-model-invocation: true
user-invocable: true
version: 1.0.0
---

# Setup Health — Manage & Audit (`cmx-health-manage`)

Explicit-invocation skill for adding, modifying, retiring, or auditing CleanMateX's **Setup Health** module (`sys_setup_health_*_cd`, `fn_shc_*`, `fn_setup_health_run`, `org_setup_health_sum_tr`, tenant `web-admin`, and HQ `cleanmatexsaas`).

> **Scope note:** This skill governs the **Setup Health** module, not the minimal NestJS liveness endpoint in `cmx-api/src/modules/health/`.

Before editing anything, read only the relevant parts of:
- `docs/skills-ref-files/cmx-health-manage/reference.md` (SQL template, DB constraints, full file map)
- `docs/features/Setup_Health/developer_guide.md` and `docs/features/Setup_Health/STATUS.md`
- `web-admin/lib/constants/setup-health.ts`

Load `/database` before creating SQL migrations, and `/frontend` + `/i18n` if modifying tenant UI.

---

## 0. Choose Mode

| User intent | Workflow |
|---|---|
| Add a new health check or domain | **§1 Add** |
| Change wording, severity, route, flags, SQL logic, or retire a check/domain | **§2 Modify / Retire** |
| Check, review, or audit the Setup Health module | **§3 Audit** |

---

## 1. Add a Check or Domain

Adding a registry-backed check requires **one new forward-only SQL migration** and **no app code or i18n changes** (both Tenant and HQ read texts, routes, and flags directly from `sys_setup_health_check_cd`).

```
Task Progress:
- [ ] Step 1: Check existing domain & pick next migration seq
- [ ] Step 2: Write fn_shc_<name>(p_tenant, p_branch) with guard + tenant filter
- [ ] Step 3: Upsert sys_setup_health_domain_cd (if new) & sys_setup_health_check_cd (v2 fields)
- [ ] Step 4: Add self-verification DO block
- [ ] Step 5: STOP — do not apply migration; update docs if needed
```

### Mandatory rules
1. **Migration sequence**: Check the last migration in `supabase/migrations/` and use `last_seq + 1` (`{seq}_setup_health_<name>.sql`). Never edit existing migrations. **Never apply/run migrations** — create the SQL file, then STOP and ask the user to review and apply.
2. **Function contract** (`fn_shc_<name>(p_tenant UUID, p_branch UUID) RETURNS JSONB`):
   - `LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp`
   - First executable line: `PERFORM public.fn_shc_guard_tenant(p_tenant);`
   - Every `org_*` query MUST explicitly filter `tenant_org_id = p_tenant` (never rely on RLS alone).
   - If the check evaluates "today" or a local date, resolve the timezone via `public.fn_ops_zone(p_tenant, ...)` — never silently fall back to `'UTC'`; return `FAIL` with `details.reason = 'TIMEZONE_NOT_CONFIGURED'` when null (migration `0831` rule).
   - Return JSONB: `{"status": "OK"|"FAIL"|"NA", "count": int, "sample_ids": [max 5], "details": {}}`.
   - Set `REVOKE ALL ... FROM PUBLIC, anon; GRANT EXECUTE ... TO authenticated, service_role;` and `COMMENT ON FUNCTION`.
3. **Registry v2 row (`sys_setup_health_check_cd`)**:
   - `check_code`: `^[A-Z][A-Z0-9_]*$`; `fn_name`: `^fn_shc_[a-z0-9_]+$`; `severity`: `BLOCKER | WARNING | INFO`.
   - Set **both** problem titles (`name`, `name2`) AND passing titles (`ok_name`, `ok_name2` — `NOT NULL`, non-blank since `0738`) plus `description`, `description2`. Check `docs/dev/i18n_docs/GLOSSARY.md` for EN/AR terms.
   - Use `feature_flag_keys TEXT[]` (`'{}'::text[]` = always shown; no `NULL` elements; old `feature_flag_key` column does not exist). Verify every flag key exists in `hq_ff_feature_flags_mst`.
   - `shows_banner = TRUE` is only valid when `severity = 'BLOCKER' AND NOT is_hq_only`.
   - `fix_permission` must match `^[a-z0-9_]+:([a-z0-9_]+|\*)$` and exist in RBAC.
   - Use `ON CONFLICT (check_code) DO UPDATE` for idempotency.
4. **Verification block**: Include the `DO $$` check from `docs/skills-ref-files/cmx-health-manage/reference.md` verifying every active tenant gets one row per active check and zero `ERROR` rows.

---

## 2. Modify or Retire a Check, Domain, or App Surface

1. **SQL / registry edits**: Always create a **new** forward-only migration (`CREATE OR REPLACE FUNCTION` and/or `UPDATE` / `INSERT ... ON CONFLICT DO UPDATE`). Never edit applied migrations.
2. **Retiring a check or domain**:
   - Soft-disable first: `UPDATE sys_setup_health_check_cd SET is_active = FALSE, rec_status = 0, updated_at = NOW(), updated_by = 'system_admin', updated_info = '<seq> ...' WHERE check_code = '...';`
   - Never rename a `check_code` or `domain_code` in place if referenced externally; deactivate old and add new.
   - If dropping an unused function, use `DROP FUNCTION ... RESTRICT` (never `CASCADE`).
3. **Check whether app code needs changes**:
   - Changing check logic, wording, severity, `fix_route`, `hq_fix_route`, `fix_permission`, `feature_flag_keys`, `shows_banner`, or `is_hq_only` → **DB migration only** (no tenant/HQ code change).
   - Changing severity/status enums, API query params, banner/home-card behavior, or UI layout → update `web-admin` (and `cleanmatexsaas` if shared) and keep `lib/constants/setup-health.ts` mirrored to DB values.
4. **Stored summary (`org_setup_health_sum_tr`)**: Never write to `org_setup_health_sum_tr` from the tenant app. HQ refreshes it on Setup Health load, via `POST /tenants/setup-health/runs` (when `checkCodes` is omitted), and via the nightly `setup-health-refresh` job.
5. **Post-edit gates**:
   - SQL-only change: STOP after writing the migration and remind the user to apply it and run the DB integration test.
   - Frontend/service change: run `cd web-admin && npm run build`, plus affected Jest suites (§4).

---

## 3. Audit / Check the Setup Health Module

Run through these five checks and report findings ranked by severity:

1. **DB Contract & Tenant Isolation**
   - Every `fn_shc_*` function is `STABLE SECURITY INVOKER`, calls `PERFORM public.fn_shc_guard_tenant(p_tenant)` first, explicitly filters `tenant_org_id = p_tenant` on every `org_*` table, revokes `PUBLIC, anon`, and has `COMMENT ON FUNCTION`.
   - `sys_setup_health_*_cd` remain read-only for `authenticated` (`SELECT` only).
2. **Registry v2 Integrity (`0738`)**
   - Every active check has non-blank `name`, `name2`, `ok_name`, `ok_name2`, `description`, `description2`.
   - `feature_flag_keys` contains no `NULL`s and only real `hq_ff_feature_flags_mst.flag_key` values.
   - `shows_banner = TRUE` only on `BLOCKER` checks where `is_hq_only = FALSE`.
   - `fix_permission` matches `resource:action` and maps to a seeded permission; `fix_route` / `hq_fix_route` point to live routes.
3. **Timezone Compliance (`0831`)**
   - Any check evaluating current date/time uses `fn_ops_zone` (no silent `'UTC'` fallback).
4. **Tenant & HQ Parity**
   - `web-admin/lib/services/setup-health/setup-health.service.ts` drops `is_hq_only` rows, evaluates `(feature_flag_keys ?? []).every(...)` matching SQL `fn_setup_health_flags_on`, and resolves `fix_permission` only for failing checks (`withFixLinks: false` for summary/banner).
   - `SETUP_HEALTH_SEVERITY` and `SETUP_HEALTH_STATUS` in `web-admin/lib/constants/setup-health.ts` mirror DB values exactly.
   - Tenant route `/api/v1/setup-health` gates on `setup_health:view` and derives `tenantId` strictly from the authenticated session (never request params).
5. **Bilingual Copy & Docs**
   - `web-admin/messages/en/setupHealth.json` and `ar/setupHealth.json` have matching keys and glossary-compliant Arabic terms (`المنشأة`, `إدارة المنصة`).
   - `docs/features/Setup_Health/README.md` and `STATUS.md` reflect active checks/domains.

### Audit Output Format
```markdown
## Setup Health Audit Report

### Critical
- `file:line` — [issue] → [exact fix]

### Warning
- `file:line` — [issue] → [exact fix]

### Verified OK
- [concise summary of passing invariants]
```

---

## 4. Verification Commands

Run only the suites relevant to your change (from `web-admin/` unless noted):

```powershell
# Tenant service, API route, and UI tests
cd web-admin; npx jest __tests__/services/setup-health.service.test.ts __tests__/api/setup-health.route.test.ts __tests__/features/setup-health/

# DB-level integration tests (requires local Supabase running; rolls back all writes)
cd web-admin; npx jest __tests__/db-integration/setup-health.db.test.ts

# Required after web-admin code changes
cd web-admin; npm run build
```

For full SQL templates, DB constraint details, and the complete Tenant + HQ file map, read `docs/skills-ref-files/cmx-health-manage/reference.md`.
