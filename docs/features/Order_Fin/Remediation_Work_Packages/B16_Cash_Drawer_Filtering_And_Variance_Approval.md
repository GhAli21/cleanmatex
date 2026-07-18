# B16 — Cash Drawer Filtering and Variance Approval

## Metadata
Backlog ID: B16 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: **IMPLEMENTED 2026-07-18** — **Part A (expected-cash filter)** and **Part B (deferred variance approval)** both implemented, gates green (see Completion evidence) — awaiting owner commit → Preview QA.
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

**Tests:** NEW `__tests__/services/cash-drawer-cash-facts.test.ts` (pure predicate — PENDING cheque / gateway PENDING·AUTHORIZED·PROCESSING / FAILED·CANCELLED·REVERSED / inactive / non-cash all excluded; COMPLETED·CAPTURED·SETTLED cash included) + `cash-drawer.service.test.ts` extended: Part A (flag OFF = unfiltered `where`; flag ON = active+COMPLETED-set+cash-family `where`) + Part B (`closeSession` pending-flag: OFF-even-over-threshold / ON-over-threshold-pending / ON-within-threshold-not-pending; `approveSessionVariance`: happy path, self-approval blocked, blank reason rejected, not-pending rejected, already-approved rejected, `VarianceApprovalError` shape). **Fixed the pre-existing owner failure** in `cash-drawer.service.test.ts` (added the missing `org_cash_drawer_movements_dtl.findMany` mock + the feature-flags `canAccess` mock). Targeted suites **39/39 green** (9 cash-facts + 30 service, updated from 30 after Part B additions).

**Gates (2026-07-18, all green):** `npx tsc --noEmit` clean (both after Prisma regen) · `npx eslint … --quiet` 0 · targeted jest 39/39 · `npm run check:i18n` ✓ (Part B strings) · `npm run build` ✓ (exit 0, both passes).

**Part B — variance approval (IMPLEMENTED 2026-07-18, after owner applied migration 0407 + regenerated Supabase types):**
- Migration `supabase/migrations/0407_b16_drawer_variance_approval.sql` applied by owner (additive): `org_cash_drawer_sessions_mst` gains `variance_approved_by`, `variance_approved_at`, `variance_approval_reason`, `variance_threshold_snapshot`; `org_cash_drawers_mst` gains `variance_approval_threshold` (NULL = inherit tenant default / no gate). `prisma/schema.prisma` updated to mirror the 5 new columns (the applied migration regenerated Supabase types but not the Prisma schema) + `npx prisma generate` re-run.
- **Model (owner decision, 2026-07-18): deferred close-then-approve** — the cashier closes the session regardless of variance; when drawer-close v2 is on and the drawer has a configured `variance_approval_threshold` and `|variance| > threshold`, the session is flagged pending approval (`variance_threshold_snapshot` persisted; `variance_approved_by` stays NULL). A supervisor approves separately via a dedicated action — approver **must differ from `closed_by`** (maker≠checker, server-enforced), reason is mandatory. Rejected the block-close-until-approved alternative (would require a second authenticated actor present at close time).
- `lib/services/cash-drawer.service.ts`: `closeSession` resolves the drawer's threshold, computes `varianceApprovalPending`/`varianceThreshold`, persists the threshold snapshot only when pending (doubles as the "approval required" signal — no new status enum). New `approveSessionVariance(tenantId, sessionId, { approvedBy, reason })`: `VarianceApprovalError` with stable codes `VARIANCE_NOT_PENDING_APPROVAL` / `VARIANCE_ALREADY_APPROVED` / `VARIANCE_SELF_APPROVAL_BLOCKED` / `VARIANCE_REASON_REQUIRED`; `deriveVarianceApprovalState` derives required/pending/approved from the persisted columns.
- `lib/types/cash-drawer.ts`: `CashDrawerVarianceApproval` (required/pending/approved/thresholdSnapshot/approvedBy/approvedAt/reason) added to `CashDrawerSessionLifecycleDetail`; `getCashDrawerSessionDetail` populates it via new `buildVarianceApprovalDetail`.
- API: `POST /api/v1/cash-drawers/[drawerId]/session/[sessionId]/approve-variance` — CSRF + `requirePermission('cash_drawer:approve_variance')` (fail-closed until B27 seeds the permission and grants a role), Zod `{ reason: string.min(1) }`, maps `VarianceApprovalError` codes to 400/403/409.
- Frontend: `cash-drawer-variance-approval-dialog.tsx` (Cmx dialog + `CmxTextarea` reason, `cmxMessage` error mapping, mirrors the pos-session close/force-close dialog pattern) wired into `cash-drawer-session-detail-screen.tsx` — pending banner + gated "Approve Variance" button (`useHasPermissionCode('cash_drawer:approve_variance')`), approved banner (approver + date + reason), threshold info tile; `router.refresh()` on approval.
- Feature API client: `approveCashDrawerSessionVariance` in `cash-drawer-api.ts`.
- Access contract: `pos-sessions-access.ts` extended with the `approveCashDrawerVariance` action + the new API dependency (existing file already references `cash_drawer:*` codes; no new access-contract file needed).
- Permission `cash_drawer:approve_variance` remains **B27's** responsibility to seed/grant (master index); until then the route/action correctly denies everyone (B16 Safety: permission-sensitive actions gated by B27).
- i18n: EN/AR strings added under `billing.cashDrawers.*` (banner/dialog/button labels + `messages.variance*`); `check:i18n` passes.

**Newly discovered (Addendum A2, verified 2026-07-18):** the drawer expected-cash formula **double-counts cash sales** (settlement writes both a session-linked payment row AND a `CASH_SALE` movement; both are summed). Out of B16's documented scope — the owner is actively resolving the movement-folding model in `buildCashDrawerClosePreview` (tests currently failing). Recorded as **Addendum A2** in the authoritative report with a follow-up recommendation to unify one expected-cash formula across `closeSession`/`buildSessionReconciliation`/`buildCashDrawerClosePreview`. B16 deliberately does not touch the movement term.

**Commit:** — (owner) · **Preview QA (deploy/result/approval):** — pending (staging parity: filtered-vs-physical with `order_fin_drawer_close_v2` on; deferred-approval scenario — over-threshold close → pending banner → different-user approval → approved banner; self-approval rejection; B27's permission must be seeded/granted first for the approval action to be reachable) · **Reviewer:** — · **Verification:** — · **Authoritative report update:** Addendum A2 added 2026-07-18 (drawer cash-sale double-count — separate from this package, owner in-flight fix).
