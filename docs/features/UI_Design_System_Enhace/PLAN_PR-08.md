# PR-08 — Feature Convergence, Table Density, Modal Hygiene, Extra Tenant Config & Cross-Repo HQ Catalog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Follow `AGENTS.md` (and `CLAUDE.md` where present), `docs/dev/rules/performance-engineering.md`, `docs/dev/rules/integration-contracts.md`, `/frontend`, `/backend`, `/database`, `/i18n`, and `/rebuild-ui-access-contract`. Steps use `- [ ]`. Tick each step immediately when verified, and update the **Progress** table below, `STATUS.md`, and `RESUME_CONTINUATION.md` at the end of **every task** (never batch updates at the end).

- **Date:** 2026-11-19
- **Status:** Proposed (Follow-up to `PR-01`, `PR-02`, `PR-04`, `PR-05`, `PR-07` + `PR-07-T6`)
- **Input Baseline:** `ui-design-system-audit-2026-11-19.md` (Score **7.8 / 10**, `pal=0`, `phys=0`, `legacyCompat=0`; remaining convergence gaps: **693** raw HTML `<button|input|select|table>` controls, **39** `fixed inset-0` overlays, `CmxCrudPageShell` on 15 sites, unwired `--cmx-row-h`/`--cmx-cell-px` density tokens in Cmx tables, `CmxWizard` hardcoded English strings, KPI `tabular-nums`, `<bdi>` coverage, and centralized GCC-first extra formatting/UI defaults).
- **Target Score:** **9.2+ / 10** across all 6 audit dimensions.
- **Spec Priority:** `THEMING_ARCHITECTURE_DESIGN.md` wins on design conflicts; `AGENTS.md` and `docs/dev/rules/integration-contracts.md` win on architecture, DB, security, and cross-repo rules.

---

## Progress

> **Mandatory rule:** At the end of each task, run that task's verification checks, mark its checkboxes `[x]`, and update this table, `STATUS.md`, and `RESUME_CONTINUATION.md` **before** starting the next task. A task is not `Done` until its progress row and docs are updated.

