# Order Fin Remediation Work Packages — Master Index

**Created:** 2026-07-15 · **Documentation status: UNDER_REVIEW** — these are active planning files, not frozen artifacts. · **Documentation only — no code, migrations, tests, config, or schema changes.**
**Next action:** continue the implementation sequence under the **owner continuation directive (recorded 2026-07-17 in [RESUME_CONTINUATION.md](RESUME_CONTINUATION.md))** — Seq 1–2 are implementation-complete (B01/B02/B33/B34 IMPLEMENTED, gates green; awaiting owner commit → Preview QA). **Seq 3 CLOSED 2026-07-19: B15/B16/B20/B29 IMPLEMENTED.** **Seq 4 CLOSED 2026-07-20: B4/B5/B31 IMPLEMENTED** (later-collection BVM voucher parity + top-level idempotency guard + D9-aware default-status resolution, all in one `collectPaymentTx` rewrite; ships **unconditionally, no feature flag** — owner decision 2026-07-20, following the B35 precedent for a parity-tested correctness fix; gates green incl. build ✓). **Seq 5 CLOSED 2026-07-20: B7 + B27 IMPLEMENTED.** B7 — handler registry + processor route/cron + loyalty-earn/order-history consumers finally wired, DEAD_LETTERED status, ops-visibility screen; **migration 0410 APPLIED (owner, 2026-07-20), verified via remote DB** — `sys_fin_runtime_cf` populated, `fin-outbox-processor` cron active on `* * * * *`, dead `outbox-worker` cron gone. ⚠️ `FINANCE_OUTBOX_SECRET` is STILL the empty placeholder in `.env.local`/`.env.dbcloudjh` — the route 401s until the owner runs `SELECT value FROM sys_fin_runtime_cf WHERE key='outbox_secret_key';` and pastes it into both files + the deploy environment. B27 — re-verified the §43 audit against the live remote DB (5 of 12 rows already covered), seeded the 7 genuinely-missing codes, fixed the `pricing:override` fail-open bug in `addOrderItems`, gated 3 previously-ungated stored-value server actions, and wired `REFUND_AND_REBILL` to a real `orders:rebill_authorize` check (was hardcoded-rejected since B01 shipped); **migration 0411 APPLIED (owner, 2026-07-20)**. Also fixed an incidental pre-existing, unrelated jest mock gap in `order-calculation.service.test.ts` (missing `evaluateBestAutoApplyPromo` mock) discovered while gating B27 — full jest is now 2084/2084 green with no known failures. NOW: **Seq 6 — B3 architecture LOCKED 2026-07-20** (two new tables + shared funding service + 2 wiring handlers, no new permission codes — see B03 Completion evidence; **implementation not yet started**), then B30, B32, one scoped package per phase (owner directive 2026-07-18). **Owner queue:** commit + Preview-deploy the Seq 3+4+5 batch (migrations 0410+0411 already applied and verified 2026-07-20); copy the generated `FINANCE_OUTBOX_SECRET` from `sys_fin_runtime_cf` into `.env.local`/`.env.dbcloudjh`/deploy env (still the empty placeholder). **Addendum A2** (drawer cash-sale double-count) — **RESOLVED by B35**, addendum carries its own resolution note in the frozen report. **All twelve decisions (D001–D012) are APPROVED (Expert)** — the final seven recorded 2026-07-18 from the owner's authoritative decision pack; no decision blockers remain. Package starts are announced against the RESUME; owner control points (migration apply, commits, Preview QA approval) bind at every package.
**Source of truth:** [Authoritative Current-State Report (2026-07-15)](../../../Audit_Reports/CleanMateX_Enterprise_Financial_Accounting_Audit_15_07_2026/CleanMateX_Order_Payment_Authoritative_Current_Implementation_Report_2026-07-15.md) — frozen; work packages must **not** redefine or silently contradict its confirmed findings (C1–C3, H1–H8, M1–M9, B1–B34 incl. Addendum A1).
**Folder rules:** [CLAUDE.md](CLAUDE.md) governs all files here — planning-only stage, no invented approvals, required Delivery-surfaces sections, safety gates for UI over unsafe backends.
**Manual QA:** [QA_TEST_GUIDE.md](QA_TEST_GUIDE.md) — living manual-test guide covering every implemented package (B01/B02/B33/B34/B15/B16/B35 …); **keep it updated with new scenarios after each implemented package** (owner directive 2026-07-18).

