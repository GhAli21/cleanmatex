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

- `platform-api` module `tenant-setup-health`: `GET /tenants/:id/setup-health`; checks run live, so the HQ Recheck control refetches this endpoint rather than duplicating it with a POST. Fix actions delegate to the owning module (tax kit apply in `tax-setup`).
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

### 3.5 Seed data — full, when possible (owner, 2026-11-07)

Same rule as the other plans: complete data in the same migration, idempotent, `org_*` seeds filter `tenant_org_id`.

| Data | What is seeded |
|---|---|
| `sys_setup_health_check_cd` | Every check in §3.4 plus `CAL_HOLIDAYS_ESTIMATED`, each with EN/AR `name` and `description` (why it matters, plain words), severity, `fix_route`, `hq_fix_route`, `fix_permission`, `feature_flag_key`, `shows_banner`, `fn_name`, `display_order`. Tax checks are added by Tax M8 (their functions need the tax tables) |
| Domain codes | All domain codes used by checks, with EN/AR labels |
| Permissions | `setup_health:view` (tenant) and `tenant_setup_health:view` (HQ), with role grants to owner / admin roles in the same migration |
| Navigation | Tenant Settings › Setup Health and HQ tenant workspace › Setup Health rows |
| Verification | After apply: `select * from fn_setup_health_run(<each demo tenant>, null, null)` returns a row for every active check and no `ERROR` rows |

## 4. Files / areas touched

DB: 1 migration (registry, dispatcher, first functions, permission, nav, full seed per §3.5). Tenant: service, 2 routes, feature folder (ui/hooks/api/access), layout banner, home card, i18n `messages/{en,ar}/setupHealth.json`, constants. HQ: 1 endpoint + 1 tab + i18n. Docs: README, user guide EN/AR, QA guide.

## 5. Tests

DB: every check function — tenant A data never affects tenant B; dispatcher survives a throwing check. Unit: permission/flag filtering. Route: 401/403. UI: banner shows only blockers with `shows_banner`. Performance: full run < 150 ms on demo data (each check one indexed query).

## Per-step definition of done (owner, 2026-11-07 — applies to every step / phase)

Every step (migration, service, API, screen, HQ change) is done only when all apply:

1. **CLAUDE.md first** — load the required skills before writing (`/database`, `/multitenancy`, `/backend`, `/frontend`, `/i18n`, `/navigation`, `/rebuild-ui-access-contract`, `/update-rbac-role`, `/code-documentation`, `/order-fin` as relevant); follow the rule docs it points to (`docs/dev/rules/*`); agents only when the owner asks.
2. **Database** — full audit columns on every new table, `COMMENT ON` every object, RLS on `org_*`, explicit `tenant_org_id` in every query, `DROP … RESTRICT`, migration number = live last + 1, full seeds; write → STOP → owner applies.
3. **UI** — reuse Cmx components from `src/ui/` (HQ: its shared components); if a needed piece is missing and will be reused, add it as a shared reusable component (with story/test), never a feature-local copy; `cmxMessage`, EN/AR + RTL, loading/empty/error states.
4. **Both repos** — the step's HQ (`cleanmatexsaas`) part is done in the same step when the plan lists one.
5. **Checks** — `npx eslint . --quiet`, typecheck, `npm run build`, `npm run check:i18n`, targeted tests; access-contract + inventories refresh after gating/nav changes.
6. **Update status** — the feature's `STATUS.md` (phase row + log line), this plan if scope changed, `followups_by_user.md` for owner actions, QA guide scenarios for testable behaviour, and memory.

## 6. Steps and progress

Tick each task when done. The last task of every step updates [STATUS.md](STATUS.md) and this list before the next step starts.

**Step 1 — Registry migration (0709)**
- [x] Load `/database`, `/multitenancy`, `/code-documentation`
- [x] Write `0709_setup_health_registry.sql` (registry, guard, dispatcher, CAL/SPEED/ERP checks, seeds, self-check) → STOP
- [x] Owner applies; types + Prisma regenerated
- [x] Update STATUS.md + this list