| Task | Scope | State | Date | Notes (checks run, migrations, rulings, open items) |
|---|---|---|---|---|
| **T1** | `src/ui/` polish (`CmxWizard` i18n, `tabular-nums`, logical `align`, density `--cmx-row-h`/`--cmx-cell-px`) | Done (checks passed) | 2026-11-19 | `CmxWizard` localized (`common.skip/complete/stepProgress`), `CmxPagination` `tabular-nums` + `pointer-coarse:min-h/w`, `CmxDataTable` logical `align` + density vars (`--cmx-row-h`, `--cmx-cell-px`), `CmxDataGrid`/`CmxEditableDataTable` density vars. Checks: ESLint 0, `check:i18n` PASS, `check:ui` 19 files 0/0, Jest 7/7 suites (34/34 tests). |
| **T2** | Dashboard KPI `tabular-nums`, Lucide icons in `OrderStatsCards`, semantic token parity | Done (checks passed) | 2026-11-19 | `DashboardContent` `tabular-nums` + `<bdi>`, `OrderStatsCards` Lucide icons, `CmxMoneyText` & `OrderWorkspaceScreen` `text-warning-text`/`text-success-text`/`text-info-text`. Checks: ESLint 0, `check:ui` 23 files 0/0, Jest 3/3 suites (23/23 tests). |
| **T3** | `CmxCrudPageShell` + `CmxDataTable` operational list convergence (`OrdersSimpleTable`, `GlInquiryTable`, etc.) | Done (checks passed) | 2026-11-19 | Migrated `OrdersSimpleTable`, `GlInquiryTable`, `B2BCustomersPage`, `B2BContractsPage`, `B2BStatementsPage` (both overdue & statements tables), and `UserRolesTab` (tenant & resource role tables) to `CmxDataTable` + `CmxStatusBadge` + `<bdi>` + `tabular-nums`, and wrapped B2B list routes in `CmxCrudPageShell`. Checks: ESLint 0, `check:ui` 29 files 0/0, `no-raw-classes` 3/3. |
| **T4** | `fixed inset-0` overlay triage & migration to `CmxDialog` / `CmxConfirmDialog` | Done (checks passed) | 2026-11-19 | Migrated all non-drawer feature overlays (`AmountMismatchDialog`, `AssemblyTaskModal`, `ReadyDatePickerModal`, `CustomItemModal`, `CustomerEditModal`, `ImportModal`, `ExportModal`, `UserModal`, `AddressFormModal`, `CustomerAddressesSection`, `UpgradeProfileModal`, `customers/CustomerCreateModal`, `orders/CustomerCreateModal`, `PermissionAssignmentModal`, `CustomerPickerModal` confirm dialog, `ExceptionDialog`, `TenantAdminSubscriptionScreen`, `settings/permissions`, `settings/roles`, `ready/[id]` print modal) to `CmxDialog`/`CmxConfirmDialog` + `Cmx*` controls; added `useFocusTrap`+`Escape`+scroll-lock to `OrderSummaryBottomSheet`, `ExplainDrawer`, `GlJournalDetailPanel`. Remaining `fixed inset-0` count = 0 hand-rolled feature modals (only 3 trapped drawers/sheet + debug inspector + out-of-scope payment rail). Checks: ESLint 0 errors across all 15 T4 files, `check:ui` 0 errors, Jest `__tests__/ui/` 41/41 suites (291/291 tests). |
| **T5** | Raw HTML control burn-down (`OrderSummaryPanel` + feature forms/POS targets) | Done (checks passed) | 2026-11-19 | `order-summary-panel.tsx` + 78+ feature/app files converted across Waves 1–3C (`CmxButton`, `CmxInput`, `CmxSelect`, `CmxCheckbox`, `CmxTextarea`, `Label`, `<bdi>`, `cmxMessage`); raw HTML tags in production `app/`+`src/features/` (excluding `jhtestui`, `-rprt.tsx`, `/print/`, `payment-full-view.tsx`, JSDoc, `type="hidden"/"file"`) dropped **693/739 → 46** (`< 50` target). Checks: ESLint 0 errors across all modified batches, `npm run check:ui` 167 files 0 errors, Jest `__tests__/ui/` 41/41 suites (291/291 tests). |
| **T6** | Extra Tenant Config DB (`sys_tenant_extra_config_cf` + `org_tenant_extra_config_cf`), resolver, APIs, formatter wiring & list-assisted UI | Done | 2026-11-20 | Migrations `0775` & `0776` applied; Prisma synced; constants, Zod, pure resolver, cached service (`catalogReadClient` + explicit `tenant_org_id`), API routes (`/api/v1/settings/extra-config*`), `format-money`/`rtl`/table/touch formatters, `/dashboard/settings/extra-config` UI, EN/AR i18n, access contract & nav complete. Final checks passed (`typecheck` 0, `eslint` 0, `check:i18n` PASS, `check:platform-info-inventories` drift 0 / 10 tests, scoped Jest 92/92 suites / 770 tests, `npm run build` exit 0 / 343 pages). |
| **T7** | BiDi (`<bdi>`) sweep, full performance/security/lint/i18n/build verification & QA guide | Done | 2026-11-20 | BiDi `<bdi dir="ltr">` sweep across receipts/B2B/ERP/refunds/pickers/dashboard + `<label>`/`<input>` burn-down (`NON_FORM_COUNT=40` < 50, `FIXED_INSET0_COUNT=4`); `QA_TEST_GUIDE.md` (`P1`–`P9`) updated; `typecheck` 0, `eslint . --quiet` 0, `check:i18n` PASS, `check:ui` 189 files / 0 errors, `check:platform-info-inventories` PASS (drift 0, 2/2 suites, 10/10 tests), scoped Jest 92/92 (770/770), `npm run build` exit 0 (0 warnings, 343/343 pages). |
| **T8** | Cross-Repo (`cleanmatexsaas` HQ): HQ management screen for `sys_tenant_extra_config_cf` catalog | Done | 2026-11-20 | Executed `cleanmatexsaas/docs/features/UI_Theme_Catalogs/PLAN_PR-08-HQ.md` (H1 `platform-api` `ExtraConfigController`/`ExtraConfigService` 8/8 Jest + build PASS; H2 `platform-web` `/products-items-config/extra-config` + dynamic bilingual option-list builder + hub card + EN/AR i18n: `check:i18n` PASS, `tsc --noEmit` 0, scoped `eslint` 0, Jest 2/2, `platform-web` build 191/191 PASS). |

States: `Not started` → `In progress` → `Blocked (explain why)` → `Done (checks passed)`.

---

## Global Constraints & Engineering Standards

1. **Repository & Cross-Repo Ownership (`AGENTS.md` + `integration-contracts.md`):**
   - `cleanmatex` owns **all SQL migrations** (`supabase/migrations/`). `cleanmatexsaas` never creates migrations.
   - Never modify existing migrations; inspect `supabase/migrations/` for the latest sequence number before creating new SQL files; **never auto-apply migrations** (create SQL files, stop, and wait for owner review before running `npm run prisma:pull`).
   - Every DB object name (`table`, `constraint`, `index`, `fk`, `policy`, `function`, `trigger`) must be **≤ 30 characters**, `TEXT` instead of `VARCHAR`, standard audit/soft-delete columns, bilingual `name`/`name2` + `description`/`description2`, and complete PostgreSQL `COMMENT ON` metadata.
   - Public-Key Grants: `sys_tenant_extra_config_cf` stays closed to `anon`/`authenticated` (server reads via `catalogReadClient`). `org_tenant_extra_config_cf` uses RLS with `(SELECT current_tenant_id())` (1× per statement) and **every `org_*` query/write explicitly includes `tenant_org_id`**.
2. **Performance Engineering (`docs/dev/rules/performance-engineering.md`):**
   - Share per-request extra config via React `cache()` (`getRequestExtraConfig()`) and batch alongside `getRequestTheme()` with `Promise.all`—zero N+1 queries per widget or table.
   - Keep pure config merge logic (`resolveExtraConfig`) separate from Prisma/Supabase I/O (`tenant-extra-config.service.ts`).
   - Distinguish failed required DB reads from empty tenant overrides (never persist an invented fallback back to DB; log failures cleanly and fall back in memory only for non-financial display defaults).
   - Authenticated config endpoints return `Cache-Control: private, no-store`; after mutations, refresh server RSC trees (`router.refresh()`) and invalidate React Query caches.
