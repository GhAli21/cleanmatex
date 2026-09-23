# STATUS — POS Session & Cash Drawer Production Hardening

**Program status:** PLAN AWAITING APPROVAL
**Last updated:** 2026-09-23
**Plan:** [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

## Owner decisions on record

| # | Decision | Date | Resolution |
|---|---|---|---|
| D1 | Blind close | 2026-09-23 | Tenant-configurable (`CASH_DRAWER_BLIND_CLOSE`), branch-overridable |
| D2 | Variance gating | 2026-09-23 | Tenant-configurable (`CASH_DRAWER_VARIANCE_GATE_MODE`: `OFF` / `FLAG` / `APPROVAL_REQUIRED`), branch-overridable. B16's current behaviour is preserved as the `FLAG` mode. |
| D3 | Where cash-control settings live | 2026-09-23 | Dedicated table `org_fin_cash_ctrl_stng_cf` + one standalone resolver service, **not** the general `sys_tenant_settings_cd` catalog. Storage swappable later via a single private function. Requires ADR-055 and a tenant-side admin screen. |
| D4 | Table shape | 2026-09-23 | **Explicit typed column per setting**, not generic `stng_code`/`stng_value` rows. One row per scope; every setting column nullable (`NULL` = inherit); enum values enforced by DB `CHECK` constraints. Adding a setting costs an `ALTER TABLE` — accepted for DB-enforced type safety on financial policy. |

## Wave status

| Wave | Theme | Status | Migrations | Applied? |
|---|---|---|---|---|
| W0 | Foundation | NOT STARTED | 0515–0516 | — |
| A | Money & concurrency integrity | NOT STARTED | 0517, 0527 | — |
| B | Session enforcement & lifecycle | NOT STARTED | 0520, 0526 | — |
| C | Shift controls | NOT STARTED | 0518–0519, 0521 | — |
| D | Custody chain & audit artifacts | NOT STARTED | 0522–0523 | — |
| E | Consolidation & attribution | NOT STARTED | 0524–0525 | — |

## Open cross-project obligations

| ID | Repo | Obligation | Status |
|---|---|---|---|
| — | `cleanmatexsaas` | **Deferred by D3.** HQ-console editing of cash-control settings is out of scope until/unless they fold into `sys_tenant_settings_cd`. ADR-055 records the deviation from `integration-contracts.md`. | DEFERRED |

## Open questions carried into implementation

| ID | Question | Blocks | Default if unanswered |
|---|---|---|---|
| Q1 | Does a job scheduler already exist in this repo, or is `pg_cron` the first one? | B2-5 | Verify at implementation; do not add a second scheduler |
| Q2 | Z-report shape for a multi-currency session: one row per currency, or one row with per-currency snapshot detail? | D2-4 | One row per currency |
| Q3 | Are `cash_drawer:open_session` / `cash_drawer:close_session` already seeded in the DB permissions table? | W0-9 | Remote-MCP audit settles it |
| Q4 | Settings-change audit: reuse an existing audit table or add `org_fin_cash_ctrl_audit_dtl` in `0515`? | W0-4b | Dedicated table — cleanest before-/after-diff shape |
| Q5 | `FLAG` mode name — keep, or rename to `WARN_ONLY` / `RECORD_ONLY`? | W0-3 (constant), `0515` CHECK | Keep `FLAG` |
| Q6 | Is `/dashboard/internal_fin/cash-control-settings` the edit surface you want? | W0-5 | Yes, tenant-side screen |

**Owner decisions still needed on Q5 and Q6 before W0 starts** — both are cheap now and expensive after `0515` is applied (Q5 lands in a `CHECK` constraint; Q6 lands in navigation + access contracts).

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
