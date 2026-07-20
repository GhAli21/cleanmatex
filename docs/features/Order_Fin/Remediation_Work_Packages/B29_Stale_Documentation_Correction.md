# B29 — Stale Documentation Correction

## Metadata
Backlog ID: B29 · Severity: LOW · Classification: MAINTENANCE_RISK · Status: **IMPLEMENTED 2026-07-19** (see Completion evidence) — awaiting owner commit (docs-only, no Preview QA required)
Authoritative report sections: §50-B29
Required decisions: none
Dependencies: none · Blocks: — · Recommended phase: Seq 3

## Confirmed problem
Docs claim behaviors runtime contradicts — flagship example: migration 0340 commentary implies refund lineage "backfilled/used" while the runtime never writes `refund_source_type`/`reopens_due_amount`; feature docs under docs/features/Order_Fin describe refund/reconciliation semantics that §13/§21 disprove.

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| supabase/migrations/0340 comments vs order-refund.service.ts | column docs vs no writer | stale claim (C1 context) |
| docs/features/Order_Fin/* status docs | pre-audit statements | contradict frozen report |

## Required outcome
Sweep Order_Fin docs: statements contradicting the authoritative report annotated with a correction banner + report-section link (no history falsification — annotate, don't rewrite shipped migration files: CRITICAL RULE 2 keeps migrations untouched; corrections live in docs).

## Scope
Docs sweep + correction annotations + index of corrected claims.

## Out of scope
The authoritative report itself (frozen); code comments (touched only within owning packages).

## Financial effects
| Area | Impact |
|---|---|
| All areas | NO (documentation-only) |

## Acceptance criteria
No Order_Fin doc asserts refund lineage, recon reliability, later-collection parity, or GL coverage beyond report verdicts; corrections list reviewed.

## Required tests
none (doc review checklist).

## Dependencies and sequencing
Independent; early to stop propagation of stale claims.

## Delivery surfaces

Backend services: NOT_APPLICABLE (documentation-only)
Database/schema: NOT_APPLICABLE (migration files themselves untouched — corrections live in docs)
API/endpoints: NOT_APPLICABLE
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason: documentation sweep — no runtime surface of any kind
Existing consumer: developers/reviewers reading docs/features/Order_Fin
Operational visibility: corrected-claims index reviewed in PR
Failure detection: doc-review checklist; future audits cross-check against the authoritative report
Recovery method: git revert of doc commits
Reusable components/helpers: correction-banner text pattern
Permissions: NOT_APPLICABLE
Validation: every banner links the report section that supersedes the claim
i18n/RTL: NOT_APPLICABLE (internal docs are EN)
Accessibility: NOT_APPLICABLE
Audit trail: git history
Observability: NOT_APPLICABLE
Jobs/workers: NOT_APPLICABLE
Feature flag: NOT_APPLICABLE
Rollout: single docs PR
Rollback: git revert

## Completion evidence

**Migration:** n/a (documentation-only).

**Investigation (2026-07-19):** the "flagship example" in this package's Confirmed problem (migration 0340 commentary vs the runtime) was re-verified and found **not actually stale** — 0340's header only claims the SQL backfill mirrors the existing `classifyRefunds()` heuristic and that the migration is additive-safe; it never claims the write service was updated going forward. That is accurate. The real stale claims live in the surrounding status/ADR/validation docs that asserted the *write-side* wiring was "Done"/"Implemented"/"✅ sound" back in 2026-06-05/2026-06-18 — before [B01](B01_Refund_Lineage_And_Reopen_Due.md) actually shipped it on 2026-07-18. A dedicated research pass (Explore agent) swept all 12 non-`Remediation_Work_Packages` folders under `docs/features/Order_Fin/` for this pattern plus later-collection-BVM-parity and reconciliation-check-count claims.

**Index of corrected claims (correction banners added, no history rewritten):**

| File | Stale claim | Correction added |
|---|---|---|
| [ADR/ADR-030-Refund-Source-Lineage.md](../ADR/ADR-030-Refund-Source-Lineage.md) | `Status: Implemented (2026-06-05)` | Banner after metadata: real write-side fix was B01 (2026-07-18), not 2026-06-05 |
| [Fix_29_05_2026/phase-06-refund-source-lineage-and-reopen-due.md](../Fix_29_05_2026/phase-06-refund-source-lineage-and-reopen-due.md) | `Status: Done`, "classifyRefunds ... updated to use canonical column" | Banner: covers migration/backfill only, not the service write path |
| [Fix_29_05_2026/order-fin-v1_1-implementation-status.md](../Fix_29_05_2026/order-fin-v1_1-implementation-status.md) | Phase 6 "Done" row + "Phase 11 shipped. Program COMPLETE." decision-log entries | Banner after metadata scoping the correction to the refund-lineage claim only; other phases (2–5, 7–9) unaffected |
| [Fix_29_05_2026/phase-11-documentation-refresh.md](../Fix_29_05_2026/phase-11-documentation-refresh.md) | ADR status-flip table row + "Order Financial v1.1 Full Alignment is COMPLETE" | Banner scoping the correction to the ADR-030/refund-lineage row |
| [Opus_Validation_Report_18_06_2026/04_IMPLEMENTED_FEATURES.md](../Opus_Validation_Report_18_06_2026/04_IMPLEMENTED_FEATURES.md) | "Refunds — ✅ (structure)" citing `refund_source_type` classification | Banner: verified the in-memory heuristic, not that it reached the DB column |
| [Opus_Validation_Report_18_06_2026/22_FOLLOWUP_DEEP_DIVE.md](../Opus_Validation_Report_18_06_2026/22_FOLLOWUP_DEEP_DIVE.md) | Confirmations table "Refund accounting structure ✅ sound ... refund_source_type classification (verified earlier)" | Banner: same over-claim; F-10 idempotency finding in the same file remains accurate and is not corrected |
| [Order_Fin_Docs/RECONCILIATION_GUIDE.md](../Order_Fin_Docs/RECONCILIATION_GUIDE.md) | "executes 7 checks" / "The 7 Checks" | Banner: `total_checked` is now 38 post-B20; the 7 documented checks remain individually accurate, only the "7 total" framing is stale |

**Folders checked, no correction needed:** `Order_Fin_Remediation_2026-07/` (current, accurate), `Order_Fin_Validation_Report_2026-07-03/` (confirms gaps, doesn't overclaim), `technical_docs/` (structural, no completeness claims), `bvm_wiring_implementation_plans_from_claude/` (correctly documents later-collection as still bypassing BVM — matches the still-open B4 gap), `CleanMateX_Payment_Settlement_Catalogs_Upgrade_Reference_v1_1/`, `CleanMateX_Customer_Receipt_Auto_Allocation_Feature_Pack_v1_0/`, `Payment_Modal_08_07_2026/`, `Payment_Modal_Review/` (all unrelated topics). No GL/ERP-journal completeness claims found anywhere in scope (that gap — B6 — is undocumented outside this planning folder, so nothing to correct).

**Tests:** n/a (doc review checklist per scope).

**Commit:** — (owner) · **Preview QA:** not applicable for a documentation-only package (no runtime surface) · **Reviewer:** — · **Verification:** links validated (all 7 corrected files' relative links to the authoritative report + B01/B20 resolve) · **Authoritative report update:** none required — the frozen report itself was re-checked and found current (A2 already carries its own B35-resolution addendum).