3. **UI, Feedback, Navigation & RBAC Rules (`AGENTS.md`):**
   - Cmx components only (`@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`, `@ui/data-display`, `@ui/navigation`, `@ui/patterns`); `cmxMessage` / `useMessage()` for all save/error/confirm feedback.
   - Zero raw Tailwind palette colors (`pal=0`) and zero physical directional CSS classes (`phys=0`).
   - Check `docs/dev/i18n_docs/GLOSSARY.md` before adding/updating keys in `web-admin/messages/en/**` and `web-admin/messages/ar/**`.
   - New permissions require a dedicated SQL migration (`resource:action` lowercase regex); new sidebar routes require dual-write (`web-admin/config/navigation.ts` + `sys_components_cd` migration); dashboard routes require the `ui-access-contract` golden path + `rebuild:platform-info-inventories`.
4. **Preserved Decisions (`STATUS.md`):**
   - Do **not** split `payment-full-view.tsx` here (tracked in Order Fin).
   - Do **not** remove `@mdi/font` (required for DB-stored service/preference MDI icon classes rendered via `isSafeMdiIconClass`).
   - Keep print report templates (`*-rprt.tsx`) readable in light/print mode.

---

## Goals

1. Close every remaining `src/ui/` micro-gap (`CmxWizard` i18n, `CmxKpiStatCard` & `CmxPagination` `tabular-nums`, `CmxPagination` coarse-pointer 44px touch targets, `CmxDataTable` logical `align`).
2. Wire `[data-density=COMFORTABLE|COMPACT]` CSS tokens (`--cmx-row-h`, `--cmx-cell-px`) into `CmxDataTable`, `CmxDataGrid`, and `CmxEditableDataTable`.
3. Converge operational CRUD/list screens onto `CmxCrudPageShell` and `CmxDataTable` (`OrdersSimpleTable`, `GlInquiryTable`, `UserRolesTab`, B2B statements).
4. Migrate all non-shell feature `fixed inset-0` overlays onto `CmxDialog` / `CmxConfirmDialog` with verified Escape/focus-trap/scroll-lock behavior.
5. Burn down the **693** raw `<button|input|select|table>` controls in `src/features/**` and `app/**`, starting with POS high-frequency inputs and `32px`/`44px` stepper targets.
6. Build an end-to-end, multi-tenant, list-assisted **Extra Tenant Configuration** subsystem (`sys_tenant_extra_config_cf` + `org_tenant_extra_config_cf` + resolver + APIs + formatter wiring + `/dashboard/settings/extra-config` + `cleanmatexsaas` HQ catalog plan), defaulting GCC-first to `123` Western digits (`LATN`).
7. Complete a BiDi (`<bdi>`) sweep and pass all lint, i18n, Jest, build, and manual QA gates.

---

## Detailed Execution Plan

### Task 1 — `src/ui/` Final Polish & Table Density Activation

- [x] **1.1 Localize `CmxWizard` (`web-admin/src/ui/patterns/cmx-wizard.tsx`)**
  - Check `docs/dev/i18n_docs/GLOSSARY.md` and `web-admin/messages/{en,ar}/common*`; reuse/add `common.back`, `common.next`, `common.skip`, `common.complete`, `common.optional`, and step-progress formatting key.
  - Replace hardcoded strings at lines 94, 106, 139, and 146–147 with `tCommon(...)`.
  - Add/update Jest test covering EN + AR/RTL rendering.

- [x] **1.2 `tabular-nums` & Touch Targets on `CmxKpiStatCard` and `CmxPagination`**
  - Add `tabular-nums` (or `cmx-type-kpi` where sized) to `web-admin/src/ui/data-display/cmx-kpi-stat-card.tsx` (line 43).
  - In `web-admin/src/ui/navigation/cmx-pagination.tsx`, add `tabular-nums` to range info (lines 85, 152) and page numbers (line 198), and add `pointer-coarse:min-h-[var(--cmx-touch-min)] pointer-coarse:min-w-[var(--cmx-touch-min)]` alongside `h-8 w-8` on pagination buttons.

- [x] **1.3 Logical Alignment Prop in `CmxDataTable`**
  - Expand `CmxDataTableSimpleColumn['align']` in `web-admin/src/ui/data-display/cmx-datatable.tsx` (line 70) to `'start' | 'center' | 'end' | 'left' | 'right'`, mapping `'left' -> 'start'` and `'right' -> 'end'` via `text-start` / `text-end` (`@deprecated` JSDoc on `'left'`/`'right'`).

- [x] **1.4 Wire `--cmx-row-h` & `--cmx-cell-px` Density Tokens in Data Grids**
  - Bind `[data-density]` tokens into `cmx-datatable.tsx`, `cmx-data-grid.tsx`, and `cmx-editable-datatable.tsx` rows/cells (preserving explicit per-grid `density` overrides).
  - Verify visually and via unit tests that switching `COMFORTABLE` ↔ `COMPACT` adjusts table row height and inline cell padding.

- [x] **1.5 Task 1 Verification & Status Update**
  - Run `cd web-admin && npx eslint src/ui/ --quiet && npm run check:i18n` and Jest `__tests__/ui/`.
  - Tick steps 1.1–1.5, update `## Progress` (T1 → `Done`), `STATUS.md`, and `RESUME_CONTINUATION.md`.