**Step 1b — `CAL_HOLIDAYS_ESTIMATED` migration (live last + 1)**
- [x] Wait for the Speeds public-holidays table to exist (0711 applied)
- [x] Write `0716_setup_health_cal_holidays.sql` (check function + registry row) → STOP
- [x] Owner applies 0716 (2026-11-07); verified on remote
- [x] Set `hq_fix_route` (new migration) once the Speeds HQ public-holidays screen exists — 0724 applied local + remote 2026-11-10
- [x] Update STATUS.md + this list

**Step 2 — Permissions + navigation migration (0710)**
- [x] Load `/create-update-rbac-permission`, `/navigation`
- [x] Write `0710_setup_health_perms_nav.sql` → STOP → owner applies
- [x] Update STATUS.md + this list

**Step 3 — Tenant app**
- [x] Load `/backend`, `/frontend`, `/i18n`, `/implementation`, `/rebuild-ui-access-contract`
- [x] Service, 2 API routes, feature folder (api / hooks / ui / access), page, banner, home card, `navigation.ts`, EN/AR
- [x] Access contract: scaffold → derive → register → wire → check → sync
- [x] eslint, check:i18n, jest, typecheck (own files)
- [x] `npm run build` green
- [x] Update STATUS.md + this list

**Step 4 — HQ (`cleanmatexsaas`)**
- [x] `platform-api` `tenant-setup-health` module (`tenant_setup_health:view`)
- [x] `platform-web` tenant workspace › Setup Health (after Overview) + EN/AR
- [x] eslint, tsc, i18n parity
- [x] HQ build (platform-web + platform-api)
- [x] Update STATUS.md + this list

**Step 4b — HQ tenants list "Setup" column + "has blockers" filter**
- [x] Design a per-tenant blocker count that does not run every check per list row → owner review (proposal below, 2026-11-07)
- [x] Owner approves the design (stored counts, 2026-11-07)
- [x] Write `0717_setup_health_summary.sql` → STOP
- [x] Owner applies 0717; types and Prisma regenerated (2026-11-07)
- [x] HQ: refresh on Setup Health load; tenants list join + "Setup" column + "has blockers" filter + EN/AR; tests; builds

*Implemented design.* The list pages 20 rows from one query, and the filter works across all pages without running checks per row. The database keeps the latest HQ-visible result per organization:

| Part | What |
|---|---|
| Table `org_setup_health_sum_tr` (one row per organization) | `tenant_org_id` (PK, FK), `blocker_count`, `warning_count`, `info_count`, `error_count`, `checked_at`, full audit columns, RLS (tenant reads own row; HQ via service role) |
| Who writes it | HQ Setup Health loads refresh the counts after the flag / HQ-only filtering. A nightly HQ job refreshes all active organizations, so the list is never older than a day. Tenant reads never write it because tenant-visible counts intentionally exclude HQ-only checks. |
| HQ list | `findAll` joins the table: "Setup" column = blocker count (red) or warnings (amber) or ✓, with "checked at" on hover; filter `hasBlockers=true` → `blocker_count > 0`; sortable |
| Cost | List = one extra join. Nightly job ≈ 9 ms × organizations (1,000 organizations ≈ 9 s) |

- [x] Update STATUS.md + this list

**Step 5 — Tests (§5)**
- [x] Unit: flag / HQ-only / fix-permission filtering, summary counts
- [x] DB: tenant isolation per check function, dispatcher survives a throwing check, guard rejects a foreign tenant
- [x] Route: 401 / 403
- [x] UI: banner shows only failing `shows_banner` blockers
- [x] HQ service spec (`platform-api`)
- [x] Update STATUS.md + this list

**Step 6 — Docs**
- [x] `/documentation`: README, developer guide, user guide EN/AR, QA guide, `followups_by_user.md`
- [x] Update STATUS.md + this list + memory
