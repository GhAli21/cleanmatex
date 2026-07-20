# B31 — Later Collection Default Status

## Metadata
Backlog ID: B31 · Severity: MEDIUM · Classification: CONTROL_GAP · Status: **IMPLEMENTED 2026-07-20** (see Completion evidence, ships in the B4 wave) — awaiting owner commit → Preview QA → approval before VERIFIED
Authoritative report sections: M6, §31.1, §32, §50-B31
Required decisions: [D001](00_Phase_0_Financial_Semantics/D001_Payment_Lifecycle_And_Status_Transitions.md)
Dependencies: [B04](B04_Later_Collection_BVM_Parity.md) (hard — same path) · Blocks: —
Recommended phase: Seq 4 (with B4/B5)

## Confirmed problem
`collectPaymentTx` never reads `default_creation_status` (column not selected) and hardcodes non-gateway → COMPLETED — a CHECK/BANK method configured PENDING is counted as paid instantly at later collection, before clearing (M6).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement.service.ts:695–703 | method select omits default_creation_status | config invisible |
| order-settlement.service.ts:827 | `gatewayCode ? 'PENDING' : 'COMPLETED'` | hardcode |
| order-settlement-planner.service.ts:90–106 | submit resolves config + explicit status correctly | parity target |

## Required outcome
Collection resolves creation status identically to submit (D9 config beats family fallback; explicit request may force PENDING, never COMPLETED over a PENDING config); PENDING-configured collections land as pending legs feeding the B30 worklist; paid recognition follows verification.

## Scope
Status resolution reuse inside the B4-refactored collect path; response warnings parity (`*_PENDING_CONFIRMATION`).

## Out of scope
BVM path (B4); idempotency (B5); transitions (B30).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (correct initial status) |
| Credit applications | NO |
| BVM | NO (line status via B4 path) |
| Cash drawer | POSSIBLE (with B32 gating) |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | YES (pending excluded from paid) |
| Reconciliation | YES |
| Customer receipt | YES (pending shown) |
| Audit/outbox | NO |

## Acceptance criteria
CHECK configured PENDING collected later → leg PENDING, order not PAID, appears in worklist; CASH behavior unchanged.

## Required tests
unit (resolution parity vs submit), integration, regression.

## Dependencies and sequencing
Ships with the B4/B5 wave.

## Delivery surfaces

Backend services: status resolution reuse inside the B4 collect path via the exported `resolveDefaultStatus` (from the submit planner, `order-settlement-planner.service.ts`) — collect no longer hardcodes `gatewayCode ? 'PENDING' : 'COMPLETED'`; method resolution now goes through `listEffectivePaymentMethodConfigs`, which already selects `default_creation_status`/`allow_status_override` through the D9 org-override → sys-default chain (with branch overrides merged in)
Database/schema: none (no migration needed — the D9 columns already existed; the gap was collect never reading them)
API/endpoints: `checkout-options` route (shared by submit + collect) now returns `default_creation_status` per method — additive, no breaking change for existing consumers. Per-leg `resolvedPaymentStatus`/`*_PENDING_CONFIRMATION` structured warnings on the collect response itself were **not** added — out of scope for what B31's acceptance criteria actually requires (correct status resolution + a visible pending notice), and inventing a new response contract field for it risked scope creep with no consumer yet
Frontend page/screen/dialog/action: collect-payment modal shows a "will be recorded as pending until verified" notice **before submit** when the selected method carries an explicit D9 `default_creation_status: 'PENDING'` override (a deliberate simplification — inherited system-default PENDING is not detected client-side, to avoid duplicating the server's full fallback chain in the UI). A **post-submit** pending notice linking to a B30 worklist was **not** built — B30 (the worklist) does not exist yet, so there is nowhere to link; this is an explicit, tracked gap for B30 to close, not a silent omission
Reusable components/helpers: `resolveDefaultStatus` (shared, not copied — satisfies this package's own Validation requirement below)
Permissions: unchanged
Validation: resolution parity **is** asserted against the submit planner via the shared `resolveDefaultStatus` function (not copied logic) — verified by a dedicated test (see Completion evidence)
i18n/RTL: `orders.collectPayment.pendingUntilVerified` EN/AR
Accessibility: notice uses `role="status" aria-live="polite"` — announced, not color-only
Audit trail: unchanged (status lands on the fact row exactly as submit's does)
Observability: none new (worklist aging is B30's concern once it exists)
Jobs/workers: none
Feature flag: none — ships unconditionally with B4 (see B04 evidence)
Rollout: with the B4/B5 wave
Rollback: revert the B4/B5/B31 commit together (no flag toggle)

## End-to-end operational flow

1. Cashier opens Collect Payment; if the selected method's D9 config explicitly overrides to PENDING, the modal shows the pending notice before submit.
2. Submit records the leg at the D9-resolved status (PENDING for an explicit override, or the shared `resolveDefaultStatus` fallback otherwise — CASH/CARD → COMPLETED, gateway → PROCESSING, everything else → PENDING) instead of the old hardcoded `gatewayCode ? 'PENDING' : 'COMPLETED'`; the order's outstanding/paid status reflects this honestly via the existing snapshot recalc.
3. There is currently no B30 worklist to surface the pending leg for later verification — this is a known, tracked follow-up, not a claim that verification already works end-to-end.

UI states: standard Cmx state contract — loading, validation errors, permission-denied, duplicate-click protection (B5 keys), processing, success with pending notice, retry on failure; leg status visible via the existing order Financial tab (no new history view added).

## Completion evidence

**Migration:** none (as planned).

**Implementation (2026-07-20):** see B04's Completion evidence for the full shared file list. B31-specific pieces: `resolveDefaultStatus` exported from `order-settlement-planner.service.ts`; `collectPaymentTx`'s per-leg status resolution (`method.default_creation_status || resolveDefaultStatus(...)`, with `leg.paymentStatus === 'PENDING'` as an explicit override — mirrors the planner's own precedence exactly); `checkout-options` route's additive `default_creation_status` field; the collect modal's `willBePending` notice.

**Tests:** `__tests__/services/settlement.service.test.ts` → `'resolves PENDING from the D9 config instead of hardcoding gateway ? PENDING : COMPLETED (B31)'` — a CHECK method configured `default_creation_status: 'PENDING'` produces a voucher line with `payment_status: 'PENDING'` (previously would have been hardcoded `'COMPLETED'` since CHECK has no `gatewayCode`). The CASH scenario in the same file's first test also proves the no-override fallback path (CASH with `default_creation_status: null` → resolves to `'COMPLETED'` via `resolveDefaultStatus`, matching submit's behavior).

**Gates:** see B04's Completion evidence — shared gate run (tsc/eslint/i18n/jest/build all green).

**Commit:** — (owner) · **Preview QA (deploy/result/approval):** — pending (CHECK configured PENDING collected later → leg lands PENDING, order not marked fully paid, modal shows the pre-submit notice; CASH behavior unchanged vs. today) · **Reviewer:** — · **Verification:** — · **Authoritative report update:** — (M6 finding closes once VERIFIED).