---

### Task 2 — Dashboard KPI, Status Token & Icon Consistency

- [x] **2.1 Standardize `DashboardContent` KPI Cards (`web-admin/src/features/dashboard/ui/DashboardContent.tsx`)**
  - Add `tabular-nums` (or `cmx-type-kpi`) to lines 75, 82, and 89, and wrap mixed LTR/currency values with `<bdi>` where needed.

- [x] **2.2 Replace Unicode Emojis in `OrderStatsCards` (`web-admin/src/features/orders/ui/order-stats-cards.tsx`)**
  - Replace `'📦'`, `'⏳'`, `'🔄'`, `'✅'`, `'🚚'`, `'📫'`, `'⚠️'` (lines 29–65) with `lucide-react` icons (`Package`, `Clock`, `RefreshCw`, `CheckCircle2`, `Truck`, `MailCheck`, `AlertTriangle`, `aria-hidden="true"`) so rendering is deterministic across Windows, macOS, and POS Android tablets in light & dark mode.

- [x] **2.3 Unify Remaining Inline `rgb(var(--cmx-*-dark-rgb))` References**
  - Replace inline `text-[rgb(var(--cmx-warning-dark-rgb...))]` / `text-[rgb(var(--cmx-success-dark-rgb...))]` in `cmx-money-text.tsx` (lines 47–48) and `order-workspace-screen.tsx` (line 307) with Tailwind semantic tokens (`text-warning-text`, `text-success-text`), keeping >= 4.5:1 contrast in light & dark modes per `status-tokens.test.ts`.

- [x] **2.4 Task 2 Verification & Status Update**
  - Run `cd web-admin && npx eslint src/features/dashboard/ src/features/orders/ src/ui/data-display/cmx-money-text.tsx --quiet` and scoped Jest tests (`status-tokens.test.ts`, dashboard/orders UI tests).
  - Tick steps 2.1–2.4, update `## Progress` (T2 → `Done`), `STATUS.md`, and `RESUME_CONTINUATION.md`.

---

### Task 3 — `CmxCrudPageShell` & `CmxDataTable` Operational List Convergence

- [x] **3.1 Roll Out `CmxCrudPageShell` Across Dashboard List Routes**
  - Audited `web-admin/app/dashboard/**/page.tsx` list/CRUD routes lacking `CmxCrudPageShell` and standardized B2B list workspaces (`b2b/customers`, `b2b/contracts`, `b2b/statements`) onto `CmxCrudPageShell` (`title`, `actions`, `children`).

- [x] **3.2 Migrate Operational Raw `<table>` Screens to `CmxDataTable`**
  - Migrated interactive operational tables preserving URL search/pagination contracts and explicit `tenant_org_id` scopes:
    1. `web-admin/src/features/orders/ui/orders-simple-table.tsx` (URL `?page=` paging, row click, `CmxStatusBadge`, `<bdi>` + `tabular-nums`).
    2. `web-admin/src/features/erp-lite/ui/gl-inquiry-table.tsx` (`?journalId=` highlight, `CmxStatusBadge` DR/CR, `CmxEmptyState`, `<bdi>` + `tabular-nums`).
    3. `web-admin/src/features/users/ui/rbac/user-roles-tab.tsx` and `web-admin/app/dashboard/b2b/{customers,contracts,statements}/page.tsx`.
  - Kept print-only report views (`*-rprt.tsx`) and Order Fin scoped sub-tables untouched.

- [x] **3.3 Task 3 Verification & Status Update**
  - Run `cd web-admin && npx eslint . --quiet` and scoped Jest/Playwright tests for orders, ERP-Lite GL, users, and B2B statements.
  - Tick steps 3.1–3.3, update `## Progress` (T3 → `Done`), `STATUS.md`, and `RESUME_CONTINUATION.md`.

---

### Task 4 — `fixed inset-0` Overlay Audit & Migration to `CmxDialog`

- [x] **4.1 Triage & Migrate Feature `fixed inset-0` Overlays**
  - Keep intentional shell/primitive backdrops (`cmx-dialog.tsx`, `cmx-alert-dialog.tsx`, `cmx-sidebar.tsx` mobile drawer, `cmx-language-switcher.tsx`).
  - Migrate all **feature modals/drawers** onto `CmxDialog` / `CmxConfirmDialog` (gaining portal, focus trap, Escape handling, body scroll lock, and `stackAboveModals`):
    - **Batch A (Settings, Auth & Users):** `app/dashboard/settings/permissions/page.tsx`, `app/dashboard/settings/roles/page.tsx`, `features/auth/ui/PermissionAssignmentModal.tsx`, `features/users/ui/user-modal.tsx`, `features/settings/ui/explain-drawer.tsx`, `features/tenant-admin/ui/subscription/tenant-admin-subscription-screen.tsx`.
    - **Batch B (Orders, Ready & Assembly):** `features/assembly/ui/assembly-task-modal.tsx`, `features/assembly/ui/exception-dialog.tsx`, `app/dashboard/ready/[id]/page.tsx`, `features/orders/ui/ready-date-picker-modal.tsx`, `features/orders/ui/OrderSummaryBottomSheet.tsx`, `features/orders/ui/customer-edit-modal.tsx`, `features/orders/ui/customer-picker-modal.tsx`, `features/orders/ui/customer-create-modal.tsx`, `features/orders/ui/amount-mismatch-dialog.tsx`, `features/orders/ui/components/custom-item-modal.tsx`.
    - **Batch C (Customers, Catalog & ERP-Lite):** `features/customers/ui/address-form-modal.tsx`, `features/customers/ui/upgrade-profile-modal.tsx`, `features/customers/ui/customer-create-modal.tsx`, `features/customers/ui/customer-addresses-section.tsx`, `features/catalog/ui/import-modal.tsx`, `features/catalog/ui/export-modal.tsx`, `features/erp-lite/ui/gl-journal-detail-panel.tsx`.
  - Verify `Escape`, `Tab` trap, RTL header/footer alignment, and focus return on each batch.

