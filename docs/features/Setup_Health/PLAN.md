# Setup Health — Plan

**Status:** APPROVED by owner ("all approved", 2026-11-07) — implementation authorised in program order: Service Speeds S1–S7 → Setup Health → Tax Engine T0–T9
**Program:** part of the Speeds → Setup Health → Tax Engine program (order in [TAX_ENGINE_PLAN.md §0](../Tax_Config/TAX_ENGINE_PLAN.md))

## 1. Goal

One place in the tenant app that tells a laundry owner, in plain words, what is missing or wrong in their setup, why it matters, and one button to fix it. The same results are visible to HQ support for every tenant. Domain-agnostic: tax is the first big consumer; speeds/calendar, payments, ERP-Lite readiness, branches, catalog are others.

## 2. Decisions (owner, 2026-11-07)

| # | Decision |
|---|---|
| H1 | **Setup Health lives in HQ**: a new item in the HQ tenant workspace sidebar (HQ › Tenant Organizations › tenant › Setup Health). Its tax check opens the HQ **Apply tax kit** screen for that tenant |
| H2 | When orders are not taxed because tax setup is not confirmed, a **banner** in the tenant app says why |
| H3 | Tenant app keeps only: the banner, a dashboard home card, and a read-only Setup Health page (same DB function) whose fix buttons open tenant-owned screens or say "contact support" |

## 3. Design

### 3.1 One source of truth, readable by both repos

Checks run **in the database**, so the tenant app and HQ (`cleanmatexsaas`) show identical results without copying code.

| Object | Purpose |
|---|---|
| `sys_setup_health_check_cd` | Check registry: `check_code`, `domain_code` (TAX, SPEEDS, CALENDAR, PAYMENTS, ERP_LITE, CATALOG, BRANCHES…), `severity` (`BLOCKER` / `WARNING` / `INFO`), `name/name2`, `description/description2` (why it matters), `fix_route` (tenant app path), `fix_permission`, `feature_flag_key` (check hidden when flag off), `shows_banner`, `fn_name`, `display_order`, `is_active` |
| `fn_shc_<check>(p_tenant uuid, p_branch uuid)` | One small SQL function per check → `jsonb {status: OK/FAIL/NA, count, sample_ids[], details}`; every `org_*` read filters `tenant_org_id` explicitly; `STABLE`, read-only |
| `fn_setup_health_run(p_tenant uuid, p_branch uuid, p_domain text)` | Dispatcher: loops active checks, `EXECUTE format('select %I($1,$2)', fn_name)`, one failing check returns `ERROR` for that row instead of failing the whole run |

Rule: a new domain adds checks by migration (registry row + function); no change to the screen, API or HQ.

### 3.2 Tenant app (`cleanmatex`)

| Layer | Item |
|---|---|
| Service | `lib/services/setup-health/setup-health.service.ts`: calls the dispatcher, filters by the user's permissions and feature flags, maps to DTO |
| API | `GET /api/v1/setup-health?domain=&branchId=` (list) · `GET /api/v1/setup-health/summary` (blocker/warning counts + banner items; light, used by layout) — `requirePermission('setup_health:view')` for list; summary needs only auth (banner must reach cashiers) |
| Screen (read-only, H3) | `/dashboard/setup-health` → `src/features/setup-health/ui/setup-health-screen.tsx`: same groups; **Fix** opens a tenant-owned screen when one exists and the user has `fix_permission`, otherwise "Your provider sets this up — contact support". Empty/loading/error states; EN/AR + RTL |
| Banner | `src/features/setup-health/ui/setup-blocker-banner.tsx` in the dashboard layout: shows `shows_banner` blockers (e.g. "Orders are not taxed: tax setup is not confirmed — Apply tax kit"). Not dismissible while the blocker exists; collapsible per session |
| Home card | Dashboard home tile "Setup health" with counts → screen |
| Hook | `useSetupHealthSummary()` (TanStack Query, refetch on focus + after fix actions via `invalidateQueries`) |
| Navigation | Settings › **Setup Health** (`navigation.ts` + `sys_components_cd` migration) |
| Permission | new `setup_health:view` (migration + `lib/constants/permissions/setup-health-perm.ts`), granted to owner/admin roles via `/update-rbac-role` |
| Access contract | `src/features/setup-health/access/setup-health-access.ts` (scaffold → derive → wire → check → sync) |

### 3.3 HQ (`cleanmatexsaas`) — primary surface (H1)

- `platform-api` module `tenant-setup-health`: `GET /tenants/:id/setup-health`, `POST /tenants/:id/setup-health/recheck`; fix actions delegate to the owning module (tax kit apply in `tax-setup`).
- `platform-web`: tenant workspace sidebar item **Setup Health** (after Overview): score header, groups per domain, each row with why it matters and **Fix** → HQ screen (tax → **Apply tax kit**, calendar → tenant calendar defaults, ERP-Lite → existing ERP Lite governance). Tenant Organizations list: "Setup" column (blockers count) + filter "has blockers".
- HQ navigation rows + permissions (`tenant_setup_health:view`, fix actions reuse each module's manage permission) — migrations in `cleanmatex`.
- Each check row carries both `fix_route` (tenant app) and `hq_fix_route` (HQ).

### 3.4 Initial checks

| Code | Domain | Severity | Banner | Fix route |
|---|---|---|---|---|
| `TAX_SETUP_NOT_CONFIRMED` | TAX | BLOCKER | yes | `/dashboard/settings/tax/setup` (Apply tax kit) |
| `TAX_REG_NO_MISSING` | TAX | WARNING | no | tax setup › registration |
| `TAX_PRODUCTS_NO_CLASS` | TAX | WARNING | no | catalog filtered |
| `TAX_DOC_TYPE_NO_RULE` | TAX | BLOCKER (Advanced only) | no | tax rules |
| `TAX_EXEMPTION_EXPIRED` | TAX | INFO | no | exemptions |
| `TAX_KIT_UPDATE_PENDING` | TAX | WARNING | yes | tax setup › review update |
| `CAL_NO_BUSINESS_HOURS` | CALENDAR | WARNING | no | organization / branch settings |
| `SPEED_NO_RULES` | SPEEDS | INFO | no | Speed Pricing |
| `ERP_LITE_NOT_READY` | ERP_LITE | WARNING (flag `erp_lite_readiness_enabled`) | no | `/dashboard/erp-lite/readiness` (wraps the existing readiness) |

## 4. Files / areas touched

DB: 1 migration (registry, dispatcher, first functions, permission, nav). Tenant: service, 2 routes, feature folder (ui/hooks/api/access), layout banner, home card, i18n `messages/{en,ar}/setupHealth.json`, constants. HQ: 1 endpoint + 1 tab + i18n. Docs: README, user guide EN/AR, QA guide.

## 5. Tests

DB: every check function — tenant A data never affects tenant B; dispatcher survives a throwing check. Unit: permission/flag filtering. Route: 401/403. UI: banner shows only blockers with `shows_banner`. Performance: full run < 150 ms on demo data (each check one indexed query).
