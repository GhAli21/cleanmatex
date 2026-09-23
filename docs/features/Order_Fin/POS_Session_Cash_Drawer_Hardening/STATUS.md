# STATUS — POS Session & Cash Drawer Production Hardening

**Program status:** PLAN AWAITING APPROVAL
**Last updated:** 2026-09-23
**Plan:** [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

## Owner decisions on record

| # | Decision | Date | Resolution |
|---|---|---|---|
| D1 | Blind close | 2026-09-23 | Tenant-configurable (`CASH_DRAWER_BLIND_CLOSE`), branch-overridable |
| D2 | Variance gating | 2026-09-23 | Tenant-configurable (`CASH_DRAWER_VARIANCE_GATE_MODE`: `OFF` / `WARN_ONLY` / `APPROVAL_REQUIRED`), branch-overridable. B16's current behaviour is preserved, renamed `WARN_ONLY` (D5). |
| D3 | Where cash-control settings live | 2026-09-23 | Dedicated table `org_fin_cash_ctrl_stng_cf` + one standalone resolver service, **not** the general `sys_tenant_settings_cd` catalog. Storage swappable later via a single private function. Requires ADR-055 and a tenant-side admin screen. |
| D5 | Variance gate mode name | 2026-09-23 | `FLAG` renamed **`WARN_ONLY`**; the close now also surfaces an explicit over-threshold warning and a supervisor queue entry, so the name is accurate. |
| D6 | Cash-control settings route | 2026-09-23 | **`/dashboard/settings/payments/cash-control-settings`** (not `internal_fin`); API `/api/v1/settings/payments/cash-control`. |
| D8 | Rounding authority | 2026-09-23 | **`sys_currency_rounding_rules_cd` expanded** to carry all rounding contexts (`rounding_type`: CASH_TENDER / CASH_CHANGE / TAX / ACCOUNTING / FX_CONVERSION / …) + `rounding_increment_minor`, seeded for all 181 currencies. `sys_currency_cd.cash_rounding_*` superseded and retired. HQ-owned. |
| D9 | Denomination catalog | 2026-09-23 | **HQ owns** `sys_currency_denominations_cd` — definition, seed, admin UI. Tenant app consumes read-only and owns only `org_currency_denom_cf` overrides. |
| D10 | Decimal-place authority | 2026-09-23 | **`sys_currency_cd`** is authoritative. `TENANT_DECIMAL_PLACES` deprecated to display-only (deprecate → migrate call sites → retire). |
| D11 | `VARCHAR` → `TEXT` on `sys_currency_cd` | 2026-09-23 | Approved; folded into the next currency migration rather than raised separately. |
| D7 | Cash-tender rounding (tenant side) | 2026-09-23 | Package **A6** adds **no migration** — it consumes HQ's rounding rules (D8). An earlier draft proposed a duplicate `cash_rounding_unit`; corrected after inspecting the HQ repo. Until HQ seeds, cash rounding no-ops and 3-decimal drawers keep accumulating sub-unit residue. |
| D4 | Table shape | 2026-09-23 | **Explicit typed column per setting**, not generic `stng_code`/`stng_value` rows. One row per scope; every setting column nullable (`NULL` = inherit); enum values enforced by DB `CHECK` constraints. Adding a setting costs an `ALTER TABLE` — accepted for DB-enforced type safety on financial policy. |

## Wave status

| Wave | Theme | Status | Migrations | Applied? |
|---|---|---|---|---|
| W0 | Foundation | NOT STARTED | 0515–0516 | — |
| A | Money & concurrency integrity | NOT STARTED | 0517, 0527 | — |
| B | Session enforcement & lifecycle | NOT STARTED | 0520, 0526 | — |
| C | Shift controls | NOT STARTED | 0518–0519, 0521, 0529 | — |
| D | Custody chain & audit artifacts | NOT STARTED | 0522–0523 | — |
| E | Consolidation & attribution | NOT STARTED | 0524–0525 | — |

## Open cross-project obligations

| ID | Repo | Obligation | Status |
|---|---|---|---|
| HQ-CUR-1 | `cleanmatexsaas` | **Expand + seed `sys_currency_rounding_rules_cd`** per handoff §3 (rounding_type, minor-unit increments, unified `sys_rounding_mode_cd`, PK change, 181-currency seed). **Blocks A6.** | DECIDED — HQ TO IMPLEMENT |
| HQ-CUR-2 | `cleanmatexsaas` | **Define + seed `sys_currency_denominations_cd`** per handoff §4. **Blocks C1 counting sheets.** | DECIDED — HQ TO IMPLEMENT |
| HQ-CUR-3 | `cleanmatexsaas` | State decimal-place authority (§5) and fold `VARCHAR`→`TEXT` into the next currency migration (§6). | DECIDED — HQ TO IMPLEMENT |
| — | `cleanmatexsaas` | **Deferred by D3.** HQ-console editing of cash-control settings is out of scope until/unless they fold into `sys_tenant_settings_cd`. ADR-055 records the deviation from `integration-contracts.md`. | DEFERRED |

## Open questions carried into implementation

| ID | Question | Blocks | Default if unanswered |
|---|---|---|---|
| Q1 | Does a job scheduler already exist in this repo, or is `pg_cron` the first one? | B2-5 | Verify at implementation; do not add a second scheduler |
| Q2 | Z-report shape for a multi-currency session: one row per currency, or one row with per-currency snapshot detail? | D2-4 | One row per currency |
| Q3 | Are `cash_drawer:open_session` / `cash_drawer:close_session` already seeded in the DB permissions table? | W0-9 | Remote-MCP audit settles it |
| Q4 | Settings-change audit: reuse an existing audit table or add `org_fin_cash_ctrl_audit_dtl` in `0515`? | W0-4b | Dedicated table — cleanest before-/after-diff shape |



Q5 and Q6 are **answered** — see D5 and D6 below. Q1–Q4 have safe defaults and do not block.

## Completeness pass — 2026-09-23

Gaps found and closed in a review of the plan against repo rules:

| Gap | Where closed |
|---|---|
| Prisma schema / generated types never mentioned | W0-3b + §10.1 standing requirement |
| `setCashControlSetting` signature still key/value after D4 | §3.1.3 — now `updateCashControlSettings(scope, patch, actor)` |
| No audit trail on settings changes (a control that can be silently disabled) | W0-4b |
| `withTenantContext` / `$transaction` nesting order unspecified — reversing it silently voids RLS | A2-1 note |
| `CLOSED_PENDING_APPROVAL` would slip past `assertLinkedDrawerIsClosed` (deny-list on `'OPEN'`) | C3-7, C3-8 |
| Existing `cash-drawer-close-preview.test.ts` breaks on Decimal money — undocumented | A3-6 |
| Reconciliation report consumes the old tolerance / float totals | A3-7 |
| No error-code catalog — codes invented ad hoc across waves | §10.2 |
| Feature flags and plan limits never addressed | §10.3 (deliberate: neither used) |
| No consolidated test matrix or tenant-isolation requirement | §10.4 |
| No observability / logging spec | §10.5 |
| No Definition of Done | §10.6 |
| No migration reversal notes | §10.1 item 6 |
| No dependency graph — D2-before-A3 and C3-without-C3-7 were both silently possible | §2 |

## Validation gate history

_None yet — no code written._