- [x] **4.2 Task 4 Verification & Status Update**
  - Re-scan `fixed inset-0` count across `app/` & `src/` and verify only justified shell/primitive backdrops remain; run ESLint + modal tests.
  - Tick steps 4.1–4.2, update `## Progress` (T4 → `Done`), `STATUS.md`, and `RESUME_CONTINUATION.md`.

---

### Task 5 — Raw HTML Control Burn-Down (`693` → Target `< 50` Justified Cases)

- [x] **5.1 POS & High-Frequency Input Upgrade (`order-summary-panel.tsx`)**
  - Replace raw `<input type="number">` (line 451) and `<textarea>` (line 487) with `CmxInput` / `CmxTextarea` while keeping POS numeric/keyboard ergonomics.
  - Upgrade Quick Drop `-`/`+` steppers (lines 510, 527) from `h-6 w-6` (`24px`) to `h-8 w-8` (`32px`) on desktop while keeping `TOUCH_MIN` (`44px`) on `pointer-coarse`.

- [x] **5.2 Batch Feature Sweep (`<button>`, `<input>`, `<select>`)**
  - Audit all **693** raw `<button|input|select|table>` sites in `src/features/**` and `app/**` folder-by-folder (`orders`, `customers`, `catalog`, `settings`, `users`, `erp-lite`, `billing`, `workflow`, `assembly`, `inventory`).
  - Replace raw `<button>` → `CmxButton`, raw `<input>` → `CmxInput` / `CmxCheckbox` / `CmxRadio`, raw `<textarea>` → `CmxTextarea`, raw `<select>` → `CmxSelect` / `CmxSelectDropdown`.
  - Document justified exceptions (hidden `<input type="file">`, print templates) and add a scoped ESLint `warn` (or `error`) guard in `eslint.config.mjs` if count reaches near-zero.

- [x] **5.3 Task 5 Verification & Status Update**
  - Re-count `rawHtml` across `app/` & `src/`, run `npx eslint . --quiet` + affected Jest suites.
  - Tick steps 5.1–5.3, update `## Progress` (T5 → `Done`), `STATUS.md`, and `RESUME_CONTINUATION.md`.

---

### Task 6 — Extra Tenant Configuration (`sys_tenant_extra_config_cf` + `org_tenant_extra_config_cf`), Backend APIs & List-Assisted Screen

> **Database & Separation-of-Concerns Protocol:** Author clean, additive SQL migrations in `cleanmatex/supabase/migrations/` using the live latest sequence number. Stop and get owner review + migration execution + `npm run prisma:pull` before proceeding to steps 6.3–6.5. Never rely on RLS alone—filter every `org_*` query explicitly by `tenant_org_id`.

