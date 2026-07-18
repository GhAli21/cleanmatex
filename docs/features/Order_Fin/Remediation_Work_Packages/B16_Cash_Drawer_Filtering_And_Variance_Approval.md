# B16 — Cash Drawer Filtering and Variance Approval

## Metadata
Backlog ID: B16 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: IN_PROGRESS — **Part A (expected-cash filter) IMPLEMENTED 2026-07-18** (flag-gated, gates green); **Part B (variance approval) migration 0407 authored → BLOCKED-ON-APPLY** (service/API/UI deferred until owner applies + Prisma regen). See Completion evidence.
Authoritative report sections: M2, §17, §40, §50-B16
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md) (status sets)
Dependencies: none · Blocks: — · Recommended phase: Seq 3

## Confirmed problem
Drawer-close expected-cash sums ALL session-linked payments — no `payment_status` COMPLETED filter, no `is_active` filter (cash-drawer.service.ts:1428) — pending checks/gateway legs inflate expected cash; variance has no approval workflow (§40).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| cash-drawer.service.ts:1426–1457 | unfiltered aggregate → expected/variance | wrong variance possible |
| session summary/report path | same aggregation | consistent but equally wrong |
| §40 | variance approval NOT_FOUND | stored, ungated |

## Required outcome
Expected cash includes only active, financially successful cash facts (COMPLETED set, is_active, CASH-family) plus movements; variance beyond a configurable threshold requires an approval action with reason (permission via B27); close report reflects the filtered math.

## Scope
Aggregate filter fix (close + summary + report); variance approval gate + audit fields.

## Out of scope
Safe/bank-deposit operations (B26); refund OUT movements (B9); PENDING drawer gating (B32).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | NO |
| Credit applications | NO |
| BVM | NO |
| Cash drawer | YES (expected/variance math) |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | POSSIBLE (variance journal later, B6) |
| Snapshot | NO |
| Reconciliation | YES (drawer checks) |
| Customer receipt | NO |
| Audit/outbox | YES (approval record) |

## Acceptance criteria
Session with a pending check leg closes with expected cash excluding it; variance above threshold blocks close until approved with reason.

## Required tests
unit, integration (close scenarios), UI (approval), regression.

## Dependencies and sequencing
Independent; coordinate the status set with D001.

## Delivery surfaces

Backend services: closeSession/loadSummaryData aggregate filter (COMPLETED set + is_active + CASH family); variance-approval gate service
Database/schema: variance approval columns on session close (approver, reason, threshold snapshot) — assess additive
API/endpoints: close endpoint gains approval sub-flow (threshold exceeded → requires approval payload)
Frontend page/screen/dialog/action: drawer close screen — expected-cash breakdown shows only effective facts; variance-over-threshold triggers an approval dialog (approver + mandatory reason); session detail displays approval record
Reusable components/helpers: approval dialog pattern (shared with B24/B12)
Permissions: variance-approval code via B27
Validation: threshold from tenant config; approver ≠ closer
i18n/RTL: EN/AR close/approval strings
Accessibility: dialog focus; variance announced as text
Audit trail: approval actor/reason on session row
Observability: variance distribution metric; recon drawer checks
Jobs/workers: cash-close escalation deferred (B19/§45)
Feature flag: `order_fin.drawer_close_v2`
Rollout: staging parity (filtered expected vs physical counts) → enable
Rollback: flag off restores current aggregate (documented known M2)

## End-to-end operational flow

1. Cashier closes drawer → expected cash computed from effective facts only; pending checks visibly excluded with a note.
2. Variance within threshold → close completes; beyond threshold → approval dialog; approver confirms with reason → close records both actors.
3. Session detail and drawer report show the same filtered math and the approval trail.

UI states: standard Cmx state contract — loading, empty, validation errors, permission-denied (approval action disabled with reason), duplicate-click protection (in-flight disable), processing, success, retry on failure; approval trail visible on the session record.

## Safety

UI design allowed: YES · UI implementation allowed: YES behind `order_fin.drawer_close_v2`
Production activation allowed: ships as one unit with the corrected aggregate — the new close screen never renders over the unfiltered math
Required backend gates: filtered expected-cash aggregate in the same release
Required decision gates: D001 (COMPLETED-set conformance)
Required verification gates: close-parity tests (filtered vs physical counts) green

## Completion evidence

