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
| D2 | Over-threshold variance gating | **Tenant-configurable** setting with three modes (`OFF` / `WARN_ONLY` / `APPROVAL_REQUIRED`), branch-overridable. B16's current always-complete behaviour becomes the `WARN_ONLY` mode, so the existing decision is preserved as a selectable option rather than reversed. |
| D5 | `FLAG` mode rename | **`WARN_ONLY`** (owner, Q5). The close still completes, but it now surfaces an explicit over-threshold warning at close time and creates a supervisor queue entry — so the name is honest rather than describing a silent record. `RECORD_ONLY` was the alternative and would have implied no user-visible signal. |
| D6 | Cash-control settings route | **`/dashboard/settings/payments/cash-control-settings`** (owner, Q6), under the existing `settings/payments` family rather than `internal_fin`. API moves to `/api/v1/settings/payments/cash-control`. |
| D3 | Where the settings live | **Dedicated finance-owned table `org_fin_cash_ctrl_stng_cf`**, read through one standalone resolver service — *not* the general `sys_tenant_settings_cd` catalog. Chosen so the storage can be swapped later by changing a single private function. See §3.1. |

`WARN_ONLY` is the renamed form of today's B16 behaviour (`cash-drawer.service.ts:1574-1586`): the close always completes, and exceeding the threshold only snapshots it and marks the session eligible for optional supervisor approval. It is a record-and-move-on mode, not a blocking control.

Per **D3**, both settings are stored in `org_fin_cash_ctrl_stng_cf` and edited from a tenant-side admin screen in this repo. HQ-console editing is deferred; §3.1.5 records the deviation from `integration-contracts.md` and ADR-056 captures it formally.

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
| **A** | Money & concurrency integrity (incl. cash-tender rounding) | **Non-negotiable before real tenants** | 0517, 0527 |
| **B** | Session enforcement & lifecycle | High | 0520, 0526 |
| **C** | Shift controls: blind close, denominations, variance gate | High (revenue-protecting) | 0518–0519, 0521, 0529 |
| **D** | Custody chain & audit artifacts | High | 0522–0523 |
| **E** | Consolidation, attribution, permissions cleanup | Medium | 0524–0525 |

Waves are sequential. Within a wave, work packages may run in parallel unless a dependency below says otherwise.

**Hard dependencies** (everything else inside a wave is parallelisable):

```
W0 (settings service + decimal utils)
 ├─► A2 ──► A3 ──► A4          A3 needs the locked transaction from A2
 │                             A4's currency guard needs A3's Decimal path
 ├─► A1                        independent
 ├─► HQ-1..HQ-4 ──► A6-2       rounding catalogs must exist before the resolver is rewired
 │              └──► C1        denominations must exist before counting grids render
 ├─► A6-2 ──► HQ-5             legacy columns may only be dropped after the app stops reading them
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
  variance_gate_mode           TEXT            -- OFF | WARN_ONLY | APPROVAL_REQUIRED  (D2)
  variance_threshold_amount    DECIMAL(19,4)   -- approval band
  variance_reason_amount       DECIMAL(19,4)   -- reason-required band (below approval)
  variance_tolerance_amount    DECIMAL(19,4)   -- auto-accept band (below reason)
  cash_tracking_mode           TEXT            -- TOTAL_ONLY | COUNT_BY_DENOMINATION | FULL_DENOMINATION_TRACKING
  opening_count_mode           TEXT            -- TOTAL_ONLY | OPTIONAL_DENOMINATION | DENOMINATION
  closing_count_mode           TEXT            -- TOTAL_ONLY | OPTIONAL_DENOMINATION | DENOMINATION

  -- cash-change rounding policy (D16) — who absorbs the un-tenderable fraction
  cash_change_bearer           TEXT            -- BUSINESS | CUSTOMER | NEAREST
  cash_change_round_to_minor   INTEGER         -- nearest N minor units; NULL = inherit HQ rule

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
| Variance gate | `chk_ofccs_variance_gate` | `IN ('OFF','WARN_ONLY','APPROVAL_REQUIRED')` |
| Tracking mode | `chk_ofccs_tracking` | `IN ('TOTAL_ONLY','COUNT_BY_DENOMINATION','FULL_DENOMINATION_TRACKING')` |
| Opening count | `chk_ofccs_open_count` | `IN ('TOTAL_ONLY','OPTIONAL_DENOMINATION','DENOMINATION')` |
| Closing count | `chk_ofccs_close_count` | `IN ('TOTAL_ONLY','OPTIONAL_DENOMINATION','DENOMINATION')` |
| Change bearer | `chk_ofccs_chg_bearer` | `IN ('BUSINESS','CUSTOMER','NEAREST')` **(D16)** |
| Change increment | `chk_ofccs_chg_incr` | `IS NULL OR > 0` **(D16)** |
| Assignment | `chk_ofccs_assignment` | `IN ('OPEN','ASSIGNED_ONLY')` |
| Shared session | `chk_ofccs_shared_session` | `IN ('SHARED','EXCLUSIVE')` |
| Max cash | `chk_ofccs_max_cash` | `IN ('OFF','WARN','BLOCK')` |
| Rollover | `chk_ofccs_rollover` | `IN ('OFF','PAUSE_AT_ROLLOVER','FORCE_CLOSE_AT_ROLLOVER')` |
| Thresholds | `chk_ofccs_threshold` | all three `IS NULL OR >= 0` |
| Threshold order | `chk_ofccs_thr_order` | `tolerance <= reason <= approval` when supplied — a reason band above the approval band is a misconfiguration that silently disables the stricter gate |
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
| `variance_gate_mode` | `varianceGateMode` | `TEXT` | `WARN_ONLY` | `OFF` / `WARN_ONLY` / `APPROVAL_REQUIRED`. **(D2)** |
| `variance_threshold_amount` | `varianceThresholdAmount` | `DECIMAL(19,4)` | `null` | Tenant default absolute threshold. Per-drawer `variance_approval_threshold` wins when set. |
| `variance_reason_amount` | `varianceReasonAmount` | `DECIMAL(19,4)` | `null` | At/above, a reason is mandatory but no approval. |
| `variance_tolerance_amount` | `varianceToleranceAmount` | `DECIMAL(19,4)` | `null` | Below this, auto-accept silently. |
| `cash_tracking_mode` | `cashTrackingMode` | `TEXT` | `COUNT_BY_DENOMINATION` | Checkout stays total-only; denominations are captured at counts. |
| `opening_count_mode` | `openingCountMode` | `TEXT` | `OPTIONAL_DENOMINATION` | Fast open, detail allowed. |
| `closing_count_mode` | `closingCountMode` | `TEXT` | `DENOMINATION` | Stronger close control without slowing sales. |
| `cash_change_bearer` | `cashChangeBearer` | `TEXT` | `BUSINESS` | **(D16)** Who absorbs the un-tenderable fraction of change. |
| `cash_change_round_to_minor` | `cashChangeRoundToMinor` | `INTEGER` | `null` | Round change to the nearest N minor units; `NULL` inherits the HQ `CASH_CHANGE` rule. |
| `drawer_assignment_mode` | `drawerAssignmentMode` | `TEXT` | `OPEN` | `OPEN` / `ASSIGNED_ONLY`. Per-drawer `assignment_mode` column wins when set. |
| `shared_session_mode` | `sharedSessionMode` | `TEXT` | `SHARED` | `SHARED` / `EXCLUSIVE` (one POS session per drawer session). |
| `max_cash_enforce_mode` | `maxCashEnforceMode` | `TEXT` | `WARN` | `OFF` / `WARN` / `BLOCK` when `max_cash_limit` is exceeded. |
| `cash_drop_requires_dest` | `cashDropRequiresDest` | `BOOLEAN` | `true` | Forbids one-legged cash drops. |
| `pos_session_req_for_cash` | `posSessionReqForCash` | `BOOLEAN` | `true` | No cash tender without an open POS session. |
| `pos_session_req_all_tenders` | `posSessionReqAllTenders` | `BOOLEAN` | `false` | Extends the above to card/wallet/etc. |
| `pos_session_rollover_mode` | `posSessionRolloverMode` | `TEXT` | `PAUSE_AT_ROLLOVER` | `OFF` / `PAUSE_AT_ROLLOVER` / `FORCE_CLOSE_AT_ROLLOVER`. |
| `pos_session_stale_hours` | `posSessionStaleHours` | `INTEGER` | `12` | Operational alert threshold for still-open sessions. |
| `shift_z_report_required` | `shiftZReportRequired` | `BOOLEAN` | `true` | Z-report must be generated as part of session close. |

#### 3.1.4a Cash-change rounding is a tenant business choice (D16)

**Owner decision.** Whether the shop or the customer absorbs an un-tenderable fraction of change is **business policy, not currency physics** — so it is a tenant setting, not a hardcoded rule.

| `cash_change_bearer` | Rounding mode | Effect on 9.997 change at 10-baisa steps |
|---|---|---|
| `BUSINESS` *(default)* | `CEILING` | returns **10.000** — shop absorbs 0.003 |
| `CUSTOMER` | `FLOOR` | returns **9.990** — customer loses 0.007 |
| `NEAREST` | `HALF_UP` | returns **10.000** here, `FLOOR` on a small remainder |

**Tender rounding is not configurable the same way**, and the asymmetry is deliberate: what a customer *can physically hand over* is fixed by which coins exist, so `CASH_TENDER` resolves from the HQ currency rule alone. What the shop *hands back* is a choice, so `CASH_CHANGE` is tenant-configurable. Conflating the two is how a "rounding setting" ends up quietly changing what customers are allowed to pay.

**Resolution — the rounding engine still reads exactly one `(mode, increment)` pair.** The setting is an *input* to the resolver, never a second rounding implementation:

```
CASH_CHANGE mode      := map(cash_change_bearer)            -- BUSINESS→CEILING, CUSTOMER→FLOOR, NEAREST→HALF_UP
                         → HQ rule rounding_mode            -- when bearer is unset