- [x] **6.1 Migration A — `sys_tenant_extra_config_cf` (Global Preferred Defaults & Curated Option Lists)**
  - Create `public.sys_tenant_extra_config_cf` (26 chars, `<= 30` char limit; constraint/index names `<= 30` chars: `pk_sys_tnt_extra_cfg_cf`, `ck_stec_key`, `ck_stec_vtype`, `ck_stec_rec_status`, `idx_stec_cat_order`):
    - `config_key` (`TEXT PRIMARY KEY`, `UPPER_SNAKE_CASE` regex `^[A-Z][A-Z0-9_]{1,49}$`)
    - `category_code` (`TEXT NOT NULL` — e.g. `NUMBERS_AND_DATES`, `TABLES_AND_DENSITY`, `POS_ERGONOMICS`, `ACCESSIBILITY`)
    - Bilingual metadata: `name TEXT NOT NULL`, `name2 TEXT NULL`, `description TEXT NULL`, `description2 TEXT NULL`
    - Validation & list-assisted UI schema:
      - `value_type` (`TEXT NOT NULL CHECK (value_type IN ('SELECT', 'BOOLEAN', 'NUMBER', 'TEXT'))`)
      - `default_value` (`TEXT NOT NULL`)
      - `allowed_values_json` (`JSONB NULL` — array of `{ "value": string, "label": string, "label2": string, "description"?: string, "description2"?: string }` driving dropdown/radio option lists in the UI and strict allowlist checks on the backend)
      - `validation_regex` (`TEXT NULL`), `min_num` (`NUMERIC NULL`), `max_num` (`NUMERIC NULL`)
    - Governance: `is_editable_by_tenant` (`BOOLEAN NOT NULL DEFAULT true`), `plan_flag_key` (`TEXT NULL`), plus standard audit & soft-delete columns (`created_*`, `updated_*`, `deleted_*`, `rec_status`, `rec_order`, `rec_notes`, `is_active`) and `updated_at`/`updated_count` trigger.
  - Seed preferred GCC-first default rows + rich `allowed_values_json` lists (EN + AR labels & helper notes):
    1. `NUMBER_SCRIPT` — default `'LATN'` (`LATN` = `1234567890 (Western / GCC Standard)`, `ARAB` = `١٢٣٤٥٦٧٨٩٠ (Eastern Arabic)`)
    2. `DATE_DIGITS` — default `'LATN'` (`LATN` = `Latin Digits (19 Nov 2026)`, `ARAB` = `Arabic Digits`)
    3. `NUMBER_GROUPING_LOCALE` — default `'EN_US'` (`EN_US` = `1,234.500 (Dot decimal, comma grouping)`, `AR_LATN` = `Locale punctuation with Latin digits`, `AR_NATIVE` = `Locale punctuation & digits`)
    4. `BDI_ISOLATION_ENABLED` — default `'TRUE'` (`TRUE`, `FALSE` — wraps phone/email/SKU/order-no in `<bdi dir="ltr">`)
    5. `DEFAULT_TABLE_PAGE_SIZE` — default `'10'` (`10`, `20`, `30`, `50`, `100`)
    6. `TABLE_DENSITY_OVERRIDE` — default `'INHERIT'` (`INHERIT` = `Follow user/theme appearance`, `COMFORTABLE`, `COMPACT`)
    7. `SHOW_CURRENCY_CODE_IN_TABLES` — default `'TRUE'` (`TRUE`, `FALSE`)
    8. `POS_STEPPER_MIN_TARGET` — default `'ADAPTIVE'` (`ADAPTIVE` = `44px touch / 32px desktop`, `ALWAYS_TOUCH_44` = `Always 44px touch-first`)
  - Add complete `COMMENT ON` metadata for table, columns, constraints, indexes, and trigger.
  - Revoke `anon`/`authenticated` access per **Public-key grants** (`catalogReadClient` / service-role reads only).

- [x] **6.2 Migration B — `org_tenant_extra_config_cf`, Permissions & Navigation Seed**
  - Create `public.org_tenant_extra_config_cf` (27 chars, `<= 30` char limit; short names `pk_org_tnt_extra_cfg_cf`, `uq_otec_id_tenant`, `uq_otec_tnt_key`, `fk_otec_tenant`, `fk_otec_sys_key`, `ck_otec_rec_status`):
    - `id UUID NOT NULL DEFAULT gen_random_uuid()`, `tenant_org_id UUID NOT NULL`, `config_key TEXT NOT NULL`, `config_value TEXT NOT NULL`
    - `CONSTRAINT uq_otec_id_tenant UNIQUE (id, tenant_org_id)` (Prisma-safe composite key)
    - Active partial unique index `uq_otec_tnt_key ON (tenant_org_id, config_key) WHERE rec_status = 1 AND is_active`
    - FKs: `tenant_org_id -> org_tenants_mst(id) ON DELETE RESTRICT`, `config_key -> sys_tenant_extra_config_cf(config_key) ON UPDATE RESTRICT ON DELETE RESTRICT`
    - Standard audit/soft-delete columns + `updated_at`/`updated_count` trigger + complete `COMMENT ON` metadata.
  - Enable RLS + `GRANT SELECT` to `authenticated` + scalar-wrapped policy `tenant_org_id = (SELECT current_tenant_id())` (1× per statement; verify with `supabase/checks/rls_unwrapped_auth_helpers.sql` = 0 rows).
  - Add dedicated permission seed migration if introducing new codes (`settings:extra_config_read`, `settings:extra_config_manage` or confirm reuse of `settings:read` / `settings:update` per RBAC convention) + `sys_components_cd` navigation row if adding a sidebar sub-item under Settings.
  - **STOP:** Ask owner to review and apply migrations, then run `npm run prisma:pull` from repo root.