## Governance rules

1. The authoritative report is the sole source of truth for **current-state** findings. Packages link to its sections; they do not restate or reinterpret them.
2. A newly discovered issue requires code verification and an **explicit addendum** to the report before any package may rely on it.
3. Only **one implementation package** should normally be active (IN_PROGRESS) at a time.
4. **Decision files (D001–D012)** contain policy and invariants only. **Backlog files (B01–B34)** contain implementation and verification work. Never merge the two.
5. An item cannot be marked `VERIFIED` until its required **financial, reconciliation, idempotency, and regression tests pass** and the completion evidence block in its file is filled.
6. Approved decisions are immutable: material policy changes require a new version or an explicit superseding decision (see [Phase 0 index](00_Phase_0_Financial_Semantics/README.md)).
7. **Working discipline (owner directives, 2026-07-16):** (a) after each task, update plan progress + statuses (Bxx file, this index, RESUME); (b) after a package finishes implementation + Preview QA, update/create/refresh all related documentation (`/documentation` skill) before VERIFIED; (c) load the related skills properly before writing in each domain; (d) the project CLAUDE.md (`F:\jhapp\cleanmatex\CLAUDE.md`) always binds — required skills, agents, rule docs, and Cmx reusables first (create a reusable component for any element used in 2+ places); (e) best practices only — no gaps, no bugs, UI/UX best practices, production-ready.
8. **Release promotion rule (owner directive, 2026-07-16):** every commit goes **commit → Preview deployment → QA executes the package checklist on Preview → QA finished + owner approval recorded → production**. No direct-to-production; `VERIFIED` and production feature-flag activation both require the recorded Preview QA approval; rollback proven on Preview first (details in [CLAUDE.md](CLAUDE.md) § Release and promotion).
9. **Full-cycle completeness rule (owner directive, 2026-07-16 — applies to ALL features and ALL packages, not only refunds):** every capability ships with a clear backend AND frontend — services, APIs/endpoints, helpers, screens/pages, permissions, i18n — usable end-to-end. Backend-without-UI (or UI-without-backend) is PARTIAL, never complete. Every package's **Scope must name its frontend surface** (screen, dialog, action, or ops-visibility view) or explicitly justify `NOT_APPLICABLE`; acceptance criteria must include a screen-driven end-to-end path wherever a user action exists. Origin: Addendum A1 (refund workflow was API-complete but UI-absent) → B34.

## Work-package status vocabulary

```text
NOT_STARTED · DECISION_REQUIRED · READY_FOR_DESIGN · READY_FOR_IMPLEMENTATION
IN_PROGRESS · IMPLEMENTED · VERIFIED · BLOCKED · DEFERRED
```

`IMPLEMENTED` and `VERIFIED` are post-implementation statuses — forbidden during the planning stage (CLAUDE.md). `READY_FOR_IMPLEMENTATION` additionally requires explicit user authorization of that package. **Standard Cmx UI state contract** (referenced by packages): every screen/action covers loading, empty, validation errors, permission-denied (disabled with reason), duplicate-click protection, processing, success, retry/failure, and audit/history visibility.

## Dependency types used in this index

`hard` = cannot start before predecessor is VERIFIED · `policy` = requires APPROVED decision(s) · `impl` = shares code surface, sequence to avoid conflict · `test` = verification needs predecessor's facts · `opt` = optional enhancement.

## Master index (B1–B34)

Severity/classification/evidence per report §50. Status is documentation-state only — no implementation status is claimed.

