# Order Fin Remediation Work Packages — Master Index

**Created:** 2026-07-15 · **Documentation status: UNDER_REVIEW** — these are active planning files, not frozen artifacts. · **Documentation only — no code, migrations, tests, config, or schema changes.**
**Next action:** continue the implementation sequence under the **owner continuation directive (recorded 2026-07-17 in [RESUME_CONTINUATION.md](RESUME_CONTINUATION.md))** — Seq 1–2 are implementation-complete (B01/B02/B33/B34 IMPLEMENTED, gates green; awaiting owner commit → Preview QA). **Seq 3 progress: B15 IMPLEMENTED (currency pre-Preview data checks PASS on remote); B16 Part A (expected-cash filter) IMPLEMENTED flag-gated + B16 Part B mig `0407` authored → BLOCKED-ON-APPLY. NOW: B20 → B29** (B16 Part B resumes after owner applies 0407 + Prisma regen), one scoped package per phase (owner directive 2026-07-18). **Owner queue:** apply mig 0407; then commit + Preview-deploy the Seq 3 batch. **Addendum A2** (drawer cash-sale double-count) added to the authoritative report — needs a dedicated follow-up decision/package. **All twelve decisions (D001–D012) are APPROVED (Expert)** — the final seven recorded 2026-07-18 from the owner's authoritative decision pack; no decision blockers remain. Package starts are announced against the RESUME; owner control points (migration apply, commits, Preview QA approval) bind at every package.
**Source of truth:** [Authoritative Current-State Report (2026-07-15)](../../../Audit_Reports/CleanMateX_Enterprise_Financial_Accounting_Audit_15_07_2026/CleanMateX_Order_Payment_Authoritative_Current_Implementation_Report_2026-07-15.md) — frozen; work packages must **not** redefine or silently contradict its confirmed findings (C1–C3, H1–H8, M1–M9, B1–B34 incl. Addendum A1).
**Folder rules:** [CLAUDE.md](CLAUDE.md) governs all files here — planning-only stage, no invented approvals, required Delivery-surfaces sections, safety gates for UI over unsafe backends.

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
| B3 | Stored-value funding capture | CRITICAL | BLOCKS_PRODUCTION | NOT_STARTED | D007 D008 D010 | — | B6 (GC/wallet events, impl) | 6 | [B03](B03_Stored_Value_Funding_Capture.md) | — | — | — |
| B4 | Later collection BVM parity | HIGH | BLOCKS_PRODUCTION | NOT_STARTED | D001 D007 | — | B5 B31 (hard); B6 (impl) | 4 | [B04](B04_Later_Collection_BVM_Parity.md) | — | — | — |
| B5 | Later collection idempotency | HIGH | BLOCKS_PRODUCTION | NOT_STARTED | D010 | B4 (hard) | — | 4 | [B05](B05_Later_Collection_Idempotency.md) | — | — | — |
| B6 | ERP order-to-cash event wiring | HIGH | CONTROL_GAP | NOT_STARTED | D007 D008 D012 (all APPROVED (Expert)) | B4 (impl); B3 (impl, funding events) | B24 B25 (hard) | 8 | [B06](B06_ERP_Order_To_Cash_Event_Wiring.md) | — | — | — |
| B7 | Financial outbox processor | HIGH | CONTROL_GAP | NOT_STARTED | D010 | — | B19 (hard); B30 (history only, opt) | 5 | [B07](B07_Financial_Outbox_Processor.md) | — | — | — |
| B8 | Gateway lifecycle integration | HIGH | BLOCKS_FEATURE | NOT_STARTED | D001 D009 D010 | B30 (impl, shares transitions) | — | 9 | [B08](B08_Gateway_Lifecycle_Integration.md) | — | — | — |
| B9 | Refund execution parity | HIGH | CONTROL_GAP | NOT_STARTED | D004 D007 | B1 (hard, classification); B16 (opt — drawer expected-cash coordination) | — | 7 | [B09](B09_Refund_Execution_Parity.md) | — | — | — |
| B10 | Payment reversal + void | HIGH | BLOCKS_FEATURE | NOT_STARTED | D001 D004 | — | B13 (hard) | 7 | [B10](B10_Payment_Reversal_And_Void.md) | — | — | — |
| B11 | Tax-inclusive calculation | HIGH | BLOCKS_FEATURE | NOT_STARTED | — | none (coordination: B12 item-edit overlap — B11 recommended before B12) | B12 (impl, recommended predecessor) | 10 | [B11](B11_Tax_Inclusive_Calculation.md) | — | — | — |
| B12 | Order amendment + financial delta | HIGH | BLOCKS_FEATURE / MAINTENANCE_RISK | NOT_STARTED | D011 D003 D010 | — | B14 (impl, tax-doc adjust) | 11 | [B12](B12_Order_Amendment_And_Financial_Delta.md) | — | — | — |
| B13 | Voucher reversal operational unwind | HIGH | CONTROL_GAP | NOT_STARTED | D004 D006 D007 | B10 (hard) | — | 8 | [B13](B13_Voucher_Reversal_Operational_Unwind.md) | — | — | — |
| B14 | Tax document runtime integration | HIGH | BLOCKS_FEATURE | NOT_STARTED | D007 D011 | — | B12 (partial, credit notes) | 11 | [B14](B14_Tax_Document_Runtime_Integration.md) | — | — | — |
| B15 | Currency defaults + tolerances | MEDIUM | CONTROL_GAP | IMPLEMENTED 2026-07-18 (9 OMR fallbacks → resolve-or-throw; USD default removed; 0.05/0.06 removed; two tolerance classes centralized — see B15 evidence) — awaiting owner commit → Preview QA | — | — | — | 3 | [B15](B15_Currency_Defaults_And_Tolerances.md) | pending | — | pending Preview QA |
| B16 | Drawer filtering + variance approval | MEDIUM | CONTROL_GAP | IN_PROGRESS — Part A (expected-cash filter) IMPLEMENTED 2026-07-18 flag-gated `order_fin_drawer_close_v2`, gates green; Part B (variance approval) mig 0407 authored → BLOCKED-ON-APPLY; Addendum A2 (cash-sale double-count) recorded | D001 | — | — | 3 | [B16](B16_Cash_Drawer_Filtering_And_Variance_Approval.md) | pending | — | pending Preview QA |
| B17 | Currency rounding runtime | MEDIUM | BLOCKS_FEATURE | NOT_STARTED | — | B15 (impl) | — | 10 | [B17](B17_Currency_Rounding_Runtime.md) | — | — | — |
| B18 | Order charge write path | MEDIUM | BLOCKS_FEATURE | NOT_STARTED | — | — | — | 10 | [B18](B18_Order_Charge_Write_Path.md) | — | — | — |
| B19 | Expiry + idempotency jobs | MEDIUM | CONTROL_GAP | NOT_STARTED | D008 D010 | B7 (hard) | — | 9 | [B19](B19_Expiry_And_Idempotency_Jobs.md) | — | — | — |
| B20 | Missing reconciliation checks | MEDIUM | CONTROL_GAP | NOT_STARTED | D005 | B2 (hard) | — | 3 | [B20](B20_Missing_Reconciliation_Checks.md) | — | — | — |
| B21 | Loyalty conversion rate | MEDIUM | MAINTENANCE_RISK | NOT_STARTED | — | — | — | 9 | [B21](B21_Loyalty_Conversion_Rate.md) | — | — | — |
| B22 | Financial registry consolidation | MEDIUM | MAINTENANCE_RISK | NOT_STARTED | D001 | — | — | 9 | [B22](B22_Financial_Registry_Consolidation.md) | — | — | — |
| B23 | Legacy financial path retirement | MEDIUM | MAINTENANCE_RISK | NOT_STARTED | — | B12 (impl, item-edit path) | — | 12 | [B23](B23_Legacy_Financial_Path_Retirement.md) | — | — | — |
| B24 | AR allocation, write-off, period controls | MEDIUM | BLOCKS_FEATURE | NOT_STARTED | D007 | B6 (hard, GL) | — | 12 | [B24](B24_AR_Allocation_Writeoff_And_Period_Controls.md) | — | — | — |
| B25 | Revenue recognition + contract liability | LOW→HIGH at GA | FUTURE_ENTERPRISE | NOT_STARTED | D012 D008 | B6 (hard) | — | 13 | [B25](B25_Revenue_Recognition_And_Contract_Liability.md) | — | — | — |
| B26 | Enterprise FX, bank, gateway, ECL | LOW | FUTURE_ENTERPRISE | NOT_STARTED | D001 D012 | B8 (impl) | — | 13 | [B26](B26_Enterprise_FX_Bank_Gateway_And_ECL.md) | — | — | — |
| B27 | Financial permissions + approvals | MEDIUM | CONTROL_GAP | NOT_STARTED | — | — | B30 (impl, action perms) | 5 | [B27](B27_Financial_Permissions_And_Approvals.md) | — | — | — |
| B28 | Financial regression test coverage | HIGH | CONTROL_GAP | NOT_STARTED | — | B1–B5 (test, grows per wave) | — | continuous | [B28](B28_Financial_Regression_Test_Coverage.md) | — | — | — |
| B29 | Stale documentation correction | LOW | MAINTENANCE_RISK | NOT_STARTED | — | — | — | 3 | [B29](B29_Stale_Documentation_Correction.md) | — | — | — |
| B30 | Pending-payment back-office lifecycle | HIGH | BLOCKS_FEATURE / CONTROL_GAP | NOT_STARTED | D001 D009 D010 | B7 (opt — outbox-based durable history only; worklist and transitions independent); B27 (impl, permissions) | B8 (impl) | 6 | [B30](B30_Pending_Payment_Backoffice_Lifecycle.md) | — | — | — |
| B31 | Later collection default status | MEDIUM | CONTROL_GAP | NOT_STARTED | D001 | B4 (hard) | — | 4 | [B31](B31_Later_Collection_Default_Status.md) | — | — | — |
| B32 | Drawer status gating + status override | LOW | CONTROL_GAP | NOT_STARTED | D001 | B30 (impl — verify hook only; canHandle gate independent) | — | 6 | [B32](B32_Drawer_Status_Gating_And_Status_Override.md) | — | — | — |
| B33 | Pending-payment warning semantics | MEDIUM | CONTROL_GAP | IMPLEMENTED 2026-07-17 (warning cross-check via B02 module; healthy pending orders stay CURRENT — see B33 Completion evidence) — awaiting owner commit → Preview QA | D001 D005 (policy) | B2 (impl, formula alignment); independent of B30 worklist | — | 2 | [B33](B33_Pending_Payment_Warning_Semantics.md) | — | — | — |
| B34 | Refund back-office UI (Addendum A1) | HIGH | BLOCKS_FEATURE / CONTROL_GAP | IMPLEMENTED 2026-07-18 (flagged build complete — initiate dialog + actionable hub, flag `order_fin_refund_ui` default OFF; all gates + contract checks green, see B34 evidence) — awaiting owner commit → Preview QA (flag-on) | D002 D003 (APPROVED (Expert) 2026-07-16, v2) | B01+B02 (hard — production-activation gate for any refund workflow); B09 (hard — cash/original-method activation); B27 (permission-sensitive actions); design + flagged implementation may proceed against the B1 contract (flag disabled by default) | — | 2–3 | [B34](B34_Refund_Backoffice_UI.md) | — | — | — |