CASH_CHANGE increment := cash_change_round_to_minor
                         → HQ rule rounding_increment_minor
                         → none (round to output decimals only)
```

- [ ] UI-Q9 The settings screen states the consequence in plain words with a worked example, not mode names — a shop owner understands "we absorb the fils", not `CEILING`. Show a live preview using the tenant's own currency.
- [ ] UI-Q9b **Warn on `CUSTOMER`.** Rounding change down takes money from the customer on every cash sale; some jurisdictions restrict it and it is a goodwill risk regardless. Surface a `CmxSummaryMessage` explaining this when the option is selected — inform, do not block; it is the tenant's decision.
- [ ] UI-Q9c Escalation path if tenants ever need per-context rounding overrides beyond cash change: the `org_currency_rounding_rules_cf` layer already designed for in handoff §3.2.2. Do not build it pre-emptively.

Every column is **nullable** (`NULL` = inherit); the Default column is the TypeScript fallback applied when no scope in the chain supplies a value. Enum string values are DB-mirrored exactly by the TS constants (CRITICAL RULE #12).

#### 3.1.5 Consequence to accept: these settings need their own edit surface

Leaving the general catalog means they are **not** visible to the HQ settings console and **not** returned by `fn_stng_resolve_all_settings`. Someone still has to edit them, so the program must build that surface.

**Planned approach:** a tenant-side admin screen in this repo — `/dashboard/settings/payments/cash-control-settings` — gated by `cash_control:manage`, showing tenant defaults with per-branch / per-drawer overrides. HQ-side editing is deferred until the settings either move into the general catalog or an HQ API is added.

This is a deliberate, recorded deviation from `integration-contracts.md` (which assigns settings ownership to `cleanmatexsaas`). It is scoped to cash-control settings only and is revisited at the migration decision point. **An ADR is required** — see W0-2b.

#### 3.1.6 Tasks

- [x] W0-1 Confirm `org_fin_cash_ctrl_stng_cf` does not exist on the **remote** DB (remote MCP, read-only). Confirm `uuid_nil()` availability or choose an explicit sentinel UUID for the unique expression index. — **2026-09-23**: table absent; `uuid_nil()` resolved under the read-only MCP session's search_path but was **not** resolvable under `supabase db push`'s session (SQLSTATE 42883, confirmed by a real failed apply) — switched to the explicit sentinel `'00000000-0000-0000-0000-000000000000'::uuid`, per this task's documented fallback.
- [x] W0-2 Write migration `0515` — table with the 13 explicit nullable setting columns (D4), all `CHECK` constraints from §3.1.2, unique expression index, RLS, `COMMENT ON` per column. No seed rows. — **APPLIED 2026-09-23** (local + remote, owner-run `supabase db push`).
- [x] W0-2b Write **ADR-056: Cash-Control Settings Live in a Finance-Owned Table** — records D3, the deviation from the HQ settings contract, the single-resolver design, and the exit criteria for folding into `sys_tenant_settings_cd` later. — **2026-09-23**: `docs/features/Order_Fin/ADR/ADR-056-Cash-Control-Settings-Finance-Owned-Table.md`.
- [x] W0-3 `lib/constants/cash-control.ts` — `CASH_CONTROL_SETTING_DEFS` (code, type, default, validation) and the `CashControlSettings` type. DB-mirror rule applies to every code string. — **2026-09-23**.
- [x] W0-3b **Prisma + generated types.** Add the model to `web-admin/prisma/schema.prisma`, run `npx prisma generate`, and refresh `types/database.generated.ts` / `types/database.ts`. *Standing requirement for every migration in this program — see §10.5.* — **2026-09-23**: `org_fin_cash_ctrl_stng_cf` model added (owner separately regenerated Supabase-generated `types/database*.ts`).
- [~] W0-4 `lib/services/cash-control-settings.service.ts` per §3.1.3. Enforce the six design rules in review. — **2026-09-23**: read side (`getCashControlSettings`, resolution chain, memoization, safe-fallback) shipped. `updateCashControlSettings` deferred to land together with W0-4b once its audit table is applied.
- [~] W0-4b **Settings-change audit.** Persist before/after on every `updateCashControlSettings` call, following the `org_payment_audit_log` precedent. Decide in review: reuse an existing audit table or add `org_fin_cash_ctrl_audit_dtl` in `0515`. A control that can be silently turned off is not a control. — **Numbering note (2026-09-23):** `0515` already applied without this table (CRITICAL RULE #2 forbids editing an applied migration), so this can no longer fold into `0515` as originally planned. Reuse of the general-settings `org_stng_audit_log_tr` was evaluated and **rejected** — its RLS policy is SELECT-only (no INSERT path), its `stng_audit_scope` vocabulary (`SYSTEM|PROFILE|TENANT|BRANCH|USER`) has no `DRAWER` level, and reusing it would recouple cash-control settings back into the general settings audit system that **D3 deliberately keeps separate**. **Decision: dedicated `org_fin_cash_ctrl_audit_dtl`, new migration `0516`.** See STATUS.md D17 — this consumes the migration number originally reserved for §3.2 permissions, which now moves to `0517`; every plan-text number from here downward is nominal and STATUS.md's wave table is authoritative for the actual sequence. — **2026-09-23**: `supabase/migrations/0516_cash_control_settings_audit.sql` written, **NOT yet applied** (STOP-AND-WAIT). `updateCashControlSettings` + its Prisma model land once the owner applies it.
- [ ] W0-5 Admin screen + API: `src/features/cash-drawers/ui/cash-control-settings-screen.tsx`, `GET|PUT /api/v1/settings/payments/cash-control`, `/navigation` dual-write (nav migration folded into `0524`), access contract.
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
- [x] W0-9 Remote-MCP audit of existing `cash_drawer:*` / `pos_session:*` codes. — **2026-09-23**: `cash_drawer:open_session` / `close_session` already exist (seeded 2026-05-17), enforced in route code, but were missing from `finance-perm.ts` (now fixed, W0-11). `cash_control:view` / `manage` and the seven other planned codes did not exist. **New finding, out of scope for this package:** nine other `cash_drawer:*` codes (`cash_in`, `cash_out`, `cash_drop`, `close`, `force_close`, `open`, `record_movement`, `view_movements`, `view_reports`) also exist in the DB but are unmirrored in `finance-perm.ts` — recorded in STATUS.md, not fixed here to keep this migration scoped to what this program introduces.
- [x] W0-10 Migration `0517` (see numbering note above) seeding the 9 genuinely-new codes, **including `cash_control:view` / `cash_control:manage`** for the §3.1.5 admin screen. All match `^[a-z0-9_]+:([a-z0-9_]+|\*)$`. — **2026-09-23**: `supabase/migrations/0517_cash_drawer_pos_cash_control_permissions.sql` written, **NOT yet applied** (STOP-AND-WAIT).
- [x] W0-11 Mirror into `finance-perm.ts` and `pos-session-perm.ts` (exact DB strings — DB-mirror rule). — **2026-09-23**: done, including the `open_session`/`close_session` backfill from the W0-9 finding.
- [ ] W0-12 Load `/update-rbac-role`; map new codes to Cashier / Branch Supervisor / Finance Manager / Tenant Admin. Regenerate effective permissions. — real role codes confirmed via remote MCP: `cashier`, `supervisor`, `branch_manager`, `finance_manager`, `tenant_admin`, `super_admin`, `admin` (no role literally named "Branch Supervisor" — map to `branch_manager` and/or `supervisor` in review).
- [ ] W0-13 `npm run rebuild:platform-info-inventories` (`surface=permission`), then `check:`.

**STOP-AND-WAIT** after `0517`.

### 3.3 HQ-specified currency migrations — authored here (`0530`–`0534`)

`cleanmatexsaas` never creates migrations. HQ decides the shape and supplies the values; **every `.sql` file below is written in this repo**, by this program, and applied by the owner. The handoff document is the specification; these are the deliverables.

| Migration | Contents | Depends on HQ for |
|---|---|---|
| `0530` | `sys_currency_cd` `VARCHAR`→`TEXT` (**D11**); rename `sys_currency_cash_rounding_mode_cd` → `sys_rounding_mode_cd` (34 chars → 20, fixes an existing limit breach) and seed the unified mode set; create `sys_rounding_context_cd` + seed its 15 contexts | context list sign-off |
| `0531` | Rename `sys_currency_rounding_rules_cd` → `_cf` (**D12**); add `rounding_context`, `calculation_decimal_places`, `output_decimal_places` (nullable, **D13**), `rounding_increment_minor INTEGER`, `is_tenant_overridable`, effective dates, full audit block; backfill existing rows as `ACCOUNTING` with `CEIL`→`UP` / `FLOOR`→`DOWN` mapping | nothing — mechanical |
| `0532` | PK move to surrogate `id`; FKs, CHECKs, the overlap exclusion constraint, indexes, `NOT NULL`; **seed all 181 currencies** — derived `ACCOUNTING` + curated `CASH_TENDER` / `CASH_CHANGE` | **the values** (§3.6 of the handoff) |
| `0533` | `sys_currency_denominations_cd` — surrogate `id`, `denomination_code`, series and legal-tender metadata, `default_accept_cash` / `default_give_as_change`; seed; denomination-vs-increment consistency check | **the denomination sets** |
| `0534` | Drop legacy `rounding_unit` / `rounding_method` and `sys_currency_cd.cash_rounding_increment_minor` / `cash_rounding_mode`, `DROP … RESTRICT`. **Only after A6-2 ships.** | nothing |

**Ordering constraint that is easy to get wrong:** `0531`'s FK targets `sys_currency_cd(code)`, so the `VARCHAR`→`TEXT` conversion in `0530` must land **first** — FK column types must match. And `0534` must land **after** the tenant app's `currency-rounding.ts` rewire (A6-2), or the running app breaks on columns that no longer exist.

- [ ] HQ-1 Write `0530`. Verify on remote first that no other object depends on the old mode-catalog name before renaming.
- [ ] HQ-2 Write `0531`. Backfill formula and `CEIL`/`FLOOR` mapping per handoff §3.7.
- [ ] HQ-3a **Research and propose the cash increments ahead of HQ** (§10.12, SEED-1/SEED-3) so HQ is verifying a drafted table rather than starting from a blank page. GCC six first.
- [ ] HQ-3 Write `0532` **once HQ supplies the curated values.** The derived `ACCOUNTING` rows for all 181 are mechanical and can be written ahead; the curated `CASH_TENDER` / `CASH_CHANGE` rows for the GCC six are the part that waits.
- [ ] HQ-4a **Research and propose full note + coin sets** for the GCC six, then USD/EUR/GBP/INR (§10.12, SEED-1/SEED-3/SEED-4), with `seed_source` and `verified_on` per row.
- [ ] HQ-4 Write `0533` once HQ supplies the denomination sets. Include the `DO $$ … RAISE EXCEPTION` block asserting every denomination is a whole multiple of its currency's `CASH_TENDER` increment.
- [ ] HQ-5 Write `0534` **only after** A6-2 is merged and green.
- [ ] HQ-6 Prisma + generated types refreshed after each apply (§10.5).
- [ ] HQ-7 Mirror the new catalog codes into TS constants (DB-mirror rule) — `sys_rounding_context_cd`, `sys_rounding_mode_cd`. Feeds A6-2b.

**STOP-AND-WAIT** after each of `0530`–`0534`.

> **Degradation is safe throughout.** Until `0532` is seeded, the resolver falls back to `sys_currency_cd.minor_unit` (**D13**) and every currency still rounds correctly to its own precision. Until `0533` lands, counting falls back to `TOTAL_ONLY`. Nothing in Waves A–E is blocked from shipping; these migrations light features up rather than gate them.

### 3.4 Decimal money utilities (no migration)

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
- [ ] A3-6b **Recompute existing demo data.** A3 changes how `expected_cash_amount` and `difference_amount` are derived, so already-closed demo sessions hold values computed the old way. Write a one-off verification query comparing old vs new for every closed session, then recompute. Per `project_prelaunch_no_real_tenants` this is safe; after launch it would not be.
- [ ] A3-7 **Downstream consumer.** `lib/constants/reconciliation-reports.ts` and `app/api/v1/finance/reports/reconciliation/cash-drawer/route.ts` consume `CASH_VARIANCE_TOLERANCE` and drawer totals. Verify the reconciliation report still balances after A3/A4; it must not keep comparing floats while the drawer compares Decimals.

### A4 — Multi-currency correctness (migration `0527`)

*Defect:* `GROUP BY currency_code … LIMIT 1` silently drops every currency but one (`pos-session.service.ts:659-668`, again at `680-689`).

- [ ] A4-1 Remove `LIMIT 1`; return `PosSessionCurrencyTotal[]`.
- [ ] A4-2 UI renders one total row per currency; a multi-currency session shows an explicit `CmxSummaryMessage` rather than a single ambiguous figure.
- [ ] A4-3 **Superseded by D14 — do NOT add a single-currency constraint.** An earlier draft proposed a `CHECK` forcing a payment's currency to equal its drawer session's currency. That would weld the schema shut against multi-currency permanently. Instead: migration `0529` adds **`org_cash_sess_curr_dtl`** — one row per currency active in a drawer session, each carrying its own `opening_amount`, `expected_amount`, `counted_amount`, `variance_amount`, `is_primary`, with `UNIQUE (cash_drawer_session_id, currency_code)`, RLS and composite FK.
- [ ] A4-3b The invariant that actually closes the original bug: **every movement and payment carries exactly one currency, and reconciliation is computed per currency, never cross-netted.** A guard still returns `CASH_CURRENCY_MISMATCH` (422) when a payment's currency has no active row in the session *and* `allow_multi_currency_drawer` is off.
- [ ] A4-3c **Single-currency tenants see no change**: one balance row, one total, no currency selector (`allow_multi_currency_drawer` defaults `false`). Multi-currency later becomes a config flip, not a migration — this is the whole point of paying for the table now.
- [ ] A4-3d Backfill one `org_cash_sess_curr_dtl` row per existing drawer session from its `currency_code` / `opening_float_amount` / `expected_cash_amount` / `counted_cash_amount`, then read balances from the new table only.
- [ ] A4-4 Tests for mixed-currency sessions and the rejection path.

### A6 — Cash tender rounding: **consume what HQ already built** (no new migration)

> **Corrected 2026-09-23 after inspecting the HQ currency work.** An earlier draft of this package proposed adding `cash_rounding_unit` to `sys_currency_rounding_rules_cf` under a new migration `0528`. **That would have created a duplicate, conflicting definition.** The infrastructure already exists.

**What already exists and is applied:**

- `sys_currency_cd.cash_rounding_increment_minor BIGINT` and `cash_rounding_mode` — added by migration `0264`, FK'd to `sys_currency_cash_rounding_mode_cd` in `0266`, owned by the HQ Currency Setup feature.
- `sys_currency_cd.minor_unit`, `decimal_places`, `is_cash_supported`, bilingual minor-unit names (`Baisa` / `بيسة`) — seeded in `0265`.

**The three real defects:**

1. **`cash_rounding_increment_minor` is `NULL` for every GCC currency.** Verified in the `0265` seed: OMR, KWD, BHD and AED all seed `null`. The column exists; the values were never supplied. **This is HQ's to populate** — see the handoff note.
2. **The tenant app never reads it.** `lib/money/currency-rounding.ts` resolves from `sys_currency_rounding_rules_cf` (migration `0290`, B17) — the *accounting* table — and ignores `sys_currency_cd.cash_rounding_increment_minor` entirely. So even once HQ populates it, nothing changes until this wave wires it up.
3. **Two competing rounding sources** — `sys_currency_rounding_rules_cf` (B17, in use) and `sys_currency_cd` (HQ, unused). Cross-project decision required; see handoff item 2.

**Tasks (tenant side):**

- [ ] A6-1 **Blocked on HQ** — see the HQ currency handoff (`cleanmatexsaas/docs/features/Currency_Setup/HQ_CURRENCY_HANDOFF.md`). HQ must expand and seed `sys_currency_rounding_rules_cf` (`rounding_context`, `calculation_decimal_places` / `output_decimal_places`, `rounding_increment_minor`, unified mode catalog) before cash rounding does anything. Until then the resolver no-ops safely, so this wave ships and lights up when HQ lands. **The DDL and seed migrations are still written in this repo on HQ's request.**
- [ ] A6-1b **Fallback ladder (owner decision D13).** The resolver must degrade cleanly with no rule row present: rule `(currency, context)` → rule `(currency, 'ACCOUNTING')` → **`sys_currency_cd.minor_unit`** for both calculation and output precision, and no increment snapping when `rounding_increment_minor` is `NULL`. A currency HQ never curated still rounds correctly to its own minor unit.
- [ ] A6-2 Rewire `lib/money/currency-rounding.ts` to the **expanded `sys_currency_rounding_rules_cf`** (owner decision, see handoff §3): resolve `(currency, rounding_context)`, fall back to `(currency, 'ACCOUNTING')`, then no-op. Arithmetic in **minor units**. **Resolve or no-op, never assume** — keep the existing B15/B17 policy.
- [ ] A6-2b Mirror `sys_rounding_context_cd` and the unified `sys_rounding_mode_cd` codes into TS constants (DB-mirror rule). The current `CURRENCY_ROUNDING_MODES` uses `FLOOR`/`CEIL`; the unified catalog uses `DOWN`/`UP` — migrate the constant and every switch in `currency-rounding.ts`.
- [ ] A6-3 **`currency-rounding.ts` is float math** (`Math.round`, `Number.EPSILON`, `round4`) sitting directly in the path that decides tendered cash. Convert to `Prisma.Decimal` alongside A3. Minor-unit integers make this straightforward — do the arithmetic in minor units and convert once at the edge.
- [ ] A6-4 Apply cash rounding **only to cash-family tender**, at tender time, as a visible rounding line on receipt and Z-report. Never a silent total adjustment (`no-silent-money-mutation.md`). Card / wallet / transfer stay exact.
- [ ] A6-5 Post the residue via the existing ERP-lite posting engine (cash-rounding gain/loss). Unposted residue is how drawers drift.
- [ ] A6-6 **Decimal-place authority (owner-decided).** `sys_currency_cd.decimal_places` / `minor_unit` is the single source; `varianceToleranceFor()` (W0-15) resolves from it. **Deprecate `TENANT_DECIMAL_PLACES` to display-only** — audit its call sites in `tenant-settings.service.ts` (`CurrencyConfig`) and migrate each to the currency master. Do not remove the setting in the same step; deprecate, migrate, then retire.
- [ ] A6-7 Honour `is_cash_supported`: a currency with it false must not be selectable as a drawer currency.
- [ ] A6-8 Tests: with OMR `cash_rounding_increment_minor = 5`, a `2.003` cash tender rounds to `2.005` with a rounding line emitted; the same amount on card stays `2.003`; a drawer closes balanced across 200 mixed-tender orders. Plus an explicit test that `NULL` increment is a clean no-op.

**No migration in this package.** The DDL exists; only HQ seed values and tenant-side consumption are missing.

### A5 — Wave A exit

- [ ] A5-1 `npx eslint . --quiet`, `npm run typecheck`, `npm run build`, full jest.
- [ ] A5-2 Refresh `Remediation_Work_Packages/QA_TEST_GUIDE.md` with owner-runnable scenarios (sidebar path + URL + what to click).
- [ ] A5-3 Invoke `/documentation`; update `STATUS.md` (wave row, migrations applied, gate results, new decisions); refresh `RESUME_CONTINUATION.md`.

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
  - `org_cash_drawer_sessions_mst`: `blind_close_applied BOOLEAN NOT NULL DEFAULT FALSE`, `counted_at TIMESTAMPTZ`, `expected_revealed_at TIMESTAMPTZ`, `shift_report_id UUID`.
    > **`count_sheet_total` deliberately omitted (D15).** The counts header (`org_cash_drawer_counts_mst.counted_amount`) is the authority for what was counted. Duplicating it onto the session would create two answers to "what did they count" that can drift — the defect class this program keeps closing.
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

### B5 — Wave B exit

- [ ] B5-1 All gates green: `npx eslint . --quiet`, `npm run typecheck`, `npm run build`, targeted jest, `npm run check:i18n`.
- [ ] B5-2 Access contracts + platform inventories refreshed if gating changed (`check:ui-access-contract`, `check:platform-info-inventories`); remaining drift documented.
- [ ] B5-3 `QA_TEST_GUIDE.md` refreshed with owner-runnable scenarios for every package in this wave (sidebar path + URL + what to click).
- [ ] B5-4 **`STATUS.md`** — wave row set to COMPLETE, migration rows marked Applied, gate results logged, any new `D<n>` decisions recorded.
- [ ] B5-5 Invoke **`/documentation`** for this wave's surfaces: feature docs, API routes, permissions, settings, i18n keys, migrations, constants/types.
- [ ] B5-6 Update `docs/features/Order_Fin/Remediation_Work_Packages/RESUME_CONTINUATION.md` so the program remains resumable from a cold start.

---

## 6. Wave C — Shift controls

### C1 — Denomination consumption & cash counts (migrations `0518`, `0519`)

- [ ] C1-1 **`sys_currency_denominations_cd` is HQ-owned** (owner decision — handoff §4). HQ defines, seeds and provides the admin UI; this program consumes it **read-only**, keyed on `denomination_minor` (minor units). The DDL migration is still authored in this repo on HQ's request. Migration `0518` here therefore carries only `sys_cash_count_context_cd` (`OPENING` / `MID_SHIFT` / `CLOSING`).
- [ ] C1-1a **Blocked on HQ** for the denomination seed. Until it lands, counting falls back to `TOTAL_ONLY` for that currency rather than rendering an empty grid — fail visibly in the admin screen, never silently in the cashier's face.
- [ ] C1-1b **Tenant-level denomination control (ours, not HQ's)** — `org_currency_denom_cf` (tenant-scoped, RLS): enable/disable a denomination and override `display_order` per tenant/branch. Needed for withdrawn notes still in the global catalog, and for a branch that refuses large notes. `NULL`/absent row = inherit the `sys_` catalog, so zero rows works correctly.
- [ ] C1-1c **Opening-float composition (per `opening_count_mode`)** — the same `CmxDenominationCounter` records the opening float by denomination, not just a total. This is what makes a mid-shift discrepancy traceable to when it appeared, and it feeds A6-7's consistency check.
- [ ] C1-2 **Migration `0519` — counts are snapshots, modelled as header + detail (D15).** Replaces the earlier flat `org_cash_count_sheets_dtl` design.

  **`org_cash_drawer_counts_mst`** (26 chars) — one row per count event:
  `tenant_org_id`, `branch_id`, `cash_drawer_session_id`, `currency_code`,
  `count_type` (`OPENING` / `SPOT` / `CLOSING` / `RECOUNT`), `count_method` (`TOTAL_ONLY` / `DENOMINATION`),
  `counted_amount DECIMAL(19,4)`, `expected_amount DECIMAL(19,4)`, `variance_amount DECIMAL(19,4)`,
  `counted_by`, `counted_at`, `approved_by`, `approved_at`, `reason_code`, `notes`,
  full audit block, RLS, composite FK `(cash_drawer_session_id, tenant_org_id)`.

  **`org_cash_count_denom_dtl`** (24 chars) — optional denomination lines:
  `tenant_org_id`, `cash_count_id`, `denomination_id UUID` **FK → `sys_currency_denominations_cd(id)`**,
  `denom_value_minor_snap INTEGER`, `quantity INTEGER`, `line_amount DECIMAL(19,4)`,
  full audit block, RLS, composite FK `(cash_count_id, tenant_org_id)`.

  > **Three reasons this beats the flat design.** (1) `SPOT` and `RECOUNT` become expressible — a mid-shift spot check and a supervisor recount are standard loss-prevention tools with nowhere to live before. (2) `expected_amount` is **snapshotted at count time**, so a count is self-contained and reproducible instead of silently re-deriving later — the same defect class as the D2 Z-report finding. (3) `denom_value_minor_snap` freezes the denomination's value, so a historical count does not re-value when HQ edits the catalog.
  >
  > **FK on `denomination_id`, not on the value.** Two 50-rial notes of different issue series share a value but are different catalog rows; keying on the value cannot represent series at all.
- [ ] C1-2b `count_type = 'CLOSING'` is the one that gates the session close. `SPOT` counts never close anything and never block a sale — they record and, if outside tolerance, raise a Notification Hub event.
- [ ] C1-2c `RECOUNT` requires `cash_drawer:approve_variance`; it supersedes the prior `CLOSING` count rather than editing it. **Counts are immutable once recorded** — a correction is a new count, never an in-place edit.
  > **Type-mismatch trap.** An earlier draft used `denomination_value DECIMAL(19,4)` while the HQ catalog keys on `denomination_minor INTEGER`. Mixing the two makes the FK impossible and reintroduces decimal drift into the one place that must be exact integer counting. Count in minor units; convert once at the display edge.
- [ ] C1-3 Service `lib/services/cash-count.service.ts` — `recordCashCount(input)` (transactional; derives `counted_amount` from the denomination lines in SQL when `count_method = 'DENOMINATION'`). When lines are supplied, their sum must equal the submitted total or the count is rejected with `CASH_COUNT_TOTAL_MISMATCH` and an explicit reconciliation message.
- [ ] C1-4 APIs: `POST|GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/counts` (body carries `count_type` + optional denomination lines), `GET .../counts/[countId]`, `GET /api/v1/currencies/[code]/denominations`.
- [ ] C1-4b **Spot-count UI.** `count_type = 'SPOT'` needs its own entry point on the drawer screen — a mid-shift check that records and, if outside tolerance, raises a Notification Hub event, without closing anything or blocking a sale.
- [ ] C1-4c **Recount UI.** A supervisor holding `cash_drawer:approve_variance` can file a `RECOUNT` that supersedes the `CLOSING` count. The prior count stays visible in history — superseded, never edited.
- [ ] C1-5 New reusable component `src/ui/patterns/cmx-denomination-counter.tsx` (`CmxDenominationCounter`) — quantity grid, running total, RTL-safe, keyboard-first for counter speed. It appears in both the close wizard and the opening-float dialog, so it belongs in `src/ui/`, not a feature folder.
- [ ] C1-6 Storybook stories via `/storybook` (RTL, a11y, variants).
- [ ] C1-7 Enforce `cash_tracking_mode` / `opening_count_mode` / `closing_count_mode`.
- [ ] C1-8 **Checkout stays total-only.** The cashier types the cash tendered and nothing else; denomination entry belongs to counts, never to a sale. This is a hard UX rule — a counter queue cannot absorb note-by-note entry per transaction.

**STOP-AND-WAIT** after `0518`, `0519`.

### C2 — Blind close (D1) (no migration; uses `0520` columns)

*Defect:* expected cash is rendered before the count is entered (`cash-drawer-overview-screen.tsx:345-346`), which makes every collected variance low-trust.

- [ ] C2-1 Server: when `CASH_DRAWER_BLIND_CLOSE` is on, the close-preview endpoint **omits** `expectedCash` / `variance` until a count is submitted. Enforced server-side — hiding it only in the UI is not a control.
- [ ] C2-2 Split `buildCashDrawerClosePreview` into pre-count (blind-safe) and post-count shapes. Per `feedback_action_result_flat_type_not_discriminated_union`, return a **flat** `{ revealed: boolean; expectedCash?: string; … }` type — `strict:false` breaks narrowing on a true discriminated union in this codebase.
- [ ] C2-3 UI: count-first wizard — *Count → Submit → Reveal → Confirm*. Stamp `expected_revealed_at` and `blind_close_applied`.
- [ ] C2-4 Non-blind mode keeps today's behaviour byte-for-byte.
- [ ] C2-5 Tests including an API-level assertion that expected cash is genuinely absent from the pre-count response payload.

### C3 — Variance gating (D2) (migration `0521`)

- [ ] C3-1 Migration `0521`: add **`CLOSED_PENDING_APPROVAL`** and **`CLOSING`** to `sys_cash_drawer_session_status_cd` (bilingual).
  > **`CLOSING` closes a hole locking alone cannot.** Wave A narrows the payment-during-close race with `SELECT … FOR UPDATE`; `CLOSING` removes it at the domain level — once counting starts, new cash movements are **refused**, not merely serialized. The lock becomes the backstop rather than the fix. Both new statuses go through the C3-8 allow-list sweep.
- [ ] C3-2 `closeSession` honours `CASH_DRAWER_VARIANCE_GATE_MODE`:
  - `OFF` — no threshold concept.
  - `WARN_ONLY` — today's B16 behaviour plus an explicit close-time warning and a supervisor queue entry (close still completes, approval optional).
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

### C6 — Wave C exit

- [ ] C6-1 All gates green: `npx eslint . --quiet`, `npm run typecheck`, `npm run build`, targeted jest, `npm run check:i18n`.
- [ ] C6-2 Access contracts + platform inventories refreshed if gating changed (`check:ui-access-contract`, `check:platform-info-inventories`); remaining drift documented.
- [ ] C6-3 `QA_TEST_GUIDE.md` refreshed with owner-runnable scenarios for every package in this wave (sidebar path + URL + what to click).
- [ ] C6-4 **`STATUS.md`** — wave row set to COMPLETE, migration rows marked Applied, gate results logged, any new `D<n>` decisions recorded.
- [ ] C6-5 Invoke **`/documentation`** for this wave's surfaces: feature docs, API routes, permissions, settings, i18n keys, migrations, constants/types.
- [ ] C6-6 Update `docs/features/Order_Fin/Remediation_Work_Packages/RESUME_CONTINUATION.md` so the program remains resumable from a cold start.

---

## 7. Wave D — Custody chain & audit artifacts

### D1 — Two-legged cash transfers (migration `0522`)

*Defect:* `CASH_DROP` and `PETTY_CASH` are `OUT` movements with no counterpart `IN` (`0267_v1_payment_config_hq.sql:167`, `0297`). Cash leaving a counter drawer disappears from the system and branch cash-on-hand is unanswerable.

- [ ] D1-1 Migration `0522`:
  - `sys_cash_transfer_type_cd`: `DROP_TO_SAFE`, `SAFE_TO_DRAWER`, `DRAWER_TO_DRAWER`, `SAFE_TO_BANK`, `PETTY_CASH_ISSUE`, `PETTY_CASH_RETURN` (bilingual).
  - New movement types in `sys_cash_drawer_movement_type_cd`: `TRANSFER_IN`, `TRANSFER_OUT`, `BANK_DEPOSIT`, `SAFE_REPLENISHMENT`, **`ROUNDING_ADJUSTMENT`** (cash-change residue, D16) and **`CORRECTION`** (auditable fix requiring reason + elevated permission — without it the only way to fix a mistake is a fake cash-in).
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
- [ ] D2-4 **Multi-currency Z-report — resolved by D14.** One report row per currency, sourced from `org_cash_sess_curr_dtl`, since operational balances are already held per currency and must never be cross-netted. Q2 is therefore closed: the earlier "decide with finance" note is superseded.
- [ ] D2-5 APIs: `GET /api/v1/pos-sessions/[sessionId]/x-report`, `POST|GET /api/v1/pos-sessions/[sessionId]/z-report`.
- [ ] D2-6 UI: X-report panel in the POS session hub; Z-report print route `/dashboard/internal_fin/pos-sessions/[sessionId]/z-report` with `pos-sessions-shift-z-rprt.tsx` (bilingual, RTL, thermal-printer-friendly width).
- [ ] D2-7 Tests: snapshot stability after a later backdated write; single-final-Z enforcement; immutability trigger.

**STOP-AND-WAIT** after `0523`.

### D4 — Wave D exit

- [ ] D4-1 All gates green: `npx eslint . --quiet`, `npm run typecheck`, `npm run build`, targeted jest, `npm run check:i18n`.
- [ ] D4-2 Access contracts + platform inventories refreshed if gating changed (`check:ui-access-contract`, `check:platform-info-inventories`); remaining drift documented.
- [ ] D4-3 `QA_TEST_GUIDE.md` refreshed with owner-runnable scenarios for every package in this wave (sidebar path + URL + what to click).
- [ ] D4-4 **`STATUS.md`** — wave row set to COMPLETE, migration rows marked Applied, gate results logged, any new `D<n>` decisions recorded.
- [ ] D4-5 Invoke **`/documentation`** for this wave's surfaces: feature docs, API routes, permissions, settings, i18n keys, migrations, constants/types.
- [ ] D4-6 Update `docs/features/Order_Fin/Remediation_Work_Packages/RESUME_CONTINUATION.md` so the program remains resumable from a cold start.

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

- [ ] E4-1 Migration `0524`: `sys_components_cd` entries for **all four** new routes — `/dashboard/settings/payments/cash-control-settings` (W0-5), `/dashboard/internal_fin/cash-transfers`, `/dashboard/reports/cash-variance`, and the Z-report print route — each paired with `config/navigation.ts` (CRITICAL RULE #10 dual-write, `/navigation` skill). See the screen inventory §9.3.
- [ ] E4-2 Migration `0525`: rebuild effective permissions after all role mappings.
- [ ] E4-3 Full access-contract golden path: `scaffold:` → `derive: --apply` → `wire: --fix` → `check: --wire` → `sync:`.

**STOP-AND-WAIT** after `0524`, `0525`.

### E5 — Program exit

- [ ] E5-1 Full gates: `npx eslint . --quiet`, `npm run typecheck`, `npm run build`, full jest, `npm run check:i18n`, `check:ui-access-contract`, `check:platform-info-inventories`.
- [ ] E5-2 Final QA guide and `/documentation` pass; amend ADR-054 with the settings-driven controls; new ADR for the custody chain if the two-legged transfer model warrants one.
- [ ] E5-3 **Security review.** Run `/security-review` over the full program diff. This program touches money, permissions, branch scoping and a service-token endpoint — it is exactly the change set that warrants one. Specific things to confirm: no cross-tenant or cross-branch read path, the rollover job token cannot be guessed or replayed, maker≠checker cannot be bypassed, blind close cannot be defeated from the client, and no money value is accepted from the client without server re-derivation.
- [ ] E5-4 **Tenant-isolation sweep** — every new table and endpoint from §9.2/§9.3 has an explicit cross-tenant negative test (§10.8 test matrix).
- [ ] E5-5 STATUS.md → COMPLETE.

---

## 9. Consolidated inventories

### 9.1 Migration ledger

| Seq | Wave | Contents |
|---|---|---|
| `0515` | W0 | `org_fin_cash_ctrl_stng_cf` — cash-control config table, indexes, RLS (no seed rows) |
| `0516` | W0 | Permissions seed (incl. `cash_control:view` / `cash_control:manage`) |
| `0517` | A | `generate_session_no` hardening |
| `0518` | C | `sys_cash_count_context_cd` only — `sys_currency_denominations_cd` is HQ-owned (handoff §4) and arrives on HQ request |
| `0519` | C | `org_cash_drawer_counts_mst` + `org_cash_count_denom_dtl` — counts as header+detail snapshots (D15) |
| `0520` | B | Column additions: POS sessions, drawer sessions, drawers |
| `0521` | C | `CLOSED_PENDING_APPROVAL` + `CLOSING` statuses |
| `0522` | D | Cash transfer catalog + `org_cash_transfers_dtl` + movement types |
| `0523` | D | Shift report type catalog + `org_pos_shift_reports_mst` + immutability trigger |
| `0524` | E | Navigation (`sys_components_cd`) |
| `0525` | E | Effective-permissions rebuild |
| `0526` | B | Branch timezone resolution |
| `0527` | A | Report index strategy (§9.4) — the single-currency CHECK is **dropped** per D14 |
| `0528` | C | `org_currency_denom_cf` — tenant denomination enable/override |
| `0529` | C | `org_cash_sess_curr_dtl` — per-currency drawer-session balances (D14) + backfill |
| `0530` | W0 | **HQ-specified:** `sys_currency_cd` VARCHAR→TEXT; `sys_rounding_mode_cd` rename + seed; `sys_rounding_context_cd` + seed |
| `0531` | W0 | **HQ-specified:** rounding rules `_cd`→`_cf`, new columns, backfill to `ACCOUNTING` |
| `0532` | W0 | **HQ-specified:** PK change, constraints, indexes, 181-currency seed |
| `0533` | W0 | **HQ-specified:** `sys_currency_denominations_cd` + seed + consistency check |
| `0534` | W0 | **HQ-specified:** drop legacy rounding columns — **after A6-2 ships** |

All migrations: `TEXT` not `VARCHAR`; money `DECIMAL(19,4)`; object names ≤ 30 chars; full audit block; RLS on every `org_*` table; composite FKs on `(id, tenant_org_id)`; `DROP … RESTRICT` only; `COMMENT ON` for every new column.

**Created as `.sql` files only — never applied by Claude.** The owner applies each one; work stops at every STOP-AND-WAIT marker until application is confirmed.

### 9.2 API endpoint inventory

Every endpoint this program adds or changes. Each needs: `requirePermission`, Zod validation, the repo `{ success, data, error }` envelope, money serialized as **strings**, and an entry in the owning route's `apiDependencies`.

| Method + path | Package | Permission | Notes |
|---|---|---|---|
| `GET\|PUT /api/v1/settings/payments/cash-control` | W0-5 | `cash_control:view` / `:manage` | scope query params: branch / user / drawer |
| `GET /api/v1/currencies/[code]/denominations` | C1-4 | authenticated | merges HQ catalog + `org_currency_denom_cf` |
| `POST\|GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/counts` | C1-4 | `cash_drawer:count` | `count_type` = OPENING / SPOT / CLOSING / RECOUNT; optional denomination lines |
| `GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/counts/[countId]` | C1-4 | `cash_drawer:count` | single count with its lines |
| `GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/balances` | A4-3 | `cash_drawer:view` | **per-currency** opening / expected / counted / variance (D14) |
| `POST /api/v1/cash/change/preview` | D16 | authenticated | tender, change and rounding preview before commit — required once change rounding is asymmetric |
| `GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/close-preview` | C2-1 | `cash_drawer:close_session` | **omits expected cash pre-count under blind close** |
| `POST /api/v1/cash-drawers/[drawerId]/close-session` | C1/C2/C3 | `cash_drawer:close_session` | extended with count sheet + gate modes |
| `POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/approve-variance` | C3-5 | `cash_drawer:approve_variance` | extended: releases `CLOSED_PENDING_APPROVAL` |
| `POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/reject-variance` | C3-5 | `cash_drawer:approve_variance` | **new** — returns the session to the cashier with a reason |
| `GET /api/v1/reports/cash/variance-by-cashier` | C4-2 | `reconciliation:view` | paginated; date range + branch filter |
| `POST\|GET /api/v1/cash-transfers` | D1-6 | `cash_drawer:transfer` | list is paginated |
| `POST /api/v1/cash-transfers/[id]/receive` | D1-6 | `cash_drawer:receive_transfer` | |
| `POST /api/v1/cash-transfers/[id]/cancel` | D1-6 | `cash_drawer:transfer` | reason mandatory |
| `GET /api/v1/pos-sessions/[sessionId]/x-report` | D2-5 | `pos_session:view` | live recompute, never persisted |
| `POST\|GET /api/v1/pos-sessions/[sessionId]/z-report` | D2-5 | `pos_session:report_z` | idempotent; one final Z per session |
| `POST /api/v1/jobs/pos-sessions/rollover` | B2-4 | **service token, not a user permission** | store the secret like `sys_fin_runtime_cf.outbox_secret_key` (B7 precedent) — never hardcoded |

Existing endpoints materially changed: `/api/v1/orders/[id]/payments`, `/collect-payment`, `/refund`, `/refunds`, `/api/v1/orders/refunds/[refundId]/process`, `/api/v1/orders/submit-order` (B1 server-resolved session); `/api/v1/finance/reports/reconciliation/cash-drawer` (A3-7).

### 9.3 Screen / route inventory

| Route | Package | Screen file | Nav? |
|---|---|---|---|
| `/dashboard/settings/payments/cash-control-settings` | W0-5 | `src/features/cash-drawers/ui/cash-control-settings-screen.tsx` | yes |
| `/dashboard/internal_fin/cash-transfers` | D1-7 | `src/features/cash-drawers/ui/cash-transfers-screen.tsx` | yes |
| `/dashboard/reports/cash-variance` | C4-3 | `src/features/reports/ui/cash-variance-by-cashier-screen.tsx` | yes |
| `/dashboard/internal_fin/pos-sessions/[sessionId]/z-report` | D2-6 | `src/features/pos-sessions/reports/pos-sessions-shift-z-rprt.tsx` | print route |
| `/dashboard/internal_fin/cash-drawers` + `/[drawerId]` + `/session/[sessionId]` | C1–C3, D14 | existing `src/features/cash-drawers/ui/*` — close wizard reworked; **spot-count and recount entry points (C1-4b/c)**; **per-currency balance panel, rendered only when >1 currency is active** | existing |
| `/dashboard/internal_fin/pos-sessions` | B2-6, D2-6 | existing `pos-sessions-screen.tsx` / `pos-session-hub.tsx` — stale badges, X/Z actions | existing |
| *(removed)* `src/features/billing/ui/cash-drawer-detail-client.tsx` | E1-2 | deleted | — |

New reusable `Cmx*` components: `CmxDenominationCounter` (C1-5); money-variance display and scope-override editor extracted on second use (§10.2).

Every new route runs the full access-contract golden path (§10.1 rule 2) and the navigation dual-write (`0524`).

### 9.4 Query and index strategy

New read paths that will grow with data. Each needs an index and a checked query plan before its wave exits.

| Query | Index |
|---|---|
| Expected-cash aggregate at close | `org_order_payments_dtl (tenant_org_id, cash_drawer_session_id)` — verify it exists; add if not |
| Count history | `org_cash_drawer_counts_mst (tenant_org_id, cash_drawer_session_id, currency_code, count_type, counted_at DESC)` |
| Count denomination lines | `org_cash_count_denom_dtl (tenant_org_id, cash_count_id)` |
| Per-currency session balances | `org_cash_sess_curr_dtl (tenant_org_id, cash_drawer_session_id)` — plus `UNIQUE (cash_drawer_session_id, currency_code)` |
| Variance-by-cashier report | `org_cash_drawer_sessions_mst (tenant_org_id, closed_by, closed_at DESC)` |
| Transfer list / in-transit | `org_cash_transfers_dtl (tenant_org_id, status, initiated_at DESC)` |
| Z-report lookup | `org_pos_shift_reports_mst (tenant_org_id, business_date, branch_id)` |
| Cash-control resolution | `uq_ofccs_scope` (§3.1.2) already covers it |

- [ ] IDX-1 Add these in `0527` (Wave A ones) and in each feature's own migration (C/D ones).
- [ ] IDX-2 `EXPLAIN` the variance report and the close aggregate against a seeded dataset before the owning wave exits. **No N+1**: the per-cashier breakdown and the per-currency totals are single grouped queries, not a loop over sessions.


---

## 10. Standing requirements — apply to every work package

These are not optional and are not repeated per task. A package is not done until all of them hold.

### 10.1 Execution discipline — CLAUDE.md is not advisory

**The project `CLAUDE.md` governs every task in this plan.** It is not superseded by anything written here; where this plan and `CLAUDE.md` disagree, `CLAUDE.md` wins and the plan gets corrected.

Non-negotiable per work package:

1. **Load the required skill *before* writing the first line** of that domain — `/database` for any SQL or migration, `/frontend` for any component or JSX, `/backend` for any route or service, `/i18n` for any translation key, `/multitenancy` for any `org_*` query, `/implementation` for a new feature, `/code-documentation` for any JSDoc or SQL comment, `/storybook` for any `.stories.tsx`, `/navigation` for any menu-visible route. If code was written without the skill loaded — **stop, load it, re-verify the code against it, fix.**
2. **Use the specialist skills where they own the workflow** — `/rebuild-ui-access-contract` for route gating, `/update-rbac-role` for roles, `/create-update-rbac-permission` for permission codes, `/rebuild-platform-info-inventories` after any gating change, `/add-setting-db` for settings. Do not hand-write what a skill generates.
3. **Read the rule docs when referenced, don't work from memory** — `docs/dev/rules/no-silent-money-mutation.md`, `docs/dev/rules/cmx-message.md`, `docs/dev/rules/react-lint-verification-checklist.md`, `docs/dev/rules/integration-contracts.md`, `docs/dev/drop-cascade-migration-workflow.md`, `.cursor/rules/ui-access-contract-pattern.mdc`.
4. **Use agents for exploration** per the agent-first workflow — Explore for "where is X / how does Y work" across many files. Direct tools only for known paths and precise edits.
5. **Honour the CRITICAL RULES** — no `db reset`, never modify an applied migration, **never apply a migration** (create the `.sql` and stop), tenant filter on every query, `npm run build` after frontend changes, EN/AR mandatory, navigation dual-write, permissions need a migration, constants mirror DB strings exactly, `resource:action` permission format.

### 10.2 Reusable UI first — search, then reuse, then extract

Applies to every screen, dialog, field and validation surface in this program.

1. **Search `src/ui/` before writing any UI.** If a `Cmx*` component exists for the job, use it. Import via `@ui/primitives`, `@ui/feedback`, `@ui/overlays`, `@ui/forms`, `@ui/data-display`, `@ui/navigation` — exact lines from `web-admin/.clauderc`.
2. **Never use raw HTML form controls or bare Radix/shadcn in feature code.** The legacy `cash-drawer-detail-client.tsx` (raw `<th>` / `<input>` / `<label>`) is exactly what this rule prevents, and E1 deletes it.
3. **If it will appear in two or more places, build it as a reusable `Cmx*` in `src/ui/`, not in a feature folder.** Judgement call, made deliberately rather than by default. In this program that already applies to:
   - `CmxDenominationCounter` — used by the close wizard *and* the opening-float dialog (C1-5)
   - a money-variance display used by drawer close, the variance report and the Z-report — extract on second use
   - a scope-override editor (tenant → branch → user → drawer) used by the cash-control settings screen and potentially any future scoped config
4. **New `Cmx*` components require Storybook stories** (`/storybook`): RTL, a11y, variants.
5. **Validation is shared code, not per-screen code.** Zod schemas live in `lib/validations/`, derive their enums from `lib/constants/`, and the **same schema validates on client and server**. A rule enforced in one place only is a bug waiting to happen — and for money rules, a money bug.
6. **Feedback goes through `cmxMessage` / `useMessage()`** from `@ui/feedback`, with an i18n-resolved string. Never `alert()`, never a raw `toast()`, never a new legacy toast helper.

### 10.3 Separation of concerns — every domain owns its services

No business logic in routes, components, or server actions. This program introduces several new domains; each gets its own service module and is called, not inlined.

| Domain | Service file | Owns |
|---|---|---|
| Cash-control settings | `lib/services/cash-control-settings.service.ts` | resolution, write, audit |
| Cash drawer | `lib/services/cash-drawer.service.ts` (existing) | sessions, movements, close, variance |
| Cash counting | `lib/services/cash-count.service.ts` | count snapshots (opening/spot/closing/recount), denomination lines, totals reconciliation |
| Session balances | `lib/services/cash-session-balance.service.ts` | per-currency opening/expected/counted/variance (D14); the only writer of `org_cash_sess_curr_dtl` |
| Cash transfers | `lib/services/cash-transfer.service.ts` | two-legged transfers, receive, cancel |
| POS session | `lib/services/pos-session.service.ts` (existing) | lifecycle, lineage, guards |
| Session rollover | `lib/services/pos-session-rollover.service.ts` | business-date rollover, stale handling |
| Shift reports | `lib/services/pos-shift-report.service.ts` | X recompute, Z snapshot + persist |
| Currency rounding | `lib/money/currency-rounding.ts` (existing) | rounding resolution, cash vs accounting |
| Variance analytics | `lib/services/cash-variance-report.service.ts` | per-cashier aggregation |

Layering contract:

```
route / server action   →  thin: auth, permission gate, Zod parse, call service, map errors
service                 →  all business logic, transactions, locks, tenant context
repository / Prisma     →  data access only
```

Rules:

1. **Routes stay thin.** `requirePermission` → validate → call one service function → return. Hard Truth #1 in `CLAUDE.md`: logic in controllers kills scalability.
2. **Cross-domain calls go service→service**, never route→route and never by reaching into another domain's Prisma queries.
3. **A service owning a transaction exposes both forms** — `doThing(input)` and `doThingTx(tx, input)` — so callers can compose within one transaction. `pos-session.service.ts` already does this; follow it.
4. **Types and constants live in `lib/types/` and `lib/constants/`**, one concept in one place, re-exported rather than duplicated.
5. **Feature UI calls its own API client** in `src/features/<feature>/api/`, never `fetch` scattered through components.
6. **Reuse before creating.** ERP-lite posting, Notification Hub, idempotency keys, `withTenantContext`, advisory-lock helpers all exist — extend them; do not build parallel implementations.

### 10.4 API and UI delivery conventions

Applies to every endpoint and screen in §9.2 and §9.3.

**API**
1. **Every list endpoint is server-side paginated** (frontend rule #17) — `page` / `pageSize` with a capped maximum, plus total count. Filtering and sorting happen in SQL, never in the client. This applies to cash transfers, sessions, count sheets and the variance report.
2. Consistent envelope `{ success, data, error }`; money always **strings**; errors always one of the §10.5 codes.
3. Validation with Zod at the boundary, sharing the schema with the client (§10.2 rule 5).
4. `requirePermission` on every route, **and** branch scoping via a single shared helper (B3-2) rather than re-implemented per route — a security rule enforced in six places is enforced in five.

**UI**
5. **Every async surface has loading, empty, error and success states** (frontend rule #20). An empty denomination catalog, a drawer with no sessions, a variance report with no closes in range — each needs a designed empty state, not a blank panel.
6. **Responsive down to tablet.** Counter staff count cash on a tablet; `CmxDenominationCounter`, the close wizard and the transfer dialog must be usable at tablet width and touch-first, following the tablet work already done for the payment modal (`PaymentDockedSummaryBar`, 2-pane layout). Phone width must not break the layout.
7. **RTL verified on every touched screen**, not just new ones — the close wizard changes shift existing layout.
8. **Accessibility**: labelled inputs, focus order that matches counting order, keyboard-only operability for the counter (no mouse required to complete a count), ARIA on dialogs. Checked in Storybook (`/storybook` a11y).
9. **Print surfaces** (Z-report, receipt rounding line) verified at thermal-printer width and in both locales.

### 10.5 Per-migration obligations

For **every** migration in §9:

1. `TEXT` not `VARCHAR`; money `DECIMAL(19,4)`; object names ≤ 30 chars.
2. Full audit block (`created_at/_by/_info`, `updated_at/_by/_info`), `is_active`, `rec_status`, `rec_order`, `rec_notes`.
3. RLS enabled + tenant policy on every `org_*` table; composite FKs on `(id, tenant_org_id)` where the child is tenant-scoped.
4. `COMMENT ON TABLE` and `COMMENT ON COLUMN` for every new object (`/code-documentation`).
5. `DROP … RESTRICT` only. **No `CASCADE`** without the full manifest workflow in `docs/dev/drop-cascade-migration-workflow.md`.
6. **Reversal note in the migration header** — how to undo it, and whether undo is lossy. The repo forbids editing applied migrations, so the reversal is a *forward* migration; write down what it would contain.
7. **Prisma + generated types refreshed** after apply: `schema.prisma`, `npx prisma generate`, `types/database.generated.ts`, `types/database.ts`.
8. **Seed it fully** — every catalog ships complete, not with a placeholder row. See §10.12.
9. Created as a `.sql` file only. **STOP-AND-WAIT** for the owner to apply before continuing.

### 10.6 Error-code catalog

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
| `CASH_COUNT_TOTAL_MISMATCH` | 422 | C1-3 | Denomination lines ≠ submitted total |
| `CASH_COUNT_REQUIRED` | 422 | C1-7 | `closing_count_mode = DENOMINATION` and no lines supplied |
| `CASH_COUNT_IMMUTABLE` | 409 | C1-2c | Attempt to edit a recorded count — file a `RECOUNT` instead |
| `CASH_CURRENCY_NOT_IN_SESSION` | 422 | A4-3b | Payment currency has no active balance row and multi-currency is off |
| `DRAWER_SESSION_CLOSING` | 409 | C3-1 | Movement attempted while the session is counting |
| `VARIANCE_APPROVAL_REQUIRED` | 409 | C3-2 | Close exceeded threshold under `APPROVAL_REQUIRED` |
| `VARIANCE_APPROVER_IS_MAKER` | 403 | C3-4 | Maker ≠ checker violated |
| `POS_SESSION_DRAWER_PENDING_APPROVAL` | 409 | C3-7 | POS close blocked by unapproved drawer variance |
| `CASH_TRANSFER_DESTINATION_REQUIRED` | 422 | D1-3 | One-legged drop under `cash_drop_requires_dest` |
| `CASH_TRANSFER_NOT_PENDING` | 409 | D1-4 | Receive/cancel on a non-`PENDING` transfer |
| `DRAWER_MAX_CASH_EXCEEDED` | 422 | D1-5 | Only under `max_cash_enforce_mode = BLOCK` |
| `SHIFT_REPORT_ALREADY_FINAL` | 409 | D2-1 | Second Z attempted on a session |

`POS_SESSION_BRANCH_CONFLICT` and `POS_SESSION_ACTIVE_NOT_FOUND` already exist and are unchanged.

### 10.7 Cross-cutting gating decisions

| Dimension | Decision | Rationale |
|---|---|---|
| **Feature flags** | **Not used for this program.** No flag registered in `hq_ff_feature_flags_mst`. | Every new behaviour is already gated by a cash-control setting that defaults to today's behaviour. A second gate over the same switch adds confusion, and per `project_prelaunch_no_real_tenants` rollout flags have little value pre-launch. Revisit only if a wave needs to ship dark. |
| **Plan limits** | **Out of scope for this program.** | Drawer/terminal counts per plan are a separate commercial decision. Noted so the omission is deliberate, not forgotten. |
| **Notification Hub** | Reuse CMX-PRD-019; no new notifier. Events: stale session (B2-6), variance approval requested (C3), transfer awaiting receipt (D1-4), drawer over max cash (D1-5). | Building a second notification path would fragment delivery and preferences. |
| **Navigation** | All new routes go through `/navigation` dual-write; nav migrations consolidated into `0524`. | CRITICAL RULE #10. |
| **Access contracts** | Every new route gets the full golden path (`scaffold → derive --apply → wire --fix → check --wire → sync`). | CRITICAL RULE #14. |

### 10.8 Test matrix

Each wave must land its row before exit. Tenant-isolation coverage is mandatory for every new table and endpoint.

| Layer | Wave A | Wave B | Wave C | Wave D | Wave E |
|---|---|---|---|---|---|
| **Unit** | decimal math, currency tolerance (2dp/3dp), expected-cash SQL, **per-currency balance derivation (D14)**, **change-bearer → mode mapping (D16)** | timezone/business-date resolution, rollover modes | count totals from denomination lines, count immutability, blind-close shapes, three-band threshold resolution | transfer leg symmetry, Z snapshot builder | variance aggregation |
| **DB-integration** (local harness) | concurrent close ×2, payment-during-close, double-open, numbering race, **multi-currency session never cross-nets** | rollover idempotency, branch scoping | gate modes × threshold, maker≠checker | partial-failure rollback, immutability trigger | exclusive-mode enforcement |
| **API** | money serialized as strings, **balances endpoint returns one row per currency** | `POS_SESSION_REQUIRED` payload shape | expected cash genuinely absent pre-count | receive/cancel state machine | report endpoints |
| **Tenant isolation** | every new/changed endpoint — cross-tenant read and write must fail | ✓ | ✓ | ✓ | ✓ |
| **UI** | — | session-required interception | count wizard RTL + keyboard | transfer dialog, Z print RTL | screen removal regressions |

Standing rule: **no new test weakens an existing assertion to make it pass.** If an existing test breaks, the expectation is updated deliberately and noted (see A3-6).

### 10.9 Observability

- All new service errors go through `@/lib/utils/logger` with `{ tenantId, branchId, userId, drawerId, posSessionId }`. No `console.log`.
- **Log at WARN**: settings falling back to default due to a malformed row; variance exceeding threshold; max-cash breach; rollover force-closing a session.
- **Log at ERROR**: transfer leg failure/rollback, Z-report generation failure, currency mismatch rejection.
- Every audited action (settings change, variance approval, force-close, transfer) records actor + timestamp + reason. Reason is **mandatory** on force-close, variance approval, and transfer cancel.

### 10.10 Progress and documentation cadence

Status and docs are **tasks with owners**, not an afterthought at the end.

| When | Required action |
|---|---|
| **Each work package closed** (A1, A2, C3, …) | Tick its boxes in this plan; update the package row in `STATUS.md` with date + outcome |
| **Each migration applied by the owner** | Mark it Applied in the `STATUS.md` migration table; record local/remote |
| **Each wave exit** | Update the wave row to COMPLETE; log gate results in `STATUS.md` → Validation gate history; refresh `QA_TEST_GUIDE.md`; invoke **`/documentation`** for that wave's surfaces |
| **Any new/changed permission, nav entry, flag, setting, access contract** | Refresh platform inventories and record remaining drift |
| **Any decision taken mid-implementation** | Add a `D<n>` row to `STATUS.md` — decisions made and then forgotten are how plans rot |
| **Program exit** | Full documentation generation — see §13 |

`STATUS.md` is the single progress record for this program. If it disagrees with memory or with a summary message, **`STATUS.md` wins.**

### 10.11 Definition of Done — per work package

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

### 10.12 Seed completeness and data provenance

**Standing rule: every migration that creates a catalog seeds it completely in the same migration.** A catalog shipped with two example rows and a "TODO: seed the rest" is a half-built feature that looks finished, and the missing rows surface as a runtime failure in front of a cashier rather than as a red test.

"Completely" means: every code the domain actually has, bilingual EN/AR (`name` / `name2`, `description` / `description2`), `display_order` set deliberately rather than all zeros, and `ON CONFLICT DO UPDATE` so a re-run is safe.

#### What can be seeded exhaustively from domain knowledge

These have a closed, knowable set — there is no excuse for a partial seed:

| Catalog | Migration | Rows |
|---|---|---|
| `sys_rounding_context_cd` | `0530` | 15 contexts |
| `sys_rounding_mode_cd` | `0530` | `HALF_UP`, `HALF_DOWN`, `HALF_EVEN`, `UP`, `DOWN`, `CEILING`, `FLOOR` — each with a description stating its **sign behaviour** (§3.2.5 of the handoff) |
| `sys_cash_count_context_cd` | `0518` | `OPENING`, `SPOT`, `CLOSING`, `RECOUNT` |
| `sys_cash_drawer_session_status_cd` | `0521` | `+ CLOSING`, `+ CLOSED_PENDING_APPROVAL` |
| `sys_cash_transfer_type_cd` | `0522` | `DROP_TO_SAFE`, `SAFE_TO_DRAWER`, `DRAWER_TO_DRAWER`, `SAFE_TO_BANK`, `PETTY_CASH_ISSUE`, `PETTY_CASH_RETURN` |
| `sys_cash_drawer_movement_type_cd` | `0522` | `+ TRANSFER_IN/OUT`, `BANK_DEPOSIT`, `SAFE_REPLENISHMENT`, `ROUNDING_ADJUSTMENT`, `CORRECTION` |
| `sys_pos_shift_report_type_cd` | `0523` | `X`, `Z` |
| Permissions | `0516` | every code in §3.2, no partial RBAC — **including `cash_drawer:count`; `RECOUNT` reuses `cash_drawer:approve_variance` rather than adding a code** |

#### What requires external research

Currency reference data is real-world fact, not domain logic. **Research it — do not approximate, and do not ship a token three-row sample.**

| Data | Migration | Scope |
|---|---|---|
| `ACCOUNTING` rounding rules | `0532` | all **181** currencies — derived mechanically from `sys_currency_cd.minor_unit`, no research needed |
| `CASH_TENDER` / `CASH_CHANGE` increments | `0532` | researched per currency — which coins actually circulate |
| Denominations (notes + coins) | `0533` | researched per currency — full note and coin set |

- [ ] SEED-1 **Use web search for currency reference data.** Primary sources in order: the issuing **central bank** (authoritative for circulating denominations and withdrawal dates), then ISO 4217, then a reputable secondary source. Never a single unsourced page.
- [ ] SEED-2 **Record provenance on every researched row**, mirroring what `0265` already does:
  `metadata = {"seed_source": "<url or standard>", "verified_on": "<date>", "review_status": "curated|derived|unverified"}`.
  A row nobody can trace is a row nobody can safely correct later.
- [ ] SEED-3 **Tier the effort honestly.** Curate and verify in this order, and mark the rest `derived`:
  1. **GCC six** — OMR, AED, SAR, KWD, BHD, QAR. These are what the product ships on; they get full note+coin sets and verified cash increments.
  2. **Common secondary currencies** for GCC counters — USD, EUR, GBP, INR. Relevant once multi-currency (D14) is enabled for a tenant.
  3. **Everything else** — seed `ACCOUNTING` derived from `minor_unit`, leave denominations absent or `is_active = false`. A currency with no denomination rows falls back to `TOTAL_ONLY` counting (C1-1a), which is correct behaviour, not a gap.
- [ ] SEED-4 **Arabic names are researched too, not machine-translated.** "50 Baisa" → "٥٠ بيسة" uses Arabic-Indic numerals and the correct subunit noun; `0265` already seeds `minor_unit_name2` per currency — reuse those exact strings rather than inventing new ones.
- [ ] SEED-5 **Flag every value that changes money handling for owner confirmation.** Cash rounding increments and the `CASH_CHANGE` bearer policy determine what a customer is physically handed. I can research and propose; **central-bank verification before these go live is the owner's call**, and `review_status: "unverified"` must be visible in the migration comment until that happens.
- [ ] SEED-6 **Re-runnable seeds.** `ON CONFLICT (…) DO UPDATE SET …` on every catalog insert, so a corrected seed can be re-applied as a new forward migration without a manual cleanup.

#### What is deliberately not seeded

`org_fin_cash_ctrl_stng_cf` (`0515`) ships with **zero rows** by design — it stores overrides only, and defaults live in `lib/constants/cash-control.ts` (§3.1.2). A tenant with no row is fully configured. Do not "helpfully" seed a default row per tenant; that turns an inherited default into a frozen copy.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| A3 changes stored `expected_cash_amount` values | Pre-launch, no real tenants — recompute demo data rather than shim. Add a one-off verification query comparing old vs new for existing demo sessions. |
| B1 mandatory session breaks an existing client path | Ship behind `POS_SESSION_REQUIRED_FOR_CASH`; default `true` but flippable per tenant/branch without a deploy. |
| C3 `APPROVAL_REQUIRED` can strand a drawer overnight | Force-close with `pos_session:force_close` remains available and audited; document in the QA guide. |
| D1 ERP-lite posting coupling | Reuse the existing posting engine; no new posting logic. Validate against `erp-lite-post-audit.service.ts`. |
| Cash-control settings sit outside the general settings system (D3) | The single-resolver design (§3.1.3) confines the coupling to one private function. ADR-056 records the exit criteria. Risk of drift is real but bounded, and the table stores overrides only, so defaults never depend on it. |
| Two settings systems confuse operators | The admin screen is labelled as cash-control-specific and lives under `internal_fin`, not under general Settings, so the split is visible rather than hidden. |
| Program size | Waves are independently shippable; Wave A alone closes the "wrong money written" class. |

## 12. Out of scope

- Offline POS / queued tenders.
- Multi-currency drawers (one drawer stays single-currency; A4 makes the constraint explicit).
- Fiscal-device or e-invoicing integration beyond the Z-report artifact.
- Reopening a closed POS session (ADR-054 keeps this out of scope).

---

## 13. Program documentation close-out

Runs once, after Wave E. Per-wave `/documentation` passes cover their own surfaces; this pass covers the program as a whole and leaves the repo's documentation truthful about the new cash-control model.

- [ ] DOC-1 **Invoke `/documentation`** for the full program surface. If overlap or duplicate sources of truth surface, escalate to the specialist skills — `/documentation-canonicalization` when two folders claim the same domain, `/documentation-pack-repair` to complete the canonical pack, `/documentation-archive-migration` to stub out superseded docs, `/documentation-audit` for the final coverage check.
- [ ] DOC-2 **Feature pack** for this folder: PRD-level overview, ADRs, STATUS, QA guide, resume doc — completed and internally consistent.
- [ ] DOC-3 **Amend `ADR-054`** (User-Owned POS Sessions) with everything this program changed: mandatory lineage, rollover, branch-scoped timezone, the drawer-status allow-list, and the settings-driven controls.
- [ ] DOC-4 **New ADRs** — `ADR-056` cash-control settings in a finance-owned table (W0-2b); an ADR for the two-legged custody chain if D1's model warrants one; an ADR for the immutable Z-report artifact.
- [ ] DOC-5 **Update `POS_Session_Management_V1.md`** to v2, or supersede it with a stub pointing here — do not leave two documents describing different session behaviour.
- [ ] DOC-6 **Implementation-requirements doc** per `.claude/skills/implementation/prd-rules.md`: permissions, navigation tree, settings, feature flags (none — record why), plan limits (none — record why), i18n keys, API routes, migrations, RBAC changes, constants/types, env vars.
- [ ] DOC-7 **Cross-project**: update `docs/dev/rules/integration-contracts.md` with the currency ownership split and the cash-control settings deviation; close out the HQ currency handoff (now in `cleanmatexsaas/docs/features/Currency_Setup/`) with what HQ actually shipped.
- [ ] DOC-8 **Refresh generated artifacts**: `npm run rebuild:platform-info-inventories`, `check:platform-info-inventories`, `sync:ui-access-contract`. Resolve or allowlist every entry in `DRIFT_REPORT.md`.
- [ ] DOC-9 **Operator-facing documentation** — this program adds real operational procedure, not just code. Cover: opening and closing a drawer under blind close, what to do with an over-threshold variance, how to perform a drop to safe, what a Z-report is and when it is generated, and what happens to a session at business-date rollover. Bilingual (EN/AR).
- [ ] DOC-10 **Final `STATUS.md`** — all waves COMPLETE, every migration marked Applied, full decision log `D1…Dn`, complete gate history, open follow-ups listed explicitly rather than implied.