| ID | Title | Sev | Class | Status | Required decisions | Dependencies | Blocks | Seq | Work package | Commit | Reviewer | Verification |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| B1 | Refund lineage + reopen-due | CRITICAL | BLOCKS_PRODUCTION | IMPLEMENTED 2026-07-17 (mig 0404 applied; service+API+UI+i18n+§14 tests done, refund gates green — see B01 Completion evidence) — **awaiting owner commit → Preview QA → approval before VERIFIED** | D002 D003 D004 D005 D010 (APPROVED (Expert) 2026-07-16, v2) | — | B2 B9 B28 (test) | 1 | [B01](B01_Refund_Lineage_And_Reopen_Due.md) | pending | — | pending Preview QA |
| B2 | Shared financial aggregation | CRITICAL | BLOCKS_PRODUCTION | IMPLEMENTED 2026-07-17 (D005 module + writer/recon/reader repointing, equality suite green — see B02 Completion evidence) — **awaiting owner commit → Preview QA (batched with B1)** | D005 | B1 (hard) | B20 B33 (impl) | 2 | [B02](B02_Shared_Financial_Aggregation.md) | pending | — | pending Preview QA |
| B3 | Stored-value funding capture | CRITICAL | BLOCKS_PRODUCTION | READY_FOR_IMPLEMENTATION (architecture locked+revised v2/v3 2026-07-20; migration `0412` APPLIED; full backend+frontend IMPLEMENTED this session behind flag `order_fin_sv_funding_capture` [default OFF] — service, 2 wiring handlers, 2 new reconciliation checks, 3 governed server actions, reusable tender UI, 3 screen retrofits, manual-voucher-entry bypass closed; gates ALL GREEN (tsc/eslint/jest 220-220/i18n/build); awaiting Preview QA + commit, see B03 evidence) | D007 D008 D010 | — | B6 (GC/wallet events, impl) | 6 | [B03](B03_Stored_Value_Funding_Capture.md) | — | — | — |
| B4 | Later collection BVM parity | HIGH | BLOCKS_PRODUCTION | IMPLEMENTED 2026-07-20 (collectPaymentTx wired through createBizVoucher/addVoucherLine/postAndWireBizVoucher; ships unconditionally, no flag — owner decision; gates green) — awaiting owner commit → Preview QA | D001 D007 | — | B5 B31 (hard); B6 (impl) | 4 | [B04](B04_Later_Collection_BVM_Parity.md) | pending | — | pending Preview QA |
| B5 | Later collection idempotency | HIGH | BLOCKS_PRODUCTION | IMPLEMENTED 2026-07-20 (top-level org_idempotency_keys replay/conflict guard + required idempotencyKey on both routes + 409 mapping; ships in the B4 wave) — awaiting owner commit → Preview QA | D010 | B4 (hard) | — | 4 | [B05](B05_Later_Collection_Idempotency.md) | pending | — | pending Preview QA |
| B6 | ERP order-to-cash event wiring | HIGH | CONTROL_GAP | NOT_STARTED | D007 D008 D012 (all APPROVED (Expert)) | B4 (impl); B3 (impl, funding events) | B24 B25 (hard) | 8 | [B06](B06_ERP_Order_To_Cash_Event_Wiring.md) | — | — | — |
| B7 | Financial outbox processor | HIGH | CONTROL_GAP | IMPLEMENTED 2026-07-20 (registry + processor + loyalty-earn/order-history handlers wired, dead-letter status, ops screen; mig 0410 APPLIED (owner, 2026-07-20)) — awaiting owner apply → commit → Preview QA | D010 | — | B19 (hard); B30 (history only, opt) | 5 | [B07](B07_Financial_Outbox_Processor.md) | pending | — | pending migration apply + Preview QA |
| B8 | Gateway lifecycle integration | HIGH | BLOCKS_FEATURE | NOT_STARTED | D001 D009 D010 | B30 (impl, shares transitions) | — | 9 | [B08](B08_Gateway_Lifecycle_Integration.md) | — | — | — |
| B9 | Refund execution parity | HIGH | CONTROL_GAP | NOT_STARTED | D004 D007 | B1 (hard, classification); B16 (opt — drawer expected-cash coordination) | — | 7 | [B09](B09_Refund_Execution_Parity.md) | — | — | — |
| B10 | Payment reversal + void | HIGH | BLOCKS_FEATURE | NOT_STARTED | D001 D004 | — | B13 (hard) | 7 | [B10](B10_Payment_Reversal_And_Void.md) | — | — | — |
| B11 | Tax-inclusive calculation | HIGH | BLOCKS_FEATURE | NOT_STARTED | — | none (coordination: B12 item-edit overlap — B11 recommended before B12) | B12 (impl, recommended predecessor) | 10 | [B11](B11_Tax_Inclusive_Calculation.md) | — | — | — |
| B12 | Order amendment + financial delta | HIGH | BLOCKS_FEATURE / MAINTENANCE_RISK | NOT_STARTED | D011 D003 D010 | — | B14 (impl, tax-doc adjust) | 11 | [B12](B12_Order_Amendment_And_Financial_Delta.md) | — | — | — |
| B13 | Voucher reversal operational unwind | HIGH | CONTROL_GAP | NOT_STARTED | D004 D006 D007 | B10 (hard) | — | 8 | [B13](B13_Voucher_Reversal_Operational_Unwind.md) | — | — | — |
| B14 | Tax document runtime integration | HIGH | BLOCKS_FEATURE | NOT_STARTED | D007 D011 | — | B12 (partial, credit notes) | 11 | [B14](B14_Tax_Document_Runtime_Integration.md) | — | — | — |
| B15 | Currency defaults + tolerances | MEDIUM | CONTROL_GAP | IMPLEMENTED 2026-07-18 (9 OMR fallbacks → resolve-or-throw; USD default removed; 0.05/0.06 removed; two tolerance classes centralized — see B15 evidence) — awaiting owner commit → Preview QA | — | — | — | 3 | [B15](B15_Currency_Defaults_And_Tolerances.md) | pending | — | pending Preview QA |
| B16 | Drawer filtering + variance approval | MEDIUM | CONTROL_GAP | IMPLEMENTED 2026-07-18 — Part A (expected-cash filter) + Part B (deferred variance approval — **optional, non-blocking, opt-in per drawer / off by default** per owner directive; mig 0407 applied by owner) both done, gates green (tsc/eslint/i18n/jest 39-39/build ✓). **`order_fin_drawer_close_v2` flag REMOVED by B35 (owner directive) — filter now unconditional; variance approval gated only by per-drawer threshold.** Addendum A2 (cash-sale double-count) **RESOLVED by B35** — awaiting owner commit → Preview QA | D001 | — | — | 3 | [B16](B16_Cash_Drawer_Filtering_And_Variance_Approval.md) | pending | — | pending Preview QA |
| B17 | Currency rounding runtime | MEDIUM | BLOCKS_FEATURE | NOT_STARTED | — | B15 (impl) | — | 10 | [B17](B17_Currency_Rounding_Runtime.md) | — | — | — |
| B18 | Order charge write path | MEDIUM | BLOCKS_FEATURE | NOT_STARTED | — | — | — | 10 | [B18](B18_Order_Charge_Write_Path.md) | — | — | — |
| B19 | Expiry + idempotency jobs | MEDIUM | CONTROL_GAP | NOT_STARTED | D008 D010 | B7 (hard) | — | 9 | [B19](B19_Expiry_And_Idempotency_Jobs.md) | — | — | — |
| B20 | Missing reconciliation checks | MEDIUM | CONTROL_GAP | IMPLEMENTED 2026-07-18 (TAX_CALCULATION + DISCOUNT_VALIDATION wired, new REFUND_REOPEN_CONSISTENCY check + constant added; total_checked 35→38; gates green incl. jest 64/64) — awaiting owner commit → Preview QA | D005 | B2 (hard) | — | 3 | [B20](B20_Missing_Reconciliation_Checks.md) | pending | — | pending Preview QA |
| B21 | Loyalty conversion rate | MEDIUM | MAINTENANCE_RISK | NOT_STARTED | — | — | — | 9 | [B21](B21_Loyalty_Conversion_Rate.md) | — | — | — |
| B22 | Financial registry consolidation | MEDIUM | MAINTENANCE_RISK | NOT_STARTED | D001 | — | — | 9 | [B22](B22_Financial_Registry_Consolidation.md) | — | — | — |
| B23 | Legacy financial path retirement | MEDIUM | MAINTENANCE_RISK | NOT_STARTED | — | B12 (impl, item-edit path) | — | 12 | [B23](B23_Legacy_Financial_Path_Retirement.md) | — | — | — |
| B24 | AR allocation, write-off, period controls | MEDIUM | BLOCKS_FEATURE | NOT_STARTED | D007 | B6 (hard, GL) | — | 12 | [B24](B24_AR_Allocation_Writeoff_And_Period_Controls.md) | — | — | — |
| B25 | Revenue recognition + contract liability | LOW→HIGH at GA | FUTURE_ENTERPRISE | NOT_STARTED | D012 D008 | B6 (hard) | — | 13 | [B25](B25_Revenue_Recognition_And_Contract_Liability.md) | — | — | — |
| B26 | Enterprise FX, bank, gateway, ECL | LOW | FUTURE_ENTERPRISE | NOT_STARTED | D001 D012 | B8 (impl) | — | 13 | [B26](B26_Enterprise_FX_Bank_Gateway_And_ECL.md) | — | — | — |
| B27 | Financial permissions + approvals | MEDIUM | CONTROL_GAP | IMPLEMENTED 2026-07-20 (7 new codes seeded incl. `orders:rebill_authorize`/`cash_drawer:approve_variance`/`stored_value:issue_wallet_credit`; price-override fail-open bug fixed; 3 ungated stored-value actions gated; REFUND_AND_REBILL wired to real permission; mig 0411 APPLIED (owner, 2026-07-20)) — awaiting owner apply → commit → Preview QA | — | — | B30 (impl, action perms) | 5 | [B27](B27_Financial_Permissions_And_Approvals.md) | pending | — | pending migration apply + Preview QA |
| B28 | Financial regression test coverage | HIGH | CONTROL_GAP | NOT_STARTED | — | B1–B5 (test, grows per wave) | — | continuous | [B28](B28_Financial_Regression_Test_Coverage.md) | — | — | — |
| B29 | Stale documentation correction | LOW | MAINTENANCE_RISK | IMPLEMENTED 2026-07-19 (7 stale claims across ADR/Fix_29_05_2026/Opus_Validation_Report/Order_Fin_Docs annotated with correction banners + report links; index in B29 evidence; migration 0340 itself re-verified NOT stale) — awaiting owner commit (docs-only, no Preview QA) | — | — | — | 3 | [B29](B29_Stale_Documentation_Correction.md) | pending | — | n/a (docs-only) |
| B30 | Pending-payment back-office lifecycle | HIGH | BLOCKS_FEATURE / CONTROL_GAP | NOT_STARTED | D001 D009 D010 | B7 (opt — outbox-based durable history only; worklist and transitions independent); B27 (impl, permissions) | B8 (impl) | 6 | [B30](B30_Pending_Payment_Backoffice_Lifecycle.md) | — | — | — |
| B31 | Later collection default status | MEDIUM | CONTROL_GAP | IMPLEMENTED 2026-07-20 (D9-aware status resolution shared with submit via `resolveDefaultStatus`; pre-submit pending notice; ships in the B4 wave) — awaiting owner commit → Preview QA | D001 | B4 (hard) | — | 4 | [B31](B31_Later_Collection_Default_Status.md) | pending | — | pending Preview QA |
| B32 | Drawer status gating + status override | LOW | CONTROL_GAP | NOT_STARTED | D001 | B30 (impl — verify hook only; canHandle gate independent) | — | 6 | [B32](B32_Drawer_Status_Gating_And_Status_Override.md) | — | — | — |
| B33 | Pending-payment warning semantics | MEDIUM | CONTROL_GAP | IMPLEMENTED 2026-07-17 (warning cross-check via B02 module; healthy pending orders stay CURRENT — see B33 Completion evidence) — awaiting owner commit → Preview QA | D001 D005 (policy) | B2 (impl, formula alignment); independent of B30 worklist | — | 2 | [B33](B33_Pending_Payment_Warning_Semantics.md) | — | — | — |
| B34 | Refund back-office UI (Addendum A1) | HIGH | BLOCKS_FEATURE / CONTROL_GAP | IMPLEMENTED 2026-07-18 (flagged build complete — initiate dialog + actionable hub, flag `order_fin_refund_ui` default OFF; all gates + contract checks green, see B34 evidence) — awaiting owner commit → Preview QA (flag-on) | D002 D003 (APPROVED (Expert) 2026-07-16, v2) | B01+B02 (hard — production-activation gate for any refund workflow); B09 (hard — cash/original-method activation); B27 (permission-sensitive actions); design + flagged implementation may proceed against the B1 contract (flag disabled by default) | — | 2–3 | [B34](B34_Refund_Backoffice_UI.md) | — | — | — |
| B35 | Unified drawer expected-cash (Addendum A2 fix) | MEDIUM | BLOCKS_FEATURE / CONTROL_GAP | IMPLEMENTED 2026-07-18 (owner directive) — one expected-cash formula (payment ledger owns sale cash; manual movements only, sale-mirror `CASH_SALE`/change excluded via `order_payment_id`); **`order_fin_drawer_close_v2` flag REMOVED** — fix applies unconditionally; jest 39/39 + preview 3/3 (2 owner-failing tests now green); resolves Addendum A2 | — (owner directive) | B16 (shares code surface); B9 (coord — cash-refund OUT movements) | — | 3 | [B35](B35_Unified_Drawer_Expected_Cash.md) | pending | — | pending Preview QA |