- [x] **6.3 Domain Constants, Zod Validation, Pure Resolver & Cached Server Service**
  - Create `web-admin/lib/constants/tenant-extra-config.ts` mirroring `config_key`, `category_code`, and option values in exact UPPERCASE matching DB seeds (Rule #12), plus `DEFAULT_EXTRA_CONFIG`.
  - Create `web-admin/lib/types/tenant-extra-config.ts` and Zod schemas in `web-admin/lib/validations/tenant-extra-config.ts` (strict allowlist + payload size bounds).
  - Create pure, dependency-free `web-admin/lib/config/resolve-extra-config.ts` (`resolveExtraConfig(catalogRows, orgOverrides, planFlags)` → typed effective config + per-key metadata `{ effectiveValue, isOverridden, source: 'SYSTEM' | 'TENANT', options }`), unit-tested standalone without DB.
  - Create `web-admin/lib/services/tenant-extra-config.service.ts`:
    - Reads `sys_tenant_extra_config_cf` via `catalogReadClient` (graceful error logging on catalog read failure; strict errors on mutation).
    - Reads/writes `org_tenant_extra_config_cf` with **explicit `tenant_org_id`** filtering on every query/upsert/soft-delete.
    - Enforces `is_editable_by_tenant`, `plan_flag_key` (`checkPlanFlag`), `value_type`, `allowed_values_json`, `validation_regex`, `min_num`/`max_num` on every write inside a Prisma transaction.
    - Exposes `getRequestExtraConfig()` wrapped in React `cache()` for zero duplicate per-request DB work (`getRequestTheme()` + `getRequestExtraConfig()` batched via `Promise.all` in `app/layout.tsx`).

- [x] **6.4 Wire Resolved Config into Formatters, Tables & Request Context**
  - Update `web-admin/lib/money/format-money.ts` (`resolveMoneyIntlLocale` + formatting helpers) and date/time formatting helpers to accept/read `NUMBER_SCRIPT`, `DATE_DIGITS`, and `NUMBER_GROUPING_LOCALE` (defaulting to `'LATN'` / `'EN_US'` so Arabic displays `123` unless tenant explicitly overrides to `ARAB`).
  - Provide `ResolvedExtraConfig` via lightweight client context (`TenantExtraConfigProvider` in `AppProviders.tsx`) without shipping raw catalog JSON on every route; wire `DEFAULT_TABLE_PAGE_SIZE`, `SHOW_CURRENCY_CODE_IN_TABLES`, `BDI_ISOLATION_ENABLED`, and `POS_STEPPER_MIN_TARGET`.
  - Add unit tests verifying `LATN` vs `ARAB` formatting, `EN_US` vs `AR_LATN` grouping, and non-throwing fallback when `org_tenant_extra_config_cf` has zero rows.

- [x] **6.5 API Endpoints, List-Assisted Settings Screen, Access Contract & Navigation**
  - Create thin authenticated endpoints under `web-admin/app/api/v1/settings/extra-config/`:
    - `GET /api/v1/settings/extra-config` (`settings:read` / RBAC guard, `Cache-Control: private, no-store`) returning grouped catalog metadata + curated `allowed_values_json` option lists + tenant overrides + effective values.
    - `PUT /api/v1/settings/extra-config` (RBAC guard + CSRF + rate limit + Zod schema) saving allowlisted key/value overrides in one transaction.
    - `DELETE /api/v1/settings/extra-config/[key]` (soft-delete/deactivate tenant override to restore `sys_tenant_extra_config_cf` default).
  - Build `web-admin/app/dashboard/settings/extra-config/page.tsx` + `web-admin/src/features/settings/ui/extra-config/` (`extra-config-screen.tsx`, `extra-config-field-row.tsx`, `extra-config-preview.tsx`):
    - Render inside `CmxCrudPageShell` + grouped `CmxFormSection` cards by `category_code`.
    - **List-assisted input rendering:**
      - `SELECT` (4+ choices) → `CmxSelectDropdown` populated directly from `allowed_values_json` (bilingual `label`/`label2` + option `description`/`description2` + visual indicator on the System Default item).
      - `SELECT` (2–3 choices) → `CmxRadioGroup` or `CmxSelectDropdown` with option descriptions.
      - `BOOLEAN` → `CmxSwitch` with curated `allowed_values_json` ON/OFF labels.
      - `NUMBER` / `TEXT` → `CmxInput` with inline bounds/regex validation and helper hint showing default.
    - Show per-field `CmxStatusBadge` (`System Default` vs `Custom Override`), one-click **Reset to Default** (`CmxButton`), **Reset All to Defaults** (`CmxConfirmDialog`), and live **GCC Formatting Preview** (`12.500 OMR`, localized date, `<bdi>` phone, table row density preview).
    - Trigger `router.refresh()` + React Query invalidation + `cmxMessage.success(...)` on save/reset.
  - Add EN/AR translations (`web-admin/messages/{en,ar}/settings*.json`, checked against `GLOSSARY.md`), dual-write `web-admin/config/navigation.ts` (if sidebar link added), run `ui-access-contract` golden path + `npm run rebuild:platform-info-inventories`.

- [x] **6.6 Task 6 Verification & Status Update**
  - Run tests first (RED→GREEN): pure resolver tests, service tenant-isolation & validation tests, route auth/CSRF/RBAC tests, `format-money.ts` digit script tests, settings screen list-rendering & reset tests, plus `supabase/checks/rls_unwrapped_auth_helpers.sql` = 0 rows.
  - Run `npx eslint . --quiet`, `npm run check:i18n`, `npm run check:platform-info-inventories`, and `npm run build`.
  - Tick steps 6.1–6.6, update `## Progress` (T6 → `Done`), `STATUS.md`, and `RESUME_CONTINUATION.md`.

---

### Task 7 — BiDi (`<bdi>`) Sweep & Full Verification Gate

- [x] **7.1 BiDi Isolation Sweep (`<bdi>`)**
  - Audit phones, emails, SKU/item codes, order numbers (`order_no`), and inline amounts across `orders`, `customers`, `dashboard`, `erp-lite`, and `billing`.
  - Wrap mixed-direction LTR tokens in `<bdi dir="ltr">` (respecting `BDI_ISOLATION_ENABLED` where configurable, keeping `<bdi dir="ltr">` default on numbers/phones/codes in Arabic).

- [x] **7.2 Final Codebase Scan, Performance Check & Documentation**
  - Run `cd web-admin && npx eslint . --quiet` → **0 errors**.
  - Run `cd web-admin && npm run check:i18n` → **0 missing/mismatched keys**.
  - Run `cd web-admin && npm run check:ui` (if present) and scoped Jest suites (`__tests__/ui/**`, `__tests__/lib/**`, `__tests__/services/**`, `__tests__/api/**`, `__tests__/features/settings/**`, `__tests__/features/orders/**`) → **100% pass**.
  - Run `cd web-admin && npm run build` → **exit 0**.
  - Re-run codebase scan (`pal=0`, `phys=0`, `legacyCompat=0`, confirm `rawHtml < 50`, `fixedInset0` cleaned, `crudShell`, `tabular-nums`, `bdi` improved).
  - Update `QA_TEST_GUIDE.md` with PR-08 manual QA checklist (light/dark, EN/AR RTL, COMFORTABLE/COMPACT density, modal traps, extra config list-assisted overrides + reset + `123` vs `١٢٣` verification).
  - Tick steps 7.1–7.2, update `## Progress` (T7 → `Done`), `STATUS.md`, and `RESUME_CONTINUATION.md`.

---

### Task 8 — Cross-Repo (`cleanmatexsaas` HQ Console): Manage `sys_tenant_extra_config_cf` Catalog

> **Cross-Repo Boundary (`AGENTS.md` + `integration-contracts.md`):** This task is authored and executed in `cleanmatexsaas` **after** Task 6 migrations (`07xx`) are applied in the shared database. `cleanmatexsaas` creates **zero** SQL migrations; it reads/writes `sys_tenant_extra_config_cf` via HQ service-role APIs in the pattern of `cleanmatexsaas/docs/features/UI_Theme_Catalogs/PLAN_PR-07-HQ.md`.

- [x] **8.1 HQ Plan & Catalog Management Plan Authored (`cleanmatexsaas`)**
  - Created `cleanmatexsaas/docs/features/UI_Theme_Catalogs/PLAN_PR-08-HQ.md` (`Status: Proposed`) matching HQ patterns (`products-items-config` / `ui-themes`).
  - Covers HQ admin service + API endpoints to list, create, update, activate/deactivate (`is_active`, `rec_status`) rows in `sys_tenant_extra_config_cf`, edit preferred `default_value`, and manage `allowed_values_json` option lists (validating that `default_value` is always present in `allowed_values_json` when `value_type === 'SELECT'`), and disallows hard deletion when referenced by `org_tenant_extra_config_cf`.

- [x] **8.2 HQ Catalog Screen & Cross-Repo Verification**
  - Built `/products-items-config/extra-config` (`HqExtraConfigScreen` + `HqExtraConfigEditorDialog` with bilingual EN/AR fields, list-assisted `default_value` picker, and dynamic `allowed_values_json` Option List Builder) linked from `PicHubScreen` and guarded by `catalog.view` / `catalog.manage`.
  - Verified `platform-api` (Jest `extra-config.service.spec.ts` 8/8, `nest build` exit 0) and `platform-web` (`check:i18n` PASS, `tsc --noEmit` exit 0, scoped `eslint` 0, Jest `hq-extra-config-screen.test.tsx` 2/2, `next build` 191/191 exit 0).
  - Tick steps 8.1–8.2, update `## Progress` (T8 → `Done`), `STATUS.md`, and `RESUME_CONTINUATION.md` in both repos.

---

## Acceptance Criteria

| Criterion | Target |
|---|---|
| Tailwind raw palette (`pal`) & physical CSS (`phys`) & legacy compat imports | **0** / **0** / **0** |
| Hardcoded English UI strings in `src/ui/**` (`CmxWizard`, `CmxPagination`, etc.) | **0** |
| `[data-density]` (`--cmx-row-h`, `--cmx-cell-px`) in Cmx tables | Visibly resizes row height & cell padding across `CmxDataTable`, `CmxDataGrid`, `CmxEditableDataTable` |
| Un-trapped feature `fixed inset-0` custom modals | **0** (all feature dialogs on `CmxDialog` / `CmxConfirmDialog`) |
| Raw HTML `<button\|input\|select\|table>` outside print templates & hidden file inputs | Reduced from **693** to **< 50** justified cases |
| Numeric KPIs & operational amounts with `tabular-nums` | **100%** across Dashboard, Orders, ERP-Lite, and POS |
| `sys_tenant_extra_config_cf` + `org_tenant_extra_config_cf` | SQL migrations `<= 30` char identifiers, `COMMENT ON` metadata, closed public grants on `sys_*`, scalar-subquery RLS + explicit `tenant_org_id` filters, request-cached resolver, curated `allowed_values_json` lists in `/dashboard/settings/extra-config`, GCC-first `123` (`LATN`) defaults |
| Progress & cross-repo discipline | `## Progress` table, `STATUS.md`, and `RESUME_CONTINUATION.md` updated after **every** task; HQ catalog plan tracked in `cleanmatexsaas` |
| Static & build checks (`eslint`, `check:i18n`, `check:platform-info-inventories`, Jest, `npm run build`) | All **PASS** |
