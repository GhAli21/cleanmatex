# POS Session & Cash Drawer — Production Hardening Program

- **Status:** PLAN — awaiting approval. No code written, no migrations created.
- **Created:** 2026-09-23
- **Owner domain:** Order Fin / POS
- **Extends:** `ADR-054-User-Owned-POS-Sessions.md`, `POS_Session_Management_V1.md`, B16 (drawer variance approval), B27 (financial permissions)
- **Next free migration sequence at plan time:** `0515`

---

## 0. Decisions locked by the owner

| # | Decision | Resolution |
|---|---|---|
| D1 | Blind close | **Tenant-configurable** setting, branch-overridable. Not hardcoded. |
| D2 | Over-threshold variance gating | **Tenant-configurable** setting with three modes (`OFF` / `FLAG` / `APPROVAL_REQUIRED`), branch-overridable. B16's current always-complete behaviour becomes the `FLAG` mode, so the existing decision is preserved as a selectable option rather than reversed. |
| D3 | Where the settings live | **Dedicated finance-owned table `org_fin_cash_ctrl_stng_cf`**, read through one standalone resolver service — *not* the general `sys_tenant_settings_cd` catalog. Chosen so the storage can be swapped later by changing a single private function. See §3.1. |

`FLAG` is the name given to today's B16 behaviour (`cash-drawer.service.ts:1574-1586`): the close always completes, and exceeding the threshold only snapshots it and marks the session eligible for optional supervisor approval. It is a record-and-move-on mode, not a blocking control.

Per **D3**, both settings are stored in `org_fin_cash_ctrl_stng_cf` and edited from a tenant-side admin screen in this repo. HQ-console editing is deferred; §3.1.5 records the deviation from `integration-contracts.md` and ADR-055 captures it formally.

---

## 1. Program goals

1. No financial value is ever written from a float-computed or race-exposed code path.
2. Every cash fact is attributable to a **user**, a **drawer**, a **branch**, and a **business date**.
3. Cash that leaves a drawer must arrive somewhere the system can name.
4. A shift close produces an **immutable artifact**, not a re-runnable query.
5. Every new control is **configurable, not assumed** — a single-branch cash-only shop and a 40-branch chain both work without code changes.

## 2. Wave map

| Wave | Theme | Priority | Migrations |
|---|---|---|---|
| **W0** | Foundation: cash-control config table + resolver service, admin screen, permissions, decimal utils | Prerequisite for all | 0515–0516 |
| **A** | Money & concurrency integrity | **Non-negotiable before real tenants** | 0517, 0527 |
| **B** | Session enforcement & lifecycle | High | 0520, 0526 |
| **C** | Shift controls: blind close, denominations, variance gate | High (revenue-protecting) | 0518–0519, 0521 |
| **D** | Custody chain & audit artifacts | High | 0522–0523 |
| **E** | Consolidation, attribution, permissions cleanup | Medium | 0524–0525 |

Waves are sequential. Within a wave, work packages may run in parallel unless a dependency below says otherwise.

**Hard dependencies** (everything else inside a wave is parallelisable):

```
W0 (settings service + decimal utils)
 ├─► A2 ──► A3 ──► A4          A3 needs the locked transaction from A2
 │                             A4's currency guard needs A3's Decimal path
 ├─► A1                        independent
 ├─► B2 ──► B3                 B3 uses the assignment_mode column added in 0520
 ├─► B1                        needs W0 settings only
 ├─► C1 ──► C2 ──► C3          count sheet → blind close → gate
 │          C3 ──► C3-7        the POS-close guard MUST ship with the new status
 ├─► C4                        independent, needs A3 (Decimal) for correct aggregates
 ├─► D1                        needs A2 (locking) — a transfer locks two sessions
 └─► D2                        needs A3 + A4 — a Z-report of float totals is worthless

E depends on all of A–D.
```

The two sequencing traps worth naming: **D2 before A3/A4** would immortalise float totals in an immutable artifact, and **C3 without C3-7** opens the gate it was built to close.

---

## 3. Foundation — Wave 0

### 3.1 Dedicated cash-control config table + resolver service (migration `0515`)

**Owner decision D3 (2026-09-23):** these settings do **not** go into the general `sys_tenant_settings_cd` catalog yet. They live in a dedicated finance-owned config table, read through a single standalone service method, so that moving them into the general settings system later is a one-function change.

#### 3.1.1 Table naming — two corrections to the proposed name

The proposed `sys_fin_CASH_CONTROL_settings_cf` cannot be used as written:

1. **Length.** It is 32 characters; the repo limit is 30. Postgres also folds unquoted identifiers to lowercase, so the uppercase segment is cosmetic and would land as `sys_fin_cash_control_settings_cf` — still 32.
2. **Prefix.** `sys_*` in this repo means *genuinely global, no tenant column, no RLS* — the existing `sys_fin_runtime_cf` is a bare `key`/`value` table with `REVOKE ALL … FROM authenticated`. A table holding **per-tenant** values must be `org_*` with `tenant_org_id` and RLS (CRITICAL RULE #4 + `/multitenancy`). Putting tenant values in a `sys_` table would create a cross-tenant leak path.

**Adopted name (owner, 2026-09-23): `org_fin_cash_ctrl_stng_cf`** — `org_` = tenant-scoped, `_cf` = configuration, matching `org_payment_methods_cf` / `org_ar_appr_policies_cf`.

It is **25 characters — 5 under the limit**. Three reasons it wins over `org_fin_cash_control_config_cf` (30, at the ceiling) and `org_fin_cash_ctrl_config_cf` (27):

1. **`stng` is the established house abbreviation for "setting" in this repo**, not an invention: `sys_stng_profiles_mst`, `sys_stng_profile_values_dtl`, `sys_stng_categories_cd`, and the column family `stng_code` / `stng_value_jsonb` / `stng_category_code` / `stng_default_value_jsonb`, plus `fn_stng_resolve_all_settings`. There is **no** table in the schema using `config` in its name.
2. **`config` + `_cf` is redundant** — `_cf` already means configuration.
3. **This table holds settings, not general configuration** — scoped codes with typed values and a resolution order. `stng` is the accurate word as well as the conventional one.

Derived object names use the abbreviation **`ofccs`** (org_fin_cash_ctrl_stng), since the conventional `tenant_isolation_<table>` form would overflow regardless.

#### 3.1.1b Shape decision — explicit columns, not code/value rows

**Owner decision D4 (2026-09-23):** each setting is its **own typed column**. The table is *not* a generic `stng_code` / `stng_value` key-value store.

This is the right call for this table, and it is worth stating why, because the generic shape is the more common instinct:

| | Explicit columns (adopted) | Generic code/value rows (rejected) |
|---|---|---|
| Type safety | `BOOLEAN` is a boolean, threshold is `DECIMAL(19,4)` | Everything is `TEXT` + a `value_type` discriminator, parsed at runtime |
| Invalid values | Blocked by `CHECK` constraints in the DB | Only catchable in application code |
| Reading a tenant's policy | `SELECT *` — one row, whole policy visible | N rows to pivot before it means anything |
| Resolution query | One row per scope, `COALESCE` across the chain | N rows × 4 scopes to fetch and group |
| Prisma | Typed model for free, 1:1 with `CashControlSettings` | Manual mapping layer |
| Adding a setting | Needs a migration | Just a row |

The set is small (13), fixed, and **financial policy** — where a mistyped value is a money bug. Paying one `ALTER TABLE` per new setting is a good trade for DB-enforced correctness, and pre-launch migrations are cheap.

**Honest trade-off:** this makes the D3 exit path (folding into `sys_tenant_settings_cd`) an unpivot rather than a straight row copy. That is a one-time script, and it does not touch the resolver contract — §3.1.3 rules 1–3 and 5–6 hold unchanged, and only the private `loadOverrides` implementation differs. The abstraction is doing its job.

#### 3.1.2 Table shape

One row per scope. **Every setting column is nullable, and `NULL` means "not set at this scope — inherit."**

```sql
org_fin_cash_ctrl_stng_cf
  -- identity & scope
  id                           UUID PK
  tenant_org_id                UUID NOT NULL → org_tenants_mst(id)
  scope_level                  TEXT NOT NULL   -- TENANT | BRANCH | USER | DRAWER
  scope_id                     UUID            -- NULL only when scope_level = 'TENANT'

  -- drawer close controls
  blind_close_enabled          BOOLEAN         -- D1
  variance_gate_mode           TEXT            -- OFF | FLAG | APPROVAL_REQUIRED  (D2)
  variance_threshold_amount    DECIMAL(19,4)
  count_sheet_mode             TEXT            -- OFF | OPTIONAL | REQUIRED

  -- drawer custody controls
  drawer_assignment_mode       TEXT            -- OPEN | ASSIGNED_ONLY
  shared_session_mode          TEXT            -- SHARED | EXCLUSIVE
  max_cash_enforce_mode        TEXT            -- OFF | WARN | BLOCK
  cash_drop_requires_dest      BOOLEAN

  -- POS session controls
  pos_session_req_for_cash     BOOLEAN
  pos_session_req_all_tenders  BOOLEAN
  pos_session_rollover_mode    TEXT            -- OFF | PAUSE_AT_ROLLOVER | FORCE_CLOSE_AT_ROLLOVER
  pos_session_stale_hours      INTEGER
  shift_z_report_required      BOOLEAN

  -- standard tail
  metadata                     JSONB NOT NULL DEFAULT '{}'
  + full audit block, is_active, rec_status, rec_order, rec_notes
```

All column names are ≤ 30 chars; longest is `pos_session_req_all_tenders` (27).

**Constraints — the payoff of the columnar shape.** Every enum column is validated in the DB, which a code/value table cannot do:

| Object | Name | Rule |
|---|---|---|
| Unique expression index | `uq_ofccs_scope` | `(tenant_org_id, scope_level, COALESCE(scope_id, uuid_nil()))` — one row per scope. A plain `UNIQUE` will not work: `NULL` scope_id never collides. |
| RLS policy | `pol_ofccs_tenant` | `tenant_org_id = current_tenant_id()` |
| Tenant FK | `fk_ofccs_tenant` | → `org_tenants_mst(id)` |
| Scope shape | `chk_ofccs_scope` | `scope_id IS NULL` **iff** `scope_level = 'TENANT'` |
| Scope level | `chk_ofccs_scope_level` | `IN ('TENANT','BRANCH','USER','DRAWER')` |
| Variance gate | `chk_ofccs_variance_gate` | `IN ('OFF','FLAG','APPROVAL_REQUIRED')` |
| Count sheet | `chk_ofccs_count_sheet` | `IN ('OFF','OPTIONAL','REQUIRED')` |
| Assignment | `chk_ofccs_assignment` | `IN ('OPEN','ASSIGNED_ONLY')` |
| Shared session | `chk_ofccs_shared_session` | `IN ('SHARED','EXCLUSIVE')` |
| Max cash | `chk_ofccs_max_cash` | `IN ('OFF','WARN','BLOCK')` |
| Rollover | `chk_ofccs_rollover` | `IN ('OFF','PAUSE_AT_ROLLOVER','FORCE_CLOSE_AT_ROLLOVER')` |
| Threshold | `chk_ofccs_threshold` | `IS NULL OR >= 0` |
| Stale hours | `chk_ofccs_stale_hours` | `IS NULL OR > 0` |

Each `CHECK` allows `NULL` so that "not overridden" stays expressible. No separate lookup index is needed — the unique index already covers the only access path.

Note: the conventional `tenant_isolation_<table>` policy name used elsewhere in the repo is **not usable here** — it would be 42 characters.

Two further shape rules:

- **The table stores overrides only.** Defaults live in TypeScript (`lib/constants/cash-control.ts`), so a brand-new tenant works correctly with zero rows and the migration seeds nothing.
- Labels and descriptions are **i18n keys**, not DB columns — bilingual text stays in `messages/en|ar`, which is where the rest of the app's UI text lives.

**Resolution becomes a `COALESCE` down the scope chain**, which is the other benefit of explicit columns — one query, up to four rows, per-field precedence:

```sql
COALESCE(drawer.blind_close_enabled,
         usr.blind_close_enabled,
         branch.blind_close_enabled,
         tenant.blind_close_enabled)   -- NULL → TS default
```

#### 3.1.3 The resolver service — the part that makes this swappable

`lib/services/cash-control-settings.service.ts`

```ts
/** Future-ready scope. Add fields here; never add a second read function. */
export interface CashControlScope {
  tenantId: string;
  branchId?: string | null;
  userId?: string | null;
  drawerId?: string | null;
  terminalId?: string | null;    // reserved
  posSessionId?: string | null;  // reserved
}

export async function getCashControlSettings(
  scope: CashControlScope
): Promise<CashControlSettings>;
```

Design rules that are what actually buy the future-proofing — each one must hold or the abstraction leaks:

1. **Exactly one exported read function.** No `getSetting(code)`, no raw setting-code strings escaping the service. Callers receive a typed domain object.
2. **Always fully populated.** Every field non-optional, every default applied. No call site branches on `undefined`.
3. **Resolution order declared once** in a private constant: `DRAWER → USER → BRANCH → TENANT → code default`. Adding a scope level touches one array.
4. **A single private `loadOverrides(scope)` is the only code that touches the table.** Migrating to `fn_stng_resolve_all_settings` later means rewriting that one function and deleting the table — no call site changes. This is the whole point of the design.
5. **Never throws on bad data.** An unparseable or unknown stored value falls back to the default and logs a warning. A malformed config row must never stop a cashier taking money.
6. **Per-request memoization**, so a single order-submit doesn't re-query per check.

**Write side** — note this signature follows D4 (columns), *not* a key/value shape:

```ts
export async function updateCashControlSettings(
  scope: CashControlScope,
  patch: Partial<CashControlSettings>,  // only the fields being changed
  actor: { userId: string; reason?: string }
): Promise<CashControlSettings>;
```

- Upserts one row per scope; `null` in the patch explicitly **clears** an override (reverting that field to inherit), which must be distinguishable from "field absent from the patch". Use an explicit sentinel or `Record<K, T | null | undefined>` handling — getting this wrong silently makes overrides unclearable.
- Transactional, permission-gated on `cash_control:manage`.
- **Audited.** Changing `variance_gate_mode` or `blind_close_enabled` is a financial-control change and must be attributable. Write a before/after entry following the existing `org_payment_audit_log` pattern — see W0-4b.

#### 3.1.4 Settings — column, type, default

The logical setting codes below are the `CashControlSettings` field names and the i18n key stems. Per **D4** each one is a real column (§3.1.2); defaults live in `lib/constants/cash-control.ts`, never in the DB:

| DB column | TS field | Type | Default | Purpose |
|---|---|---|---|---|
| `blind_close_enabled` | `blindCloseEnabled` | `BOOLEAN` | `false` | Hide expected cash until the count is submitted. **(D1)** |
| `variance_gate_mode` | `varianceGateMode` | `TEXT` | `FLAG` | `OFF` / `FLAG` / `APPROVAL_REQUIRED`. **(D2)** |
| `variance_threshold_amount` | `varianceThresholdAmount` | `DECIMAL(19,4)` | `null` | Tenant default absolute threshold. Per-drawer `variance_approval_threshold` wins when set. |
| `count_sheet_mode` | `countSheetMode` | `TEXT` | `OPTIONAL` | `OFF` / `OPTIONAL` / `REQUIRED` denomination counting. |
| `drawer_assignment_mode` | `drawerAssignmentMode` | `TEXT` | `OPEN` | `OPEN` / `ASSIGNED_ONLY`. Per-drawer `assignment_mode` column wins when set. |
| `shared_session_mode` | `sharedSessionMode` | `TEXT` | `SHARED` | `SHARED` / `EXCLUSIVE` (one POS session per drawer session). |
| `max_cash_enforce_mode` | `maxCashEnforceMode` | `TEXT` | `WARN` | `OFF` / `WARN` / `BLOCK` when `max_cash_limit` is exceeded. |
| `cash_drop_requires_dest` | `cashDropRequiresDest` | `BOOLEAN` | `true` | Forbids one-legged cash drops. |
| `pos_session_req_for_cash` | `posSessionReqForCash` | `BOOLEAN` | `true` | No cash tender without an open POS session. |
| `pos_session_req_all_tenders` | `posSessionReqAllTenders` | `BOOLEAN` | `false` | Extends the above to card/wallet/etc. |
| `pos_session_rollover_mode` | `posSessionRolloverMode` | `TEXT` | `PAUSE_AT_ROLLOVER` | `OFF` / `PAUSE_AT_ROLLOVER` / `FORCE_CLOSE_AT_ROLLOVER`. |
| `pos_session_stale_hours` | `posSessionStaleHours` | `INTEGER` | `12` | Operational alert threshold for still-open sessions. |
| `shift_z_report_required` | `shiftZReportRequired` | `BOOLEAN` | `true` | Z-report must be generated as part of session close. |

Every column is **nullable** (`NULL` = inherit); the Default column is the TypeScript fallback applied when no scope in the chain supplies a value. Enum string values are DB-mirrored exactly by the TS constants (CRITICAL RULE #12).

#### 3.1.5 Consequence to accept: these settings need their own edit surface

Leaving the general catalog means they are **not** visible to the HQ settings console and **not** returned by `fn_stng_resolve_all_settings`. Someone still has to edit them, so the program must build that surface.

**Planned approach:** a tenant-side admin screen in this repo — `/dashboard/internal_fin/cash-control-settings` — gated by `cash_control:manage`, showing tenant defaults with per-branch / per-drawer overrides. HQ-side editing is deferred until the settings either move into the general catalog or an HQ API is added.

This is a deliberate, recorded deviation from `integration-contracts.md` (which assigns settings ownership to `cleanmatexsaas`). It is scoped to cash-control settings only and is revisited at the migration decision point. **An ADR is required** — see W0-2b.

#### 3.1.6 Tasks

- [ ] W0-1 Confirm `org_fin_cash_ctrl_stng_cf` does not exist on the **remote** DB (remote MCP, read-only). Confirm `uuid_nil()` availability or choose an explicit sentinel UUID for the unique expression index.
- [ ] W0-2 Write migration `0515` — table with the 13 explicit nullable setting columns (D4), all `CHECK` constraints from §3.1.2, unique expression index, RLS, `COMMENT ON` per column. No seed rows.
- [ ] W0-2b Write **ADR-055: Cash-Control Settings Live in a Finance-Owned Table** — records D3, the deviation from the HQ settings contract, the single-resolver design, and the exit criteria for folding into `sys_tenant_settings_cd` later.
- [ ] W0-3 `lib/constants/cash-control.ts` — `CASH_CONTROL_SETTING_DEFS` (code, type, default, validation) and the `CashControlSettings` type. DB-mirror rule applies to every code string.
- [ ] W0-3b **Prisma + generated types.** Add the model to `web-admin/prisma/schema.prisma`, run `npx prisma generate`, and refresh `types/database.generated.ts` / `types/database.ts`. *Standing requirement for every migration in this program — see §10.1.*
- [ ] W0-4 `lib/services/cash-control-settings.service.ts` per §3.1.3. Enforce the six design rules in review.
- [ ] W0-4b **Settings-change audit.** Persist before/after on every `updateCashControlSettings` call, following the `org_payment_audit_log` precedent. Decide in review: reuse an existing audit table or add `org_fin_cash_ctrl_audit_dtl` in `0515`. A control that can be silently turned off is not a control.
- [ ] W0-5 Admin screen + API: `src/features/cash-drawers/ui/cash-control-settings-screen.tsx`, `GET|PUT /api/v1/settings/cash-control`, `/navigation` dual-write (nav migration folded into `0524`), access contract.
- [ ] W0-6 i18n keys for all 13 settings (label + description, EN/AR).
- [ ] W0-7 `__tests__/services/cash-control-settings.test.ts` — default fallback with zero rows, full precedence chain drawer→user→branch→tenant, malformed-value fallback, tenant isolation, memoization.
- [ ] W0-8 STATUS.md + doc refresh.

**STOP-AND-WAIT** after `0515` for the owner to apply.

### 3.2 Permissions (migration `0516`)

**Audit finding to resolve first:** `cash_drawer:open_session` and `cash_drawer:close_session` are enforced in route code today but are **not present** in `lib/constants/permissions/finance-perm.ts` (only `cash_drawer:view` and `cash_drawer:approve_variance` are). Confirm their DB seed state before adding anything new — CRITICAL RULE #11 exposure.

| Permission code | Purpose |
|---|---|
| `cash_drawer:open_session` | *(verify — may already exist)* |
| `cash_drawer:close_session` | *(verify — may already exist)* |
| `cash_drawer:count` | Record/amend a denomination count sheet |
| `cash_drawer:transfer` | Initiate drop-to-safe / drawer-to-drawer |
| `cash_drawer:receive_transfer` | Accept the inbound leg |
| `cash_drawer:deposit` | Safe-to-bank deposit |
| `cash_drawer:view_all_branches` | Cross-branch drawer visibility |
| `pos_session:close_others` | Close another user's session without `force_close` |
| `pos_session:report_z` | Generate / view / print the Z-report |

**Tasks**
- [ ] W0-9 Remote-MCP audit of existing `cash_drawer:*` / `pos_session:*` codes.
- [ ] W0-10 Migration `0516` seeding only genuinely-new codes, **including `cash_control:view` / `cash_control:manage`** for the §3.1.5 admin screen. All match `^[a-z0-9_]+:([a-z0-9_]+|\*)$`.
- [ ] W0-11 Mirror into `finance-perm.ts` and `pos-session-perm.ts` (exact DB strings — DB-mirror rule).
- [ ] W0-12 Load `/update-rbac-role`; map new codes to Cashier / Branch Supervisor / Finance Manager / Tenant Admin. Regenerate effective permissions.
- [ ] W0-13 `npm run rebuild:platform-info-inventories` (`surface=permission`), then `check:`.

**STOP-AND-WAIT** after `0516`.

### 3.3 Decimal money utilities (no migration)

- [ ] W0-14 Add `lib/money/decimal-math.ts`: `addMoney`, `subMoney`, `sumMoney`, `compareMoney` over `Prisma.Decimal`. No JS `number` in any cash path.
- [ ] W0-15 Make tolerance currency-aware: replace the flat `CASH_VARIANCE_TOLERANCE = 0.01` in `lib/constants/financial-tolerances.ts` with `varianceToleranceFor(currencyCode, decimalPlaces)` = half the smallest unit. **KWD / BHD / OMR are 3-decimal currencies — the flat `0.01` is wrong for them today.** Keep the old export as a deprecated alias so `reconciliation-reports.ts` keeps compiling; migrate its call sites in Wave E.
- [ ] W0-16 Unit tests including explicit OMR (3dp) and AED (2dp) cases.

---

## 4. Wave A — Money & concurrency integrity

> The failure mode of every item in this wave is **wrong money already written to the database**. This wave ships before anything else.

### A1 — Drawer session numbering (migration `0517`)

*Defect:* `openSession` builds `SES-000007` from `count(*) + 1` (`cash-drawer.service.ts:1477-1481`) while migration 0270 defined an unused `generate_session_no()` producing `SES-YYYYMMDD-0001`. Concurrent opens collide on `uq_org_cash_drawer_sessions_no`; the formats also disagree with the function's own `SUBSTRING(session_no FROM 13)` parser.

- [ ] A1-1 Migration `0517`: `CREATE OR REPLACE FUNCTION generate_session_no()` hardened with `pg_advisory_xact_lock(hashtext(tenant || business_date))`, keeping the `SES-YYYYMMDD-NNNN` contract.
- [ ] A1-2 Service calls the function inside the insert transaction; delete the `count(*)` path.
- [ ] A1-3 Legacy `SES-NNNNNN` demo rows do **not** match the function's `LIKE` pattern, so no backfill is required. Confirm on remote; if real rows exist, add a normalization step. *(Per `project_prelaunch_no_real_tenants`, destructive normalization is acceptable here.)*
- [ ] A1-4 POS session `session_no` is `POS-YYYYMMDD-<8 hex>` (`pos-session.service.ts:136-138`) — collision-safe but not human-sequential. Align to the same generator for operator legibility and Z-report referencing.
- [ ] A1-5 Concurrency test: 20 parallel opens across 5 drawers; assert zero collisions and a gapless sequence.

**STOP-AND-WAIT** after `0517`.

### A2 — Transactions and row locks (no migration)

*Defect:* `openSession` and `closeSession` each span 3+ independent `withTenantContext` calls with no lock (`cash-drawer.service.ts:1456-1600`). A cash payment landing between the close's aggregate and its `UPDATE` is excluded from `expected_cash_amount` but stays attached to the session — the stored variance is then permanently wrong and can never reconcile.

- [ ] A2-1 Wrap `openSession`, `closeSession`, `recordMovement`, `approveSessionVariance` each in a single `prisma.$transaction`.
  > **Nesting order matters and is a correctness trap.** It must be `withTenantContext(tenantId, () => prisma.$transaction(async (tx) => …))`, never the reverse. The RLS GUC is set by `withTenantContext`; opening the transaction outside it loses tenant context inside `tx` and every `org_*` read silently returns zero rows. Follow the pattern already used in `pos-session.service.ts`.
- [ ] A2-2 `SELECT … FOR UPDATE` on the drawer session row at the top of every mutation.
- [ ] A2-3 Add `lockDrawerScope(tx, tenantId, drawerId)` mirroring the existing `lockUserSessionScope` advisory-lock helper (`pos-session.service.ts:140-144`).
- [ ] A2-4 Translate the `uq_open_cash_drawer_session` unique violation into a friendly 422 `DRAWER_SESSION_ALREADY_OPEN` instead of leaking a raw Prisma error.
- [ ] A2-5 Idempotency keys on open / close / movement via `org_idempotency_keys`, matching the POS session pattern.
- [ ] A2-6 **DB-integration tests** (local harness, per standing constraint): concurrent close ×2, payment-during-close, double-open, movement-during-close.

### A3 — Decimal-only cash computation (no migration)

- [ ] A3-1 Replace the JS float expected-cash computation (`cash-drawer.service.ts:1562-1567`) with **one SQL statement** returning `numeric`: opening float + linked cash payments + manual movements, preserving the B16 / Addendum-A2 "count each cash fact once" semantics exactly as the current comment block documents.
- [ ] A3-2 Replace `::float8` casts in `getPosSessionSummary` (`pos-session.service.ts:659-712`) with `::text` → `Prisma.Decimal` at the boundary.
- [ ] A3-3 Route the variance comparison through `varianceToleranceFor(currency)`.
- [ ] A3-4 Serialize money to the API as **strings**, never JS numbers. Update `lib/types/pos-session.ts` and the drawer API types accordingly.
- [ ] A3-5 Regression test: 500 sequential 0.005 OMR payments must close balanced.
- [ ] A3-6 **Known breaking test.** `__tests__/features/pos-sessions/cash-drawer-close-preview.test.ts` asserts numeric equality (`expect(preview.expectedCash).toBe(17.5)`). Switching money to strings/Decimal breaks it by design — update the assertions rather than weakening the serialization. Sweep for other numeric money assertions in the same pass.
- [ ] A3-7 **Downstream consumer.** `lib/constants/reconciliation-reports.ts` and `app/api/v1/finance/reports/reconciliation/cash-drawer/route.ts` consume `CASH_VARIANCE_TOLERANCE` and drawer totals. Verify the reconciliation report still balances after A3/A4; it must not keep comparing floats while the drawer compares Decimals.

### A4 — Multi-currency correctness (migration `0527`)

*Defect:* `GROUP BY currency_code … LIMIT 1` silently drops every currency but one (`pos-session.service.ts:659-668`, again at `680-689`).

- [ ] A4-1 Remove `LIMIT 1`; return `PosSessionCurrencyTotal[]`.
- [ ] A4-2 UI renders one total row per currency; a multi-currency session shows an explicit `CmxSummaryMessage` rather than a single ambiguous figure.
- [ ] A4-3 Migration `0527`: `CHECK` / trigger asserting a cash payment's `currency_code` matches its drawer session's `currency_code`; service guard returning `CASH_CURRENCY_MISMATCH` (422) before the write.
- [ ] A4-4 Tests for mixed-currency sessions and the rejection path.

### A5 — Wave A exit

- [ ] A5-1 `npx eslint . --quiet`, `npm run typecheck`, `npm run build`, full jest.
- [ ] A5-2 Refresh `Remediation_Work_Packages/QA_TEST_GUIDE.md` with owner-runnable scenarios (sidebar path + URL + what to click).
- [ ] A5-3 Invoke `/documentation`; update this folder's `STATUS.md`.

---

## 5. Wave B — Session enforcement & lifecycle

### B1 — Server-resolved, mandatory POS session (no migration)

*Defect:* `assertOpenPosSessionForFinanceTx` no-ops when the field is absent (`pos-session.service.ts:426`), and the value arrives from the **request body** (`app/api/v1/orders/[id]/payments/route.ts:18,60`). Omitting it writes an unlineaged payment.

- [ ] B1-1 Resolve the actor's active POS session **server-side** from the auth context in every finance write path: payments, collect-payment, refunds, refund process, stored value, gift cards, vouchers.
- [ ] B1-2 Keep the body field as a **cross-check only**: mismatch → 409 `POS_SESSION_MISMATCH`. Never trust it as the source.
- [ ] B1-3 Enforce presence per `POS_SESSION_REQUIRED_FOR_CASH` / `POS_SESSION_REQUIRED_ALL_TENDERS`. Missing session → 409 `POS_SESSION_REQUIRED` carrying an actionable payload so the UI can offer "Open session now".
- [ ] B1-4 UI: intercept `POS_SESSION_REQUIRED` in the payment modal and the order submit flow; offer inline open via the existing `ensure-for-order-entry` endpoint. Must not silently mutate any entered money (`no-silent-money-mutation.md`).
- [ ] B1-5 Tests per writer path, both settings on and off.

### B2 — Business date, timezone and rollover (migrations `0520`, `0526`)

*Defects:* `resolveBusinessTimezone` reads only the **tenant** timezone and falls back to a hardcoded `'Asia/Muscat'` (`pos-session.service.ts:277-285`) — ADR-054 §6 promised branch-scoped resolution in Phase 2, and the DB rule forbids defaulting locale fields. Separately, nothing closes a session at day rollover, so a forgotten session absorbs tomorrow's payments into yesterday's business date.

- [ ] B2-1 Migration `0526`: `BRANCH_TIMEZONE` setting (or confirm an existing branch timezone column) — resolve branch → tenant, **no hardcoded fallback**. A tenant with no timezone is a configuration error surfaced as `TENANT_TIMEZONE_NOT_CONFIGURED`, not a silent Muscat.
- [ ] B2-2 Migration `0520` column additions:
  - `org_pos_sessions_mst`: `rollover_applied_at TIMESTAMPTZ`, `stale_flagged_at TIMESTAMPTZ`, `auto_close_reason TEXT`.
  - `org_cash_drawer_sessions_mst`: `blind_close_applied BOOLEAN NOT NULL DEFAULT FALSE`, `counted_at TIMESTAMPTZ`, `expected_revealed_at TIMESTAMPTZ`, `count_sheet_total DECIMAL(19,4)`, `shift_report_id UUID`.
  - `org_cash_drawers_mst`: `assignment_mode TEXT` (NULL = inherit tenant setting), `default_safe_drawer_id UUID`.
  - All with `COMMENT ON COLUMN` per `/code-documentation`.
- [ ] B2-3 New service `lib/services/pos-session-rollover.service.ts` implementing `POS_SESSION_ROLLOVER_MODE`.
- [ ] B2-4 Internal endpoint `POST /api/v1/jobs/pos-sessions/rollover`, guarded by a service token (**not** a user permission), idempotent per `(tenant, business_date)`.
- [ ] B2-5 Scheduling: Supabase `pg_cron`, or the repo's existing job runner if one is already established — verify before choosing; do not introduce a second scheduler.
- [ ] B2-6 Stale-session surfacing: `stale_flagged_at` drives a badge on the POS Sessions hub and a Notification Hub event (reuse CMX-PRD-019 infrastructure; do not build a new notifier).
- [ ] B2-7 Tests: midnight crossing per timezone, rollover idempotency, rollover with an open drawer session attached.

**STOP-AND-WAIT** after `0520` and `0526`.

### B3 — Drawer assignment & branch scoping (no migration; uses `0520` columns)

*Defect:* `assigned_user_id` exists but `openSession` never reads it (`cash-drawer.service.ts:1456-1499`). Any holder of `cash_drawer:open_session` can operate **any** drawer in **any** branch of the tenant.

- [ ] B3-1 Enforce `assignment_mode` (drawer column → tenant setting): `ASSIGNED_ONLY` restricts open / movement / close to `assigned_user_id` plus holders of `cash_drawer:close_session` acting as supervisors.
- [ ] B3-2 **Branch-scope every drawer operation** against the actor's permitted branches. This is a real cross-branch exposure today; treat it as a security fix, not a feature.
- [ ] B3-3 `cash_drawer:view_all_branches` gates the cross-branch overview.
- [ ] B3-4 Tenant-isolation and branch-isolation tests per the `/multitenancy` checklist.

### B4 — Wave B exit
- [ ] Gates, QA guide refresh, `/documentation`, STATUS.md.

---

## 6. Wave C — Shift controls

### C1 — Denomination catalog & count sheets (migrations `0518`, `0519`)

- [ ] C1-1 Migration `0518`: `sys_currency_denominations_cd` (`currency_code`, `denomination_value DECIMAL(19,4)`, `denom_kind` `NOTE|COIN`, `name`/`name2`, `display_order`, `is_active`; PK on `(currency_code, denomination_value)`). Seed AED, SAR, OMR, KWD, BHD, QAR — **notes and coins**, with correct 3-decimal subunits for OMR / KWD / BHD. Plus `sys_cash_count_context_cd` (`OPENING` / `MID_SHIFT` / `CLOSING`).
- [ ] C1-2 Migration `0519`: `org_cash_count_sheets_dtl` — `tenant_org_id`, `branch_id`, `cash_drawer_session_id`, `count_context`, `denomination_value`, `quantity INTEGER`, `line_total DECIMAL(19,4)`, `currency_code`, `counted_by`, `counted_at`, full audit block, RLS `tenant_isolation_*`, composite FK `(cash_drawer_session_id, tenant_org_id)`.
- [ ] C1-3 Service `recordCountSheet` (transactional; recomputes `count_sheet_total` in SQL). The count-sheet total must equal the submitted `physicalCount` or the close is rejected with an explicit reconciliation message.
- [ ] C1-4 APIs: `POST|GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/count-sheet`, `GET /api/v1/currencies/[code]/denominations`.
- [ ] C1-5 New reusable component `src/ui/patterns/cmx-denomination-counter.tsx` (`CmxDenominationCounter`) — quantity grid, running total, RTL-safe, keyboard-first for counter speed. It appears in both the close wizard and the opening-float dialog, so it belongs in `src/ui/`, not a feature folder.
- [ ] C1-6 Storybook stories via `/storybook` (RTL, a11y, variants).
- [ ] C1-7 Enforce `CASH_DRAWER_COUNT_SHEET_MODE`.

**STOP-AND-WAIT** after `0518`, `0519`.

### C2 — Blind close (D1) (no migration; uses `0520` columns)

*Defect:* expected cash is rendered before the count is entered (`cash-drawer-overview-screen.tsx:345-346`), which makes every collected variance low-trust.

- [ ] C2-1 Server: when `CASH_DRAWER_BLIND_CLOSE` is on, the close-preview endpoint **omits** `expectedCash` / `variance` until a count is submitted. Enforced server-side — hiding it only in the UI is not a control.
- [ ] C2-2 Split `buildCashDrawerClosePreview` into pre-count (blind-safe) and post-count shapes. Per `feedback_action_result_flat_type_not_discriminated_union`, return a **flat** `{ revealed: boolean; expectedCash?: string; … }` type — `strict:false` breaks narrowing on a true discriminated union in this codebase.
- [ ] C2-3 UI: count-first wizard — *Count → Submit → Reveal → Confirm*. Stamp `expected_revealed_at` and `blind_close_applied`.
- [ ] C2-4 Non-blind mode keeps today's behaviour byte-for-byte.
- [ ] C2-5 Tests including an API-level assertion that expected cash is genuinely absent from the pre-count response payload.

### C3 — Variance gating (D2) (migration `0521`)

- [ ] C3-1 Migration `0521`: add `CLOSED_PENDING_APPROVAL` to `sys_cash_drawer_session_status_cd` (bilingual).
- [ ] C3-2 `closeSession` honours `CASH_DRAWER_VARIANCE_GATE_MODE`:
  - `OFF` — no threshold concept.
  - `FLAG` — today's B16 behaviour, unchanged (close completes, approval optional).
  - `APPROVAL_REQUIRED` — an over-threshold close lands in `CLOSED_PENDING_APPROVAL`; the drawer is not reusable and the POS session cannot close until approved.
- [ ] C3-3 Threshold resolution order: drawer `variance_approval_threshold` → setting `CASH_DRAWER_VARIANCE_THRESHOLD` → none. Always snapshot the value actually applied.
- [ ] C3-4 Enforce maker ≠ checker **in code** (B16 documents it only in a column comment).
- [ ] C3-5 Extend `approve-variance` to release `CLOSED_PENDING_APPROVAL` → `CLOSED`, plus a reject path returning the session to the cashier with a reason.
- [ ] C3-6 UI: extend `cash-drawer-variance-approval-dialog.tsx`; add a pending-approval queue to the drawer hub with a supervisor badge.
- [ ] C3-7 **Hole this status would otherwise open — must ship with C3-1.** `assertLinkedDrawerIsClosed` (`pos-session.service.ts:374-390`) blocks the POS close only when the drawer status is **exactly `'OPEN'`**. Introducing `CLOSED_PENDING_APPROVAL` without touching that guard would let a cashier close their POS session while an unapproved variance is still outstanding — defeating the whole gate. Change the check to an **allow-list of terminal statuses** (`CLOSED`, `FORCE_CLOSED`) rather than a deny-list of `OPEN`, so any future status fails safe.
- [ ] C3-8 Audit the same deny-list pattern elsewhere: grep for `=== 'OPEN'` / `status = 'OPEN'` across drawer and POS session code and convert each to an allow-list where a new status could slip through.
- [ ] C3-9 Tests for all three modes × over/under threshold × maker-is-checker rejection, plus an explicit test that a POS session **cannot** close while its drawer is `CLOSED_PENDING_APPROVAL`.

**STOP-AND-WAIT** after `0521`.

### C4 — Cashier variance history (no migration)

The highest-value control in this program, and currently absent entirely: a single close tells you little; the *pattern* is the signal.

- [ ] C4-1 Service `getVarianceByCashier(tenantId, branchIds, dateRange)` — per-user close count, total / mean / absolute variance, shortage-vs-overage skew, trend.
- [ ] C4-2 `GET /api/v1/reports/cash/variance-by-cashier`.
- [ ] C4-3 New screen `/dashboard/reports/cash-variance` — `src/features/reports/ui/cash-variance-by-cashier-screen.tsx` plus print report `reports/cash-variance-by-cashier-rprt.tsx`.
- [ ] C4-4 `/navigation` dual-write (`config/navigation.ts` + `sys_components_cd` in `0524`).
- [ ] C4-5 Access contract via `/rebuild-ui-access-contract`.

### C5 — Wave C exit
- [ ] Gates, QA guide refresh, `/documentation`, STATUS.md.

---

## 7. Wave D — Custody chain & audit artifacts

### D1 — Two-legged cash transfers (migration `0522`)

*Defect:* `CASH_DROP` and `PETTY_CASH` are `OUT` movements with no counterpart `IN` (`0267_v1_payment_config_hq.sql:167`, `0297`). Cash leaving a counter drawer disappears from the system and branch cash-on-hand is unanswerable.

- [ ] D1-1 Migration `0522`:
  - `sys_cash_transfer_type_cd`: `DROP_TO_SAFE`, `SAFE_TO_DRAWER`, `DRAWER_TO_DRAWER`, `SAFE_TO_BANK`, `PETTY_CASH_ISSUE`, `PETTY_CASH_RETURN` (bilingual).
  - New movement types in `sys_cash_drawer_movement_type_cd`: `TRANSFER_IN`, `TRANSFER_OUT`, `BANK_DEPOSIT`.
  - `org_cash_transfers_dtl`: `tenant_org_id`, `branch_id`, `transfer_type`, `from_drawer_id`, `from_session_id`, `to_drawer_id` (NULL for `SAFE_TO_BANK`), `to_session_id`, `amount DECIMAL(19,4)`, `currency_code`, `out_movement_id`, `in_movement_id`, `status` (`PENDING` / `COMPLETED` / `CANCELLED`), `reference_no`, `bank_reference`, `initiated_by`/`_at`, `received_by`/`_at`, `cancel_reason`, full audit, RLS, composite FKs.
- [ ] D1-2 Service `lib/services/cash-transfer.service.ts` — both legs written in **one** transaction with both drawer sessions locked; a transfer can never be half-applied. `SAFE_TO_BANK` has no inbound drawer leg and instead posts through the existing ERP-lite posting engine (`erp-lite-posting-engine.service.ts`) — reuse, do not reimplement.
- [ ] D1-3 Enforce `CASH_DROP_REQUIRES_DESTINATION`; when on, a destination-less drop is rejected.
- [ ] D1-4 `PENDING` supports an in-transit model (counter → safe with a different receiver): `receive` and `cancel` endpoints, permission-gated.
- [ ] D1-5 Enforce `max_cash_limit` per `CASH_DRAWER_MAX_CASH_ENFORCE`; on `WARN` / `BLOCK`, prompt a drop with the amount pre-suggested — **never auto-adjust any money field** (`no-silent-money-mutation.md`).
- [ ] D1-6 APIs: `POST|GET /api/v1/cash-transfers`, `POST /api/v1/cash-transfers/[id]/receive`, `.../cancel`.
- [ ] D1-7 Screen `/dashboard/internal_fin/cash-transfers` — `src/features/cash-drawers/ui/cash-transfers-screen.tsx`, transfer dialog, in-transit list, branch cash-position card. `/navigation` dual-write plus access contract.
- [ ] D1-8 Tests: leg symmetry, partial-failure rollback, cross-branch rejection, currency match.

**STOP-AND-WAIT** after `0522`.

### D2 — Immutable X / Z shift reports (migration `0523`)

*Defect:* `getPosSessionSummary` is a live recompute. Re-opening a past session's summary after any later backdated write returns different numbers than the cashier signed off on. There is no artifact.

- [ ] D2-1 Migration `0523`:
  - `sys_pos_shift_report_type_cd` (`X`, `Z`).
  - `org_pos_shift_reports_mst`: `tenant_org_id`, `branch_id`, `report_no`, `report_type`, `pos_session_id`, `cash_drawer_session_id`, `business_date`, `currency_code`, `gross_sales`, `net_sales`, `cash_total`, `non_cash_total`, `refunds_total`, `discounts_total`, `tax_total`, `variance_amount` (all `DECIMAL(19,4)`), `snapshot_jsonb JSONB NOT NULL` (full per-method / per-currency breakdown), `generated_at`/`_by`, `is_final BOOLEAN`, audit, RLS.
  - `UNIQUE (tenant_org_id, report_no)`; one final Z per POS session (partial unique index).
  - **Immutability trigger** rejecting `UPDATE` / `DELETE` on rows where `is_final = TRUE`.
- [ ] D2-2 Service `lib/services/pos-shift-report.service.ts` — X = live recompute, never stored; Z = snapshot and persist, idempotent per session.
- [ ] D2-3 Z generation is part of the close transaction when `SHIFT_Z_REPORT_REQUIRED` is on, so a session cannot close without its artifact.
- [ ] D2-4 Multi-currency: one report row per currency, or a single row with per-currency snapshot detail — decide with the finance owner during implementation; do **not** silently pick one currency (this is the A4 defect class).
- [ ] D2-5 APIs: `GET /api/v1/pos-sessions/[sessionId]/x-report`, `POST|GET /api/v1/pos-sessions/[sessionId]/z-report`.
- [ ] D2-6 UI: X-report panel in the POS session hub; Z-report print route `/dashboard/internal_fin/pos-sessions/[sessionId]/z-report` with `pos-sessions-shift-z-rprt.tsx` (bilingual, RTL, thermal-printer-friendly width).
- [ ] D2-7 Tests: snapshot stability after a later backdated write; single-final-Z enforcement; immutability trigger.

**STOP-AND-WAIT** after `0523`.

### D3 — Wave D exit
- [ ] Gates, QA guide refresh, `/documentation`, STATUS.md.

---

## 8. Wave E — Consolidation & attribution

### E1 — Retire the duplicate drawer UI

`src/features/billing/ui/cash-drawer-detail-client.tsx` uses raw `<th>` / `<input>` / `<label>`, violating the Cmx-only rule, and duplicates `src/features/cash-drawers/ui/*`.

- [ ] E1-1 Confirm no route depends on it; migrate any unique capability into the canonical screens.
- [ ] E1-2 Delete it. Per `project_prelaunch_no_real_tenants`, a clean removal beats a compat shim.
- [ ] E1-3 Remove orphaned i18n keys; `npm run check:i18n`.

### E2 — Per-cashier attribution inside a shared drawer session

Many POS sessions → one drawer session is intentional (plain index `idx_ops_cd_sess`), but a shortage on a three-cashier counter drawer is currently unattributable. The data already exists — `pos_session_id` is stamped on payments.

- [ ] E2-1 Drawer close shows a per-POS-session cash breakdown.
- [ ] E2-2 Implement `CASH_DRAWER_SHARED_SESSION_MODE = EXCLUSIVE` (one POS session per drawer session) for tenants that prefer hard attribution.
- [ ] E2-3 Carry the breakdown into the Z-report snapshot.

### E3 — Permissions & tolerance cleanup

- [ ] E3-1 Implement `pos_session:close_others` in the close path.
- [ ] E3-2 Migrate remaining `CASH_VARIANCE_TOLERANCE` call sites (`lib/constants/reconciliation-reports.ts`) to the currency-aware helper; delete the alias.
- [ ] E3-3 `npm run rebuild:platform-info-inventories` + `check:`; resolve `DRIFT_REPORT.md`.

### E4 — Navigation & RBAC (migrations `0524`, `0525`)

- [ ] E4-1 Migration `0524`: `sys_components_cd` entries for `/dashboard/internal_fin/cash-transfers`, `/dashboard/reports/cash-variance`, and the Z-report route — paired with `config/navigation.ts` (CRITICAL RULE #10 dual-write, `/navigation` skill).
- [ ] E4-2 Migration `0525`: rebuild effective permissions after all role mappings.
- [ ] E4-3 Full access-contract golden path: `scaffold:` → `derive: --apply` → `wire: --fix` → `check: --wire` → `sync:`.

**STOP-AND-WAIT** after `0524`, `0525`.

### E5 — Program exit

- [ ] E5-1 Full gates: `npx eslint . --quiet`, `npm run typecheck`, `npm run build`, full jest, `npm run check:i18n`, `check:ui-access-contract`, `check:platform-info-inventories`.
- [ ] E5-2 Final QA guide and `/documentation` pass; amend ADR-054 with the settings-driven controls; new ADR for the custody chain if the two-legged transfer model warrants one.
- [ ] E5-3 STATUS.md → COMPLETE.

---

## 9. Consolidated migration ledger

| Seq | Wave | Contents |
|---|---|---|
| `0515` | W0 | `org_fin_cash_ctrl_stng_cf` — cash-control config table, indexes, RLS (no seed rows) |
| `0516` | W0 | Permissions seed (incl. `cash_control:view` / `cash_control:manage`) |
| `0517` | A | `generate_session_no` hardening |
| `0518` | C | `sys_currency_denominations_cd` + GCC seed, `sys_cash_count_context_cd` |
| `0519` | C | `org_cash_count_sheets_dtl` |
| `0520` | B | Column additions: POS sessions, drawer sessions, drawers |
| `0521` | C | `CLOSED_PENDING_APPROVAL` status |
| `0522` | D | Cash transfer catalog + `org_cash_transfers_dtl` + movement types |
| `0523` | D | Shift report type catalog + `org_pos_shift_reports_mst` + immutability trigger |
| `0524` | E | Navigation (`sys_components_cd`) |
| `0525` | E | Effective-permissions rebuild |
| `0526` | B | Branch timezone resolution |
| `0527` | A | Currency-match constraint + index hardening |

All migrations: `TEXT` not `VARCHAR`; money `DECIMAL(19,4)`; object names ≤ 30 chars; full audit block; RLS on every `org_*` table; composite FKs on `(id, tenant_org_id)`; `DROP … RESTRICT` only; `COMMENT ON` for every new column.

**Created as `.sql` files only — never applied by Claude.** The owner applies each one; work stops at every STOP-AND-WAIT marker until application is confirmed.

---

## 10. Standing requirements — apply to every work package

These are not optional and are not repeated per task. A package is not done until all of them hold.

### 10.1 Per-migration obligations

For **every** migration in §9:

1. `TEXT` not `VARCHAR`; money `DECIMAL(19,4)`; object names ≤ 30 chars.
2. Full audit block (`created_at/_by/_info`, `updated_at/_by/_info`), `is_active`, `rec_status`, `rec_order`, `rec_notes`.
3. RLS enabled + tenant policy on every `org_*` table; composite FKs on `(id, tenant_org_id)` where the child is tenant-scoped.
4. `COMMENT ON TABLE` and `COMMENT ON COLUMN` for every new object (`/code-documentation`).
5. `DROP … RESTRICT` only. **No `CASCADE`** without the full manifest workflow in `docs/dev/drop-cascade-migration-workflow.md`.
6. **Reversal note in the migration header** — how to undo it, and whether undo is lossy. The repo forbids editing applied migrations, so the reversal is a *forward* migration; write down what it would contain.
7. **Prisma + generated types refreshed** after apply: `schema.prisma`, `npx prisma generate`, `types/database.generated.ts`, `types/database.ts`.
8. Created as a `.sql` file only. **STOP-AND-WAIT** for the owner to apply before continuing.

### 10.2 Error-code catalog

Every code below is introduced by this program. They must be defined in one place (`lib/constants/cash-control.ts` or the relevant domain error module), returned in the repo's `{ success, error }` envelope, and each must have an i18n key in both locales.

| Code | HTTP | Raised by | Meaning |
|---|---|---|---|
| `DRAWER_SESSION_ALREADY_OPEN` | 422 | A2-4 | Another session is already open on this drawer |
| `CASH_CURRENCY_MISMATCH` | 422 | A4-3 | Payment currency ≠ drawer session currency |
| `POS_SESSION_REQUIRED` | 409 | B1-3 | Tender attempted with no open POS session |
| `POS_SESSION_MISMATCH` | 409 | B1-2 | Client-supplied session ≠ server-resolved session |
| `TENANT_TIMEZONE_NOT_CONFIGURED` | 422 | B2-1 | No branch or tenant timezone set |
| `DRAWER_NOT_ASSIGNED_TO_USER` | 403 | B3-1 | `ASSIGNED_ONLY` drawer, non-assigned actor |
| `DRAWER_BRANCH_FORBIDDEN` | 403 | B3-2 | Drawer outside the actor's permitted branches |
| `COUNT_SHEET_TOTAL_MISMATCH` | 422 | C1-3 | Denomination lines ≠ submitted physical count |
| `COUNT_SHEET_REQUIRED` | 422 | C1-7 | `count_sheet_mode = REQUIRED` and none supplied |
| `VARIANCE_APPROVAL_REQUIRED` | 409 | C3-2 | Close exceeded threshold under `APPROVAL_REQUIRED` |
| `VARIANCE_APPROVER_IS_MAKER` | 403 | C3-4 | Maker ≠ checker violated |
| `POS_SESSION_DRAWER_PENDING_APPROVAL` | 409 | C3-7 | POS close blocked by unapproved drawer variance |
| `CASH_TRANSFER_DESTINATION_REQUIRED` | 422 | D1-3 | One-legged drop under `cash_drop_requires_dest` |
| `CASH_TRANSFER_NOT_PENDING` | 409 | D1-4 | Receive/cancel on a non-`PENDING` transfer |
| `DRAWER_MAX_CASH_EXCEEDED` | 422 | D1-5 | Only under `max_cash_enforce_mode = BLOCK` |
| `SHIFT_REPORT_ALREADY_FINAL` | 409 | D2-1 | Second Z attempted on a session |

`POS_SESSION_BRANCH_CONFLICT` and `POS_SESSION_ACTIVE_NOT_FOUND` already exist and are unchanged.

### 10.3 Cross-cutting gating decisions

| Dimension | Decision | Rationale |
|---|---|---|
| **Feature flags** | **Not used for this program.** No flag registered in `hq_ff_feature_flags_mst`. | Every new behaviour is already gated by a cash-control setting that defaults to today's behaviour. A second gate over the same switch adds confusion, and per `project_prelaunch_no_real_tenants` rollout flags have little value pre-launch. Revisit only if a wave needs to ship dark. |
| **Plan limits** | **Out of scope for this program.** | Drawer/terminal counts per plan are a separate commercial decision. Noted so the omission is deliberate, not forgotten. |
| **Notification Hub** | Reuse CMX-PRD-019; no new notifier. Events: stale session (B2-6), variance approval requested (C3), transfer awaiting receipt (D1-4), drawer over max cash (D1-5). | Building a second notification path would fragment delivery and preferences. |
| **Navigation** | All new routes go through `/navigation` dual-write; nav migrations consolidated into `0524`. | CRITICAL RULE #10. |
| **Access contracts** | Every new route gets the full golden path (`scaffold → derive --apply → wire --fix → check --wire → sync`). | CRITICAL RULE #14. |

### 10.4 Test matrix

Each wave must land its row before exit. Tenant-isolation coverage is mandatory for every new table and endpoint.

| Layer | Wave A | Wave B | Wave C | Wave D | Wave E |
|---|---|---|---|---|---|
| **Unit** | decimal math, currency tolerance (2dp/3dp), expected-cash SQL | timezone/business-date resolution, rollover modes | count-sheet totals, blind-close shapes, threshold resolution | transfer leg symmetry, Z snapshot builder | variance aggregation |
| **DB-integration** (local harness) | concurrent close ×2, payment-during-close, double-open, numbering race | rollover idempotency, branch scoping | gate modes × threshold, maker≠checker | partial-failure rollback, immutability trigger | exclusive-mode enforcement |
| **API** | money serialized as strings | `POS_SESSION_REQUIRED` payload shape | expected cash genuinely absent pre-count | receive/cancel state machine | report endpoints |
| **Tenant isolation** | every new/changed endpoint — cross-tenant read and write must fail | ✓ | ✓ | ✓ | ✓ |
| **UI** | — | session-required interception | count wizard RTL + keyboard | transfer dialog, Z print RTL | screen removal regressions |

Standing rule: **no new test weakens an existing assertion to make it pass.** If an existing test breaks, the expectation is updated deliberately and noted (see A3-6).

### 10.5 Observability

- All new service errors go through `@/lib/utils/logger` with `{ tenantId, branchId, userId, drawerId, posSessionId }`. No `console.log`.
- **Log at WARN**: settings falling back to default due to a malformed row; variance exceeding threshold; max-cash breach; rollover force-closing a session.
- **Log at ERROR**: transfer leg failure/rollback, Z-report generation failure, currency mismatch rejection.
- Every audited action (settings change, variance approval, force-close, transfer) records actor + timestamp + reason. Reason is **mandatory** on force-close, variance approval, and transfer cancel.

### 10.6 Definition of Done — per work package

A package is complete only when **all** hold:

1. Code written with the relevant skill loaded first (`/database`, `/frontend`, `/backend`, `/i18n`, `/multitenancy`).
2. Migration file created, owner-applied, Prisma + generated types refreshed.
3. i18n keys added to **both** `messages/en/**` and `messages/ar/**`; `npm run check:i18n` green.
4. RTL verified on every touched screen.
5. `cmxMessage` / `useMessage()` used for all user-facing feedback; no `alert()` / raw `toast()`.
6. Cmx components only — no raw HTML form controls, no direct Radix/shadcn.
7. Gates green: `npx eslint . --quiet`, `npm run typecheck`, `npm run build`, targeted jest.
8. Access contract + platform inventories refreshed where gating changed.
9. `QA_TEST_GUIDE.md` updated with owner-runnable steps (sidebar path + URL + what to click).
10. `STATUS.md` updated; `/documentation` invoked at wave exit.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| A3 changes stored `expected_cash_amount` values | Pre-launch, no real tenants — recompute demo data rather than shim. Add a one-off verification query comparing old vs new for existing demo sessions. |
| B1 mandatory session breaks an existing client path | Ship behind `POS_SESSION_REQUIRED_FOR_CASH`; default `true` but flippable per tenant/branch without a deploy. |
| C3 `APPROVAL_REQUIRED` can strand a drawer overnight | Force-close with `pos_session:force_close` remains available and audited; document in the QA guide. |
| D1 ERP-lite posting coupling | Reuse the existing posting engine; no new posting logic. Validate against `erp-lite-post-audit.service.ts`. |
| Cash-control settings sit outside the general settings system (D3) | The single-resolver design (§3.1.3) confines the coupling to one private function. ADR-055 records the exit criteria. Risk of drift is real but bounded, and the table stores overrides only, so defaults never depend on it. |
| Two settings systems confuse operators | The admin screen is labelled as cash-control-specific and lives under `internal_fin`, not under general Settings, so the split is visible rather than hidden. |
| Program size | Waves are independently shippable; Wave A alone closes the "wrong money written" class. |

## 12. Out of scope

- Offline POS / queued tenders.
- Multi-currency drawers (one drawer stays single-currency; A4 makes the constraint explicit).
- Fiscal-device or e-invoicing integration beyond the Z-report artifact.
- Reopening a closed POS session (ADR-054 keeps this out of scope).