**Part A — expected-cash filter (IMPLEMENTED 2026-07-18, no migration, flag-gated):**
- NEW `lib/services/cash-drawer-cash-facts.ts` — the single effective-cash predicate: `effectiveCashPaymentWhere()` (Prisma fragment: `is_active` + `payment_status ∈ {COMPLETED,CAPTURED,SETTLED}` + `payment_method_code ∈ CASH-family`), `isEffectiveCashPaymentRow`, `sumEffectiveCashPayments`, reusing B02's `isCompletedPaymentStatus` and `ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED` (one definition of "financially successful", D001/D005).
- `lib/services/cash-drawer.service.ts` — filter applied at every expected-cash site behind the flag: `closeSession` (authoritative persist), `buildSessionReconciliation`/`getSessionSummary` (summary), `loadPaymentTotalsBySession` (feeds list + detail derived-expected), threaded via a single `isDrawerCloseV2Enabled(tenantId)` resolve per entry point (`getCashDrawerOverviewPage`, `getCashDrawerSessionsPage`, `getCashDrawerOverviewDetail`, `getCashDrawerSessionDetail`). Flag OFF = legacy unfiltered aggregate (documented known M2) → controlled, reversible rollout (B16 Rollback).
- Feature flag `order_fin_drawer_close_v2` registered (`lib/constants/feature-flags.ts` FLAG_CATALOG + `lib/types/tenant.ts` FeatureFlags), independent, default OFF everywhere. HQ catalog seeding (`hq_ff_feature_flags_mst`) is a cleanmatexsaas follow-up (same pattern as B34's `order_fin_refund_ui`).
- Flag key normalized from the spec's `order_fin.drawer_close_v2` to catalog snake_case `order_fin_drawer_close_v2`.

**Tests (Part A):** NEW `__tests__/services/cash-drawer-cash-facts.test.ts` (pure predicate — PENDING cheque / gateway PENDING·AUTHORIZED·PROCESSING / FAILED·CANCELLED·REVERSED / inactive / non-cash all excluded; COMPLETED·CAPTURED·SETTLED cash included) + `cash-drawer.service.test.ts` extended (flag OFF = unfiltered `where`; flag ON = active+COMPLETED-set+cash-family `where`). **Fixed the pre-existing owner failure** in `cash-drawer.service.test.ts` (added the missing `org_cash_drawer_movements_dtl.findMany` mock + the feature-flags `canAccess` mock). Targeted suites **30/30 green**.

**Gates (Part A, 2026-07-18, all green):** `npx tsc --noEmit` clean · `npx eslint … --quiet` 0 · targeted jest 30/30 · `npm run build` ✓ (exit 0). (No i18n strings added in Part A; the variance-approval strings land with Part B, so `check:i18n` is not applicable here.)

**Part B — variance approval (migration authored → BLOCKED-ON-APPLY):**
- Migration `supabase/migrations/0407_b16_drawer_variance_approval.sql` authored (additive only): `org_cash_drawer_sessions_mst` gains `variance_approved_by`, `variance_approved_at`, `variance_approval_reason`, `variance_threshold_snapshot`; `org_cash_drawers_mst` gains `variance_approval_threshold` (NULL = inherit tenant default). **STOPPED — owner applies 0407 + regenerates Prisma client before the variance-approval service/API/UI is written** (that code references the new columns and will not typecheck/build until then).
- Permission `cash_drawer:approve_variance` is **B27's** responsibility (master index — B27 owns "cash variance approval"); B16 consumes it. The approval action stays inert until B27 seeds/grants it AND the flag is on (B16 Safety: permission-sensitive actions gated by B27).
- Deferred to post-apply: `closeSession` variance-threshold resolution + approval enforcement (approver ≠ closer, mandatory reason, threshold snapshot persist), close endpoint approval sub-flow, close-screen expected-cash breakdown + variance-over-threshold approval dialog, session-detail approval trail, EN/AR strings, approval tests.

**Newly discovered (Addendum A2, verified 2026-07-18):** the drawer expected-cash formula **double-counts cash sales** (settlement writes both a session-linked payment row AND a `CASH_SALE` movement; both are summed). Out of B16's documented scope — the owner is actively resolving the movement-folding model in `buildCashDrawerClosePreview` (tests currently failing). Recorded as **Addendum A2** in the authoritative report with a follow-up recommendation to unify one expected-cash formula across `closeSession`/`buildSessionReconciliation`/`buildCashDrawerClosePreview`. B16 deliberately does not touch the movement term.

**Commit:** — (owner) · **Preview QA (deploy/result/approval):** — pending (Part A: staging parity filtered-vs-physical with flag on; Part B after 0407 applied) · **Reviewer:** — · **Verification:** — · **Authoritative report update:** Addendum A2 added 2026-07-18.