## Recommended master implementation sequence

Backlog numeric order is **not** implementation order.

```text
Seq 1  ✅ DONE 2026-07-17 — B1 IMPLEMENTED (D002 D003 D004 D005 D010 APPROVED (Expert))
Seq 2  ✅ DONE 2026-07-17/18 — B2 → B33 IMPLEMENTED; B34 IMPLEMENTED behind DISABLED flag
       (PRODUCTION ACTIVATION still GATED ON B01+B02 VERIFIED; cash/original-method on
       B09 VERIFIED; permission-sensitive actions on B27)
Seq 3  ✅ CLOSED 2026-07-19 — Low-risk parallel wave: B15 ✅ IMPLEMENTED · B16 ✅
       IMPLEMENTED (Part A filter + Part B deferred variance approval, mig 0407 applied)
       · B20 ✅ IMPLEMENTED (total_checked 35→38) · B29 ✅ IMPLEMENTED (stale-doc sweep,
       docs-only, 7 claims corrected)
Seq 4  ✅ CLOSED 2026-07-20 — B4 ✅ IMPLEMENTED · B5 ✅ IMPLEMENTED · B31 ✅
       IMPLEMENTED (one collectPaymentTx rewrite, unconditional/no flag — owner
       decision, B35 precedent)
Seq 5  ✅ CLOSED 2026-07-20 — B7 ✅ IMPLEMENTED (mig 0410 APPLIED (owner, 2026-07-20)) · B27 ✅
       IMPLEMENTED (7 codes seeded, mig 0411 APPLIED (owner, 2026-07-20); fail-open bug fixed;
       REFUND_AND_REBILL wired)
Seq 6  ← NOW · B3, B30, B32
Seq 7  B9, B10
Seq 8  B6 → B13
Seq 9  B8, B19, B21, B22
Seq 10 B11, B17, B18
Seq 11 B12, B14
Seq 12 B23, B24
Seq 13 B25, B26
Cont.  B28 grows with every wave; a wave is not VERIFIED until its B28 slice passes
```

