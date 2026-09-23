# STATUS — POS Session & Cash Drawer Production Hardening

**Program status:** IN PROGRESS — Wave 0 (Foundation)
**Last updated:** 2026-09-23
**Plan:** [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

## Owner decisions on record

| # | Decision | Date | Resolution |
|---|---|---|---|
| D1 | Blind close | 2026-09-23 | Tenant-configurable (`CASH_DRAWER_BLIND_CLOSE`), branch-overridable |
| D2 | Variance gating | 2026-09-23 | Tenant-configurable (`CASH_DRAWER_VARIANCE_GATE_MODE`: `OFF` / `WARN_ONLY` / `APPROVAL_REQUIRED`), branch-overridable. B16's current behaviour is preserved, renamed `WARN_ONLY` (D5). |
| D3 | Where cash-control settings live | 2026-09-23 | Dedicated table `org_fin_cash_ctrl_stng_cf` + one standalone resolver service, **not** the general `sys_tenant_settings_cd` catalog. Storage swappable later via a single private function. Requires ADR-056 and a tenant-side admin screen. |
| D5 | Variance gate mode name | 2026-09-23 | `FLAG` renamed **`WARN_ONLY`**; the close now also surfaces an explicit over-threshold warning and a supervisor queue entry, so the name is accurate. |
| D6 | Cash-control settings route | 2026-09-23 | **`/dashboard/settings/payments/cash-control-settings`** (not `internal_fin`); API `/api/v1/settings/payments/cash-control`. |
| D8 | Rounding authority | 2026-09-23 | **`sys_currency_rounding_rules_cd` expanded** to carry all rounding contexts (`rounding_type`: CASH_TENDER / CASH_CHANGE / TAX / ACCOUNTING / FX_CONVERSION / …) + `rounding_increment_minor`, seeded for all 181 currencies. `sys_currency_cd.cash_rounding_*` superseded and retired. HQ-owned. |
| D9 | Denomination catalog | 2026-09-23 | **HQ owns** `sys_currency_denominations_cd` — definition, seed, admin UI. Tenant app consumes read-only and owns only `org_currency_denom_cf` overrides. |
| D10 | Decimal-place authority | 2026-09-23 | **`sys_currency_cd`** is authoritative. `TENANT_DECIMAL_PLACES` deprecated to display-only (deprecate → migrate call sites → retire). |
| D11 | `VARCHAR` → `TEXT` on `sys_currency_cd` | 2026-09-23 | Approved; folded into the next currency migration rather than raised separately. |
| D7 | Cash-tender rounding (tenant side) | 2026-09-23 | Package **A6** adds **no migration** — it consumes HQ's rounding rules (D8). An earlier draft proposed a duplicate `cash_rounding_unit`; corrected after inspecting the HQ repo. Until HQ seeds, cash rounding no-ops and 3-decimal drawers keep accumulating sub-unit residue. |
| D12 | Rounding policy table refined | 2026-09-23 | Table renamed `sys_currency_rounding_rules_cd` → **`_cf`** (configuration, not code values). `rounding_type` → **`rounding_context`**. **`calculation_decimal_places` split from `output_decimal_places`** to prevent premature rounding in multi-step computation. Tenant-override layer designed for but deferred, with `is_tenant_overridable` so TAX/ACCOUNTING cannot be tenant-changed. **Rejected:** `rounding_increment NUMERIC(19,6)` — stays `rounding_increment_minor BIGINT`, because decimal increments reintroduce the drift this programme exists to remove. |
| D13 | Integer width + decimal fallback | 2026-09-23 | **`INTEGER`, not `BIGINT`**, for every minor-unit column (`rounding_increment_minor`, `denomination_minor`) — realistic max ~1,000,000 against a 2.1bn ceiling. **`calculation_decimal_places` and `output_decimal_places` are nullable**, each falling back independently to `sys_currency_cd.minor_unit`; `rounding_increment_minor` NULL = no increment snapping. A currency with no rule row still rounds correctly to its own minor unit. |
| D14 | Multi-currency readiness (Q7) | 2026-09-23 | **Per-currency session balances** via `org_cash_sess_curr_dtl` (mig `0529`). The proposed single-currency `CHECK` is **dropped** — it would have welded the schema shut. Single-currency tenants see one row and no UI change; multi-currency later is a config flip, not a migration. |
| D15 | Counts as snapshots (Q8) | 2026-09-23 | **Header + detail**: `org_cash_drawer_counts_mst` (OPENING/SPOT/CLOSING/RECOUNT) + `org_cash_count_denom_dtl`. Replaces the flat count-sheet design. Gains spot checks, supervisor recounts, snapshotted `expected_amount`, and a frozen denomination value so historical counts never re-value. Counts are immutable; a correction is a new count. FK on `denomination_id` (series-capable), not on the value. |
| D16 | Cash-change rounding is tenant policy (Q9) | 2026-09-23 | `cash_change_bearer` (`BUSINESS` default / `CUSTOMER` / `NEAREST`) + `cash_change_round_to_minor`, on `org_fin_cash_ctrl_stng_cf`. **Tender rounding stays HQ-only** — what a customer can physically hand over is coin physics; what the shop hands back is a choice. Settings resolve INTO the single `(mode, increment)` rounding contract; no second rounding implementation. UI warns on `CUSTOMER`. |
| D4 | Table shape | 2026-09-23 | **Explicit typed column per setting**, not generic `stng_code`/`stng_value` rows. One row per scope; every setting column nullable (`NULL` = inherit); enum values enforced by DB `CHECK` constraints. Adding a setting costs an `ALTER TABLE` — accepted for DB-enforced type safety on financial policy. |
| D17 | Cash-control settings audit table | 2026-09-23 | **Dedicated `org_fin_cash_ctrl_audit_dtl`, new migration `0516`** (own ledger entry, not folded into `0515` — that migration already applied, and CRITICAL RULE #2 forbids editing an applied migration). Reusing the general-settings `org_stng_audit_log_tr` was evaluated and rejected: its RLS policy is SELECT-only (no INSERT path was ever added — it's written by a DB trigger tied to `sys_tenant_settings_cd`/`org_tenant_settings_cf`, not by application code), its `stng_audit_scope` vocabulary has no `DRAWER` level, and reusing it would recouple cash-control settings into the general settings audit system that D3 deliberately keeps separate. **Consequence:** the migration number originally reserved for §3.2 permissions (`0516`) shifts to `0517`; treat every migration number in `IMPLEMENTATION_PLAN.md` from this point as nominal — this table's wave-status ledger below is authoritative for the actual sequence, per the "STATUS.md wins" rule (START_HERE.md §2). |

## External architecture review — 2026-09-23

Reviewed `CleanMateX_Currency_Denomination_Cash_Drawer_Architecture.md` (external, 1069 lines) against this plan.
Full evaluation: [ARCHITECTURE_REVIEW_2026-09-23.md](./ARCHITECTURE_REVIEW_2026-09-23.md)

**Verdict: strong document.** 12 ideas adopted, 3 rejected, 9 corrections required, 4 gaps it does not cover.
Best contribution: asymmetric `CASH` vs `CASH_CHANGE` rounding (CEILING on change so the business absorbs the remainder).
It independently confirms D8 (rounding is policy, not currency property) and D13 (integer minor units).

**Q7–Q9 answered 2026-09-23 → D14/D15/D16. Plan amended.**

| ID | Question |
|---|---|
| Q10 | **RESOLVED 2026-09-23** — CLAUDE.md briefly specified money as `DECIMAL(22,6)`; the owner reverted it to `DECIMAL(19,4)`. The plan already specced `(19,4)` throughout and matches the 294 existing money columns, so **no change is required**. No mixed-scale risk in the reconciliation path. | — | — |
| Q7 | **ANSWERED → D14** — be ready for multi-currency |
| Q8 | **ANSWERED → D15** — header + detail adopted |
| Q9 | **ANSWERED → D16** — made a tenant setting rather than a fixed rule |

## Wave status

**Migration ledger note (added 2026-09-23, D17):** `0516` is now the cash-control **audit table**, not permissions. Every migration number below and in `IMPLEMENTATION_PLAN.md` from `0516` onward is therefore nominal (original plan minus this insertion); this table reflects the actual sequence as each migration is written and is authoritative on any conflict.

| Wave | Theme | Status | Migrations (actual) | Applied? |
|---|---|---|---|---|
| W0 | Foundation | IN PROGRESS | 0515 (settings), 0516 (audit) | 0515 APPLIED (local+remote) 2026-09-23; 0516 pending owner apply |
| W0-perm | Permissions (was planned as part of `0516`) | IN PROGRESS | 0517 | pending owner apply |
| W0-HQ | HQ-specified currency migrations (authored here) | NOT STARTED | 0531–0535 (shift +1) | — |
| A | Money & concurrency integrity | NOT STARTED | 0518, 0528 (shift +1) | — |
| B | Session enforcement & lifecycle | NOT STARTED | 0521, 0527 (shift +1) | — |
| C | Shift controls | NOT STARTED | 0519–0520, 0522, 0530 (shift +1) | — |
| D | Custody chain & audit artifacts | NOT STARTED | 0523–0524 (shift +1) | — |
| E | Consolidation & attribution | NOT STARTED | 0525–0526 (shift +1) | — |

## Open cross-project obligations

| ID | Repo | Obligation | Status |
|---|---|---|---|
| HQ-CUR-1 | `cleanmatexsaas` | **Supply the curated rounding VALUES** — GCC `CASH_TENDER` + `CASH_CHANGE` increments and modes, central-bank verified. The migrations themselves (`0530`–`0532`) are authored here as packages HQ-1–HQ-3. | AWAITING HQ VALUES |
| HQ-CUR-2 | `cleanmatexsaas` | **Supply the denomination SETS** for the GCC six + the HQ admin UI. Migration `0533` is authored here as package HQ-4. | AWAITING HQ VALUES |
| HQ-CUR-3 | `cleanmatexsaas` | Sign off the rounding-context list and mode vocabulary (§3.2, §3.5); state decimal-place authority in the Currency Setup spec (§5). `VARCHAR`→`TEXT` is folded into `0530` here. | AWAITING HQ SIGN-OFF |
| — | `cleanmatexsaas` | **Deferred by D3.** HQ-console editing of cash-control settings is out of scope until/unless they fold into `sys_tenant_settings_cd`. ADR-056 records the deviation from `integration-contracts.md`. | DEFERRED |

## Open questions carried into implementation

| ID | Question | Blocks | Default if unanswered |
|---|---|---|---|
| Q1 | Does a job scheduler already exist in this repo, or is `pg_cron` the first one? | B2-5 | Verify at implementation; do not add a second scheduler |
| Q2 | **RESOLVED by D14** — one report row per currency, sourced from `org_cash_sess_curr_dtl`. Operational balances are already per-currency and must never be cross-netted. | — | — |
| Q3 | **RESOLVED 2026-09-23 (W0-9)** — yes, both already seeded 2026-05-17, enforced in route code; the gap was only the missing `finance-perm.ts` mirror, now closed. Separately found: 9 more `cash_drawer:*` codes (`cash_in`/`cash_out`/`cash_drop`/`close`/`force_close`/`open`/`record_movement`/`view_movements`/`view_reports`) are also seeded but unmirrored in `finance-perm.ts` — **pre-existing drift, out of scope for this program**, left for a future cleanup. | — | — |
| Q4 | **RESOLVED by D17 (2026-09-23)** — dedicated `org_fin_cash_ctrl_audit_dtl`, new migration `0516` (`0515` already applied, so folding in is no longer possible). | — | — |



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

## Standing execution rules (plan §10.1-10.3)

Every work package in this program is bound by:

- **§10.1** CLAUDE.md governs; load the required skill before writing, use the specialist workflow skills, read rule docs rather than working from memory, agents for exploration, CRITICAL RULES honoured.
- **§10.2** Reusable UI first — search `src/ui/` before writing; extract a `Cmx*` when a thing will appear twice; shared Zod validation on client and server; `cmxMessage` for all feedback.
- **§10.3** Separation of concerns — thin routes, every domain owns its service module, cross-domain calls go service→service, reuse existing infrastructure over parallel implementations.
- **§10.12** Seed completeness — every catalog ships fully seeded in its own migration, bilingual, `ON CONFLICT DO UPDATE`. Currency reference data is researched from central-bank sources with `seed_source` / `verified_on` / `review_status` recorded per row; money-affecting values stay `unverified` until the owner confirms.
- **§10.9** Progress and documentation cadence — STATUS updated per package/migration/wave; `/documentation` at every wave exit; §13 close-out at program end.

## Completeness audit #2 — 2026-09-23

Second pass over the plan. Two internal inconsistencies and seven coverage gaps found and closed:

| Finding | Severity | Closed at |
|---|---|---|
| Count sheet specced `denomination_value DECIMAL` while the HQ catalog keys on `denomination_minor BIGINT` — FK impossible, decimal drift in the one place that must be exact integer counting | **inconsistency** | C1-2 |
| Ledger row `0518` still claimed the denomination catalog after D9 moved it to HQ | **inconsistency** | §9.1 |
| Sequence gap `0527`→`0529` left by the A6 rewrite | numbering | renumbered to `0528` |
| Cash-control settings route missing from the navigation migration | gap | E4-1 |
| No API endpoint inventory — endpoints were scattered across packages | gap | §9.2 (14 endpoints + 7 changed) |
| No screen / route inventory | gap | §9.3 |
| No pagination rule for new list endpoints (repo frontend rule #17) | gap | §10.4 |
| No loading / empty / error state requirement (rule #20) | gap | §10.4 |
| No tablet / responsive requirement — counter staff count cash on tablets | gap | §10.4 |
| No accessibility requirement beyond RTL | gap | §10.4 |
| No index or query-plan strategy for the new report reads | gap | §9.4 + IDX-1/IDX-2 |
| No demo-data recompute after the Decimal switch changes stored variance | gap | A3-6b |
| No security review despite money + permissions + service-token surface | gap | E5-3, E5-4 |

## Completeness audit #3 — 2026-09-23

Audited how D14/D15/D16 propagated. **They had been applied to their own packages but never reached the cross-cutting inventories** — the classic shape of a plan drifting out of internal consistency.

| Finding | Severity | Closed at |
|---|---|---|
| `org_cash_sess_curr_dtl` (D14) absent from **every** inventory — indexes, services, endpoints, screens, test matrix | **inconsistency** | §9.2, §9.3, §9.4, §10.3, §10.8 |
| `org_cash_count_sheets_dtl` (deleted by D15) still referenced in the index strategy, service list, error codes and test matrix | **inconsistency** | same sections |
| `count_sheet_mode` CHECK still in §3.1.2 after D15 replaced it with three count-mode columns | **inconsistency** | §3.1.2 |
| D16 cash-change columns had no CHECK constraints | gap | §3.1.2 |
| `count_sheet_total` on the session duplicates the counts header `counted_amount` — two authorities for what was counted | **latent bug** | removed, rationale recorded |
| No ordering constraint on the three variance bands — a reason band above the approval band silently disables the stricter gate | **latent bug** | `chk_ofccs_thr_order` |
| SPOT and RECOUNT had no UI entry point despite D15 adding the types | gap | C1-4b, C1-4c |
| No per-currency balances endpoint; no `/cash/change/preview` endpoint | gap | §9.2 |
| `0529` listed under Wave A in the ledger but Wave C everywhere else | numbering | ledger corrected to C |
| Five error codes missing for the new flows | gap | §10.6 |
| Q2 (Z-report multi-currency shape) still shown as open — **D14 answers it** | stale | D2-4 resolved: one row per currency |

## Validation gate history

| Date | Package | Gates run | Result |
|---|---|---|---|
| 2026-09-23 | W0-2 (migration `0515`) | `supabase db push --include-all` (owner) | ✅ Applied local + remote, after fixing `uuid_nil()` → sentinel UUID (see W0-1 note) |
| 2026-09-23 | W0-3b (Prisma) | `npx prisma validate`, `npx prisma generate` | ✅ Schema valid (pre-existing unrelated `onDelete: SetNull` warnings only); client regenerated |
| 2026-09-23 | W0-3 + W0-4 (constants + resolver service) | `npx tsc --noEmit`, `npx eslint --quiet` (both new files) | ✅ Clean |
| — | W0-4b (migration `0516`) | — | Written, **NOT applied** — STOP-AND-WAIT |
| 2026-09-23 | W0-9/W0-10/W0-11 (permissions) | Remote MCP read-only audit (`sys_auth_permissions`, `sys_auth_roles`) | ✅ Audit complete; migration `0517` written, **NOT applied** — STOP-AND-WAIT; TS mirrors updated, `npx tsc --noEmit` + `npx eslint --quiet` clean |

## Work-package progress (Wave 0)

| Package | Status | Notes |
|---|---|---|
| W0-1 | ✅ Done | Remote existence + `uuid_nil()` checks |
| W0-2 | ✅ Applied | Migration `0515` |
| W0-2b | ✅ Done | ADR-056 |
| W0-3 | ✅ Done | `lib/constants/cash-control.ts` |
| W0-3b | ✅ Done | Prisma model + client generated |
| W0-4 | 🟡 Partial | Read side (`getCashControlSettings`) shipped; write side deferred to W0-4b |
| W0-4b | 🟡 Partial | Migration `0516` written, awaiting owner apply; `updateCashControlSettings` + audit write pending |
| W0-5 | ⬜ Not started | Admin screen + API + nav + access contract |
| W0-6 | ⬜ Not started | i18n keys |
| W0-7 | ⬜ Not started | Service unit tests |
| W0-8 | 🟡 In progress | This update |
| W0-9 | ✅ Done | Remote MCP audit of existing permission codes |
| W0-10 | 🟡 Partial | Migration `0517` written, awaiting owner apply |
| W0-11 | ✅ Done | TS mirrors in `finance-perm.ts` / `pos-session-perm.ts` |
| W0-12 | ⬜ Not started | Needs `/update-rbac-role` skill + real role-code mapping |
| W0-13 | ⬜ Not started | `rebuild:platform-info-inventories` |
