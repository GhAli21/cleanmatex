# Production-ready plan: High-priority deferred items (TODO docs)

**Source:** [Plans_For_Remaining/README.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/Plans_For_Remaining/README.md) — items marked **High** and **Pending**.

**Scope:** (1) Piece history, (2) Dashboard KPI widgets (+ Top Services gap), (3) Settings Users / team management.

**Standards (mandatory):**

- Load and follow project skills before coding: `/database`, `/multitenancy`, `/frontend`, `/i18n`, `/implementation`; for permissions-gated routes/APIs: `/rebuild-ui-access-contract` ([.codex/skills/rebuild-ui-access-contract/SKILL.md](file:///F:/jhapp/cleanmatex/.codex/skills/rebuild-ui-access-contract/SKILL.md)).
- **Migrations:** new file only under `supabase/migrations/`; never edit applied migrations; **do not apply** migrations via agent — user reviews and applies ([CLAUDE.md](file:///F:/jhapp/cleanmatex/CLAUDE.md)).
- **Tenant isolation:** every `org_*` query filters by `tenant_org_id`; RLS on new tables.
- **web-admin UI:** Cmx imports only (`@ui/primitives`, etc.); replace raw alert/confirm with design-system dialogs/toasts where you touch the screen ([.cursor/rules/web-admin-ui-imports.mdc](file:///F:/jhapp/cleanmatex/.cursor/rules/web-admin-ui-imports.mdc)).
- **i18n:** EN/AR, no new user-visible hardcoded strings; reuse keys; `npm run check:i18n` after changes.
- **Verification:** `cd web-admin && npm run build` after frontend changes; update permission/docs if routes or gates change ([docs/platform/permissions/](file:///F:/jhapp/cleanmatex/docs/platform/permissions/)).

---

## Cross-project note (Users — invite / password reset)

[`web-admin/lib/api/users.ts`](file:///F:/jhapp/cleanmatex/web-admin/lib/api/users.ts) routes **all** user management through **platform-api** (`rbacFetch`). `resetUserPassword` is an explicit stub (always fails). `createUser` expects `CreateUserData` including **`password`**.

**Production closure requires one of:**

- **A (preferred):** Implement `POST .../invite` and `POST .../reset-password` (or equivalent) on **platform-api** ([cleanmatexsaas](file:///F:/jhapp/cleanmatexsaas)) and extend `lib/api/users.ts` to call them; **or**
- **B:** Document and implement an approved **web-admin BFF** pattern (Next route + service role) only if it matches security/ADR rules — avoid duplicating auth logic without an ADR.

This plan lists cleanmatex work **and** flags sibling API work so there are no hidden gaps.

---

## Stream 1 — Piece history (audit trail)

**Goal:** [`PieceHistory.tsx`](file:///F:/jhapp/cleanmatex/web-admin/src/features/orders/ui/PieceHistory.tsx) loads real history; all writes tenant-scoped; no orphan history rows.

### 1.1 Data model

- Add table (new migration) — align name with existing pieces table **[`org_order_item_pieces_dtl`](file:///F:/jhapp/cleanmatex/supabase/migrations/0073_org_order_item_pieces_dtl.sql)** (deferred doc referenced `org_order_pieces_dtl`; use actual FK target).
- Suggested name: `org_order_piece_hist_tr` or per your 30-char naming — columns at minimum: `id`, `tenant_org_id`, `order_piece_id` (FK to piece row), `action_code`, `from_value`, `to_value`, `done_by`, `done_at`, `notes`, standard audit fields per `/database`.
- **RLS:** tenant-scoped policies mirroring sibling `org_order_item_pieces_dtl` patterns ([0081_comprehensive_rls_policies.sql](file:///F:/jhapp/cleanmatex/supabase/migrations/0081_comprehensive_rls_policies.sql)).
- Indexes: `(tenant_org_id, order_piece_id)`, `(order_piece_id, done_at DESC)`.

### 1.2 Instrumentation (no missed paths)

- **Primary:** [`OrderPieceService.updatePiece`](file:///F:/jhapp/cleanmatex/web-admin/lib/services/order-piece-service.ts) — after successful update, if `piece_status` / `is_ready` / materially relevant fields changed, insert history row (same transaction if using RPC, or ordered operations with rollback strategy).
- **Also:** [`batch-update` route](file:///F:/jhapp/cleanmatex/web-admin/app/api/v1/orders/[id]/batch-update/route.ts) — any path that updates `org_order_item_pieces_dtl` without going through `OrderPieceService` must either call shared “record piece history” helper or gain a DB trigger.
- **Decision gate:** Prefer **one** mechanism (service helper vs trigger) to avoid double rows; document in migration comment **why**.

### 1.3 API

- `GET` route under existing orders API prefix, e.g. `app/api/v1/orders/.../pieces/[pieceId]/history/route.ts` (mirror plan in [01_piece_history.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/Plans_For_Remaining/01_piece_history.md)).
- Guard with same permission model as piece update (`orders:read` or stricter if already used for order detail).
- Validate piece belongs to tenant + order; return ordered history DTO.

### 1.4 UI / UX

- Wire `loadHistory()` to the API; map API shape → `PieceHistoryEntry`.
- **Loading / error:** error state with retry (not silent console-only); optional `CmSpinner` from primitives if available.
- **Empty state:** use existing `noHistory` i18n; ensure AR/RTL layout matches parent.
- **Accessibility:** list semantics if applicable (`ul`/`li` or equivalent roles).

### 1.5 QA

- Change piece status via UI and via batch update; confirm rows appear once.
- RLS: second tenant cannot read first tenant’s history.

---

## Stream 2 — Dashboard KPIs and widgets (close all gaps)

**Current state:** [`dashboard.service.ts` `getKPIOverview`](file:///F:/jhapp/cleanmatex/web-admin/lib/services/dashboard.service.ts) returns **zeros** for `sla`, `issues`, `payments`, `drivers`, and **empty** `topServices`. Widgets hardcode extra TODOs:

| Widget | File | Issue |
|--------|------|--------|
| Payment mix | [PaymentMixWidget.tsx](file:///F:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/widgets/PaymentMixWidget.tsx) | `cardPct` / `otherPct` forced 0 |
| Issues | [IssuesWidget.tsx](file:///F:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/widgets/IssuesWidget.tsx) | `critical` / `resolved` forced 0 |
| Turnaround | [TurnaroundTimeWidget.tsx](file:///F:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/widgets/TurnaroundTimeWidget.tsx) | `trend` forced 0 |
| Drivers | [DriverUtilizationWidget.tsx](file:///F:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/widgets/DriverUtilizationWidget.tsx) | counts / avg forced 0 |
| Delivery | [DeliveryRateWidget.tsx](file:///F:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/widgets/DeliveryRateWidget.tsx) | **not using** dashboard service — all zeros |
| Alerts | [AlertsWidget.tsx](file:///F:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/widgets/AlertsWidget.tsx) | empty mock; badge `absolute` without `relative` parent (layout bug) |
| Top services | [TopServicesWidget.tsx](file:///F:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/widgets/TopServicesWidget.tsx) | depends on `topServices` — always empty today |

### 2.1 Extend `KPIOverview` and service (single source of truth)

- Add fields needed by widgets (e.g. `payments.cardPct`, `payments.otherPct`; `issues.critical`, `issues.resolved`; `sla.trendPct`; `drivers.totalDrivers`, `drivers.activeDrivers`, `drivers.avgDeliveriesPerDriver`; `delivery.*`; `alerts[]` **or** dedicated `getDashboardAlerts` to keep payload small).
- Implement queries with **branch filter** when `options.branchId` is set (match existing `getKPIOverview` behavior).
- **`org_order_item_issues`:** [0021_order_issues_steps.sql](file:///F:/jhapp/cleanmatex/supabase/migrations/0021_order_issues_steps.sql) — map `priority` (`urgent`/`high`) to widget “critical”; `resolved` = `solved_at IS NOT NULL`.
- **Payments:** use [`org_payments_dtl_tr`](file:///F:/jhapp/cleanmatex/supabase/migrations) or order header fields — confirm canonical source; normalize method codes to cash / card / online / other buckets.
- **SLA / TAT:** define explicit business rules (e.g. `delivered_at - created_at` for completed orders; on-time vs `ready_by`); document in code comment **why**.
- **Trend:** week-over-week delta for average TAT per formula in [07_dashboard_widgets.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/Plans_For_Remaining/07_dashboard_widgets.md).
- **Drivers:** define “driver” ([`org_users_mst`](file:///F:/jhapp/cleanmatex/web-admin/prisma/schema.prisma) role/workflow-role or dedicated flag); join [`org_dlv_stops_dtl`](file:///F:/jhapp/cleanmatex/supabase/migrations/0065_org_dlv_delivery_management.sql) for activity.
- **Delivery rate:** derive from `org_dlv_*` + order status; **wire** [DeliveryRateWidget](file:///F:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/widgets/DeliveryRateWidget.tsx) to service (remove dead TODO mock).
- **Alerts:** bounded query (cap N), deterministic ordering — e.g. overdue orders (status + `ready_by`), open urgent issues, failed delivery stops; avoid N+1.
- **Top services:** aggregate revenue by service line from order items for last 30d (or configurable window consistent with revenue widgets).
- **Performance:** keep 60s cache; consider raw SQL RPC if PostgREST round-trips explode; document limits.

### 2.2 Widget UI fixes

- Remove remaining TODO hardcoding; use service fields only.
- **AlertsWidget:** fix badge container (`relative` + overflow); ensure RTL on header ([issues link pattern](file:///F:/jhapp/cleanmatex/web-admin/src/features/dashboard/ui/widgets/IssuesWidget.tsx) uses plain `<a>` — consider `Link` from Next for client nav).
- **Chart a11y:** ensure Recharts tooltips/labels remain readable in RTL (spot-check with `/i18n`).

### 2.3 QA

- Dashboard with branch filter on/off.
- Empty-data states (new tenant) — widgets should show existing “no data” copy, not broken charts.
- Load test: single `getKPIOverview` should not duplicate heavy work per widget (consider internal parallel fetches **inside** service once if split methods).

---

## Stream 3 — Settings Users / team management

**Goal:** Replace mocks; fix broken API usage; production UX; permissions aligned.

### 3.1 Critical bugs (fix first)

[`users/page.tsx`](file:///F:/jhapp/cleanmatex/web-admin/app/dashboard/settings/users/page.tsx) passes arguments **in wrong order** relative to [`lib/api/users.ts`](file:///F:/jhapp/cleanmatex/web-admin/lib/api/users.ts):

- `deleteUser(member.id, currentTenant.tenant_id)` → must be **`deleteUser(tenantId, userId, accessToken)`**
- `activateUser(member.id, currentTenant.tenant_id)` → **`activateUser(tenantId, userId, accessToken)`**
- `updateUser(selectedMember.id, currentTenant.tenant_id, ...)` → **`updateUser(tenantId, userId, data, accessToken)`**

All `rbacFetch` calls must receive **`session.access_token`** from `useAuth()`.

`deactivateUser` exists for non-destructive disable; **confirm product intent** vs `deleteUser` before wiring “Deactivate” (may need `deactivateUser` instead of delete).

### 3.2 Data loading

- Remove `MOCK_TEAM`; on mount call `fetchUsers(tenantId, {}, 1, limit, accessToken)` with reasonable `limit` or pagination.
- Map `TenantUser` → UI row model: `id` = `org_users_mst.id`, name from `display_name` / `first_name` + `last_name`, `is_active` → `active` | `inactive`, `pending` only if API exposes invite state (otherwise omit until invite API exists).

### 3.3 Invite flow

- Replace `handleInvite` TODO: if platform supports invite endpoint — use it; else `createUser` with **cryptographically secure temporary password** + platform **must** force password change on first login **or** send Supabase magic link — **do not** ship invite that leaves user without credential story.
- Validate email client-side + server-side; show toast on success/failure; refresh list.

### 3.4 Password reset

- Until platform implements reset, **hide** menu item **or** show disabled control with inline explanation (i18n) — avoid `alert()` that always fails.

### 3.5 UI / UX (production)

- Replace `alert` / `confirm` with Cmx **Dialog**, **Toast**, **Button** from [@ui](file:///F:/jhapp/cleanmatex/web-admin/.clauderc) per project rules.
- **Invite / edit modals:** use `Dialog` + form primitives; keyboard trap and focus return.
- **Table:** responsive pattern (card stack on mobile or horizontal scroll); align with other settings pages.
- **Loading:** skeleton or inline loading for table; disable duplicate submits.

### 3.6 Access control

- Confirm [`settings-access.ts`](file:///F:/jhapp/cleanmatex/web-admin/src/features/settings/access/settings-access.ts) route contract for `/dashboard/settings/users`.
- Update permission docs if new tenant-api proxies are added ([PERMISSIONS_BY_SCREEN.md](file:///F:/jhapp/cleanmatex/docs/platform/permissions/PERMISSIONS_BY_SCREEN.md), etc.).

---

## Stream 4 — Documentation (create / update / refresh)

Run this stream **alongside or immediately after** each implementation stream so docs stay aligned with shipping code (per `/documentation` and AGENTS.md feature requirements).

### 4.1 Deferred TODO index (status sync)

- Update [Plans_For_Remaining/README.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/Plans_For_Remaining/README.md): set **Status** to Done + **Last audit** date for plans **01**, **07**, **09** when the corresponding work ships; add short notes if scope changed (e.g. table name `org_order_item_pieces_dtl`, extra widget Top Services).
- Update [18_remaining_items.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/18_remaining_items.md) “Not Implemented” table rows for piece history, dashboard widgets, users page — remove or mark done to avoid stale guidance.

### 4.2 Permissions and access contracts

- Refresh as needed (same PR or follow-up commit):
  - [PERMISSIONS_BY_SCREEN.md](file:///F:/jhapp/cleanmatex/docs/platform/permissions/PERMISSIONS_BY_SCREEN.md)
  - [all_contract-aligned_UI_Permissions.md](file:///F:/jhapp/cleanmatex/docs/platform/permissions/all_contract-aligned_UI_Permissions.md)
  - [PERMISSIONS_BY_API.md](file:///F:/jhapp/cleanmatex/docs/platform/permissions/PERMISSIONS_BY_API.md)
- If any **new** dashboard route, tenant-api proxy, or permission code is introduced: update [settings-access.ts](file:///F:/jhapp/cleanmatex/web-admin/src/features/settings/access/settings-access.ts) / [core-access.ts](file:///F:/jhapp/cleanmatex/web-admin/src/features/core/access/core-access.ts) contract notes in those docs and keep the permissions inspector story accurate (`/rebuild-ui-access-contract`).

### 4.3 API and data-shape documentation

- **Piece history:** document `GET` route path, query params, response DTO, permission, and RLS table name in a small feature note under `docs/features/` **or** extend [01_piece_history.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/Plans_For_Remaining/01_piece_history.md) with an “As implemented” section (final URL, table name, instrumentation choice).
- **Dashboard KPIs:** add or update a short **KPI definitions** section (where business rules live: TAT, on-time %, payment buckets, driver definition, alert types, time windows). Prefer `docs/features/dashboard/` or `docs/dev/` — one canonical place so support and QA do not reverse-engineer `dashboard.service.ts`.
- **Users / team:** document tenant user list + invite + reset flows; if **cleanmatexsaas** platform-api gains endpoints, add a **cross-project integration** note (request/response, auth) per [FEATURE_PLACEMENT_GUIDE](file:///F:/jhapp/cleanmatex/.claude/docs/Dev/FEATURE_PLACEMENT_GUIDE.md) / checklist — no copied code between repos.

### 4.4 Schema and migrations

- Migration file: SQL header comments per `/code-documentation` (purpose, RLS summary, linkage to piece updates).
- If the repo maintains a **schema overview** or Prisma sync playbook, refresh or point to the new migration filename so the next `update-types` round is obvious.

### 4.5 Ops and production

- Reconcile [PRODUCTION_READINESS_CHECKLIST.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/PRODUCTION_READINESS_CHECKLIST.md) and [EXISTING_DOCS_UPDATES.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/EXISTING_DOCS_UPDATES.md) if this work adds env vars, public endpoints, or rate limits (e.g. slug check note from phase 18).

### 4.6 Checklist (copy into PR description)

- [ ] Plans_For_Remaining + 18_remaining_items status table updated.
- [ ] Permissions trio updated if routes/APIs or gates changed.
- [ ] KPI / piece-history / team flows documented (single canonical location each).
- [ ] Migration commented; cross-repo API contract noted if applicable.
- [ ] PRODUCTION_READINESS / EXISTING_DOCS touched if behavior or env changed.

---

## Execution order (recommended)

1. **Stream 3.1–3.2** — fixes broken user actions + real list (immediate correctness).
2. **Stream 2** — dashboard data (high visibility, no migration).
3. **Stream 1** — piece history (migration + instrumentation + API).
4. **Stream 3.3–3.5** + platform **invite/reset** contract (avoid shipping half-finished auth flows).
5. **Stream 4** — documentation refresh for everything that merged above (can be partial commits per stream if you prefer incremental accuracy).

---

## Definition of Done (global)

- [ ] No remaining TODOs in touched widgets / `PieceHistory` / users invite for the chosen MVP of invite.
- [ ] `npm run build` (web-admin) passes; no forbidden UI imports.
- [ ] `npm run check:i18n` passes if strings changed.
- [ ] New/changed API routes: permission checks + tenant filters documented.
- [ ] **Stream 4 complete:** deferred TODO index, permissions docs (if applicable), KPI/feature notes, migration header, cross-repo API notes, and prod checklist updates as needed.
- [ ] User applies new migration locally; types regenerated if your workflow requires it.
- [ ] Manual smoke: piece history, dashboard branch filter, users list CRUD paths.

---

## Reference docs

- [01_piece_history.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/Plans_For_Remaining/01_piece_history.md)
- [07_dashboard_widgets.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/Plans_For_Remaining/07_dashboard_widgets.md)
- [09_users_page.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/Plans_For_Remaining/09_users_page.md)
- [PRODUCTION_READINESS_CHECKLIST.md](file:///F:/jhapp/cleanmatex/docs/dev/CompletePendingAndTODOCodes_13022026/PRODUCTION_READINESS_CHECKLIST.md)