## Capability bundles

Related packages grouped for review and sequencing (a bundle is a lens, not a merge — each package keeps its own scope and status; no single package makes a bundle production-ready):

| Bundle | Decisions (mandatory) | Backend/API packages | Frontend packages | Permissions | Tests | Readiness | Remaining blockers |
|---|---|---|---|---|---|---|---|
| Refund Lifecycle | D002 D003 D004 D005 D010 — all APPROVED (Expert) 2026-07-16, v2 semantics | B1 → B2 → B9 | B34 (activation: B01+B02 VERIFIED; cash/original-method: B09; rebill/manual-exception actions: B27 IMPLEMENTED) | existing refund pair + B27 order-reopen/rebill + manual-exception codes (B27 IMPLEMENTED, mig 0411 pending apply) | B28 refund slice (B1 §14 v2) | NOT_READY | B1/B2 IMPLEMENTED, awaiting owner commit → Preview QA → VERIFIED; B9 pending |
| Later Collection | D001 D007 D010 | B4 → B5, B31 | collect modal touches (B5/B31) | orders:collect_payment | B28 collection slice | NOT_READY | B4 not implemented |
| Pending-Payment Lifecycle | D001 D009 D010 — all APPROVED (Expert) | B30 (service), B8, B32, B33 | B30 worklist | verify (exists) + B27 cancel/fail codes (B27 re-verified: `payments:cancel` already seeded/granted pre-B27, no gap) | B28 pending slice | NOT_READY | B30 transition service not implemented |
| Stored-Value Funding & Jobs | D008 D010 — all APPROVED (Expert) | B3, B19 | B3 tender steps IMPLEMENTED (behind flag, awaiting Preview QA); B21 settings, B19/B7 ops screen | B27 funding/ops codes (IMPLEMENTED — `stored_value:issue_wallet_credit` seeded+wired) | B28 funding slice | NOT_READY | B3 implemented, not yet Preview-QA'd/VERIFIED; B7 for jobs |
| Tax-Inclusive & Rounding | — (technical) | B11, B17, B18 | display labels/rounding line/charge editor | B27 manual-charge code (`orders:manual_charge` seeded as inert placeholder — not yet wired, no consumer until B18) | B28 tax/rounding slice | NOT_READY | none blocking start |
| Accounting & Revenue Recognition | D007 D012 — all APPROVED (Expert) | B6 → B24, B25, B13 journals | ERP exception/report screens (existing) | ERP finance perms | B28 accounting slice + trial-balance tie-out | NOT_READY | B6 not implemented |
| Gateway & Bank Operations | D001 D009 D010 | B8 (+B26 sub-packages) | B30 status display; B26 screens per sub-package | B27 codes (`orders:rate_override` seeded as inert placeholder for B26) | B28 gateway slice | NOT_READY | B30 transition service; B26 not carved out |

No bundle may be marked production-ready until every mandatory component above is VERIFIED.

## Phase 0 decisions

Policy decisions live in [00_Phase_0_Financial_Semantics/](00_Phase_0_Financial_Semantics/README.md) (D001–D012). **All twelve are APPROVED (Expert)**: D002/D003/D004/D005/D010 on 2026-07-16 (D002 Option A v2 five-facet vocabulary; D003 Expert model v2; D004 Option B; D005 Option A; D010 Option A) and D001/D006/D007/D008/D009/D011/D012 on 2026-07-18 (owner's authoritative decision pack — D001 canonical transition graph; D006 reusable credit reversal; D007 five-layer boundary matrix; D008 five-artifact funding capture; D009 governed failure fallback; D011 governed amendment/delta; D012 IFRS 15 validated-completion recognition with the accounting-owner sign-off retained only as an implementation control). Selected option, rationale summary, implementation consequences, and affected packages are recorded in each decision file. **Session continuation:** [RESUME_CONTINUATION.md](RESUME_CONTINUATION.md).