## Recommended master implementation sequence

Backlog numeric order is **not** implementation order.

```text
Seq 1  ✅ DONE 2026-07-17 — B1 IMPLEMENTED (D002 D003 D004 D005 D010 APPROVED (Expert))
Seq 2  ✅ DONE 2026-07-17/18 — B2 → B33 IMPLEMENTED; B34 IMPLEMENTED behind DISABLED flag
       (PRODUCTION ACTIVATION still GATED ON B01+B02 VERIFIED; cash/original-method on
       B09 VERIFIED; permission-sensitive actions on B27)
Seq 3  ← IN PROGRESS · Low-risk parallel wave: B15 ✅ IMPLEMENTED · B16 Part A ✅ IMPLEMENTED
       (filter, flag-gated) + Part B mig 0407 BLOCKED-ON-APPLY · B20 ← NOW · B29 next
       (recalculated 2026-07-18: all unblocked — no open decisions; B20's hard dep B2 is
       IMPLEMENTED, its VERIFIED gate binds production promotion, not implementation order)
Seq 4  B4 → B5, B31
Seq 5  B7, B27
Seq 6  B3, B30, B32
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
| Refund Lifecycle | D002 D003 D004 D005 D010 — all APPROVED (Expert) 2026-07-16, v2 semantics | B1 → B2 → B9 | B34 (activation: B01+B02 VERIFIED; cash/original-method: B09; rebill/manual-exception actions: B27) | existing refund pair + B27 order-reopen/rebill + manual-exception codes | B28 refund slice (B1 §14 v2) | NOT_READY | B1 not implemented (next up, per 2026-07-17 continuation directive); B2, B9, B27 pending |
| Later Collection | D001 D007 D010 | B4 → B5, B31 | collect modal touches (B5/B31) | orders:collect_payment | B28 collection slice | NOT_READY | B4 not implemented |
| Pending-Payment Lifecycle | D001 D009 D010 — all APPROVED (Expert) | B30 (service), B8, B32, B33 | B30 worklist | verify (exists) + B27 cancel/fail codes | B28 pending slice | NOT_READY | B30 transition service not implemented |
| Stored-Value Funding & Jobs | D008 D010 — all APPROVED (Expert) | B3, B19 | B3 tender steps, B21 settings, B19/B7 ops screen | B27 funding/ops codes | B28 funding slice | NOT_READY | B3 not implemented; B7 for jobs |
| Tax-Inclusive & Rounding | — (technical) | B11, B17, B18 | display labels/rounding line/charge editor | B27 manual-charge code | B28 tax/rounding slice | NOT_READY | none blocking start |
| Accounting & Revenue Recognition | D007 D012 — all APPROVED (Expert) | B6 → B24, B25, B13 journals | ERP exception/report screens (existing) | ERP finance perms | B28 accounting slice + trial-balance tie-out | NOT_READY | B6 not implemented |
| Gateway & Bank Operations | D001 D009 D010 | B8 (+B26 sub-packages) | B30 status display; B26 screens per sub-package | B27 codes | B28 gateway slice | NOT_READY | B30 transition service; B26 not carved out |

No bundle may be marked production-ready until every mandatory component above is VERIFIED.

## Phase 0 decisions

Policy decisions live in [00_Phase_0_Financial_Semantics/](00_Phase_0_Financial_Semantics/README.md) (D001–D012). **All twelve are APPROVED (Expert)**: D002/D003/D004/D005/D010 on 2026-07-16 (D002 Option A v2 five-facet vocabulary; D003 Expert model v2; D004 Option B; D005 Option A; D010 Option A) and D001/D006/D007/D008/D009/D011/D012 on 2026-07-18 (owner's authoritative decision pack — D001 canonical transition graph; D006 reusable credit reversal; D007 five-layer boundary matrix; D008 five-artifact funding capture; D009 governed failure fallback; D011 governed amendment/delta; D012 IFRS 15 validated-completion recognition with the accounting-owner sign-off retained only as an implementation control). Selected option, rationale summary, implementation consequences, and affected packages are recorded in each decision file. **Session continuation:** [RESUME_CONTINUATION.md](RESUME_CONTINUATION.md).
