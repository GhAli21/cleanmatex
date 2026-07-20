# B05 — Later Collection Idempotency

## Metadata
Backlog ID: B5 · Severity: HIGH · Classification: BLOCKS_PRODUCTION · Status: **IMPLEMENTED 2026-07-20** (see Completion evidence, ships in the B4 wave) — awaiting owner commit → Preview QA → approval before VERIFIED
Authoritative report sections: H5, §16, §32, §50-B5
Required decisions: [D010](00_Phase_0_Financial_Semantics/D010_Financial_Idempotency_And_Lineage.md)
Dependencies: [B04](B04_Later_Collection_BVM_Parity.md) (hard — same code path)
Blocks: — · Recommended phase: Seq 4 (immediately after B4)

## Confirmed problem
Collect payment inserts carry no idempotency guard; the route key is optional; a client retry duplicates payment rows and drawer movements (H5).

## Current evidence
| File or symbol | Current behavior | Gap |
|---|---|---|
| order-settlement.service.ts:640 | key defaults to random UUID; guards only pos-link/disposition | payment create unguarded |
| collect-payment/route.ts:20 (+ dup payments route) | `idempotencyKey` optional | must be required |

## Required outcome
Required client key on both collect routes; per-leg deterministic sub-keys (`{key}_leg_{i}` grammar per D010) with skip-on-existing; same-key-different-payload → 409; retries yield zero new financial effects.

## Scope
Route schema tightening; keyed leg creation inside the B4 voucher path; conflict handling; DB backstop unique index assessment.

## Out of scope
Voucher path itself (B4); submit-path keys (already strong).

## Financial effects
| Area | Impact |
|---|---|
| Commercial total | NO |
| Payment facts | YES (dup prevention) |
| Credit applications | NO |
| BVM | YES (keyed lines — B4 pattern) |
| Cash drawer | YES (dup prevention) |
| Gateway or bank | NO |
| Tax documents | NO |
| ERP-Lite GL | NO |
| Snapshot | YES (no dup paid) |
| Reconciliation | YES |
| Customer receipt | NO |
| Audit/outbox | NO |

## Acceptance criteria
Duplicate-retry test creates exactly one payment/drawer/voucher set; missing key → 400; changed payload on same key → 409.

## Required tests
API, idempotency, concurrency, database (unique backstop), regression.

## Dependencies and sequencing
Hard after B4; ships in the same wave.

## Delivery surfaces

Backend services: `collectPaymentTx` — a top-level idempotency check runs first inside the transaction (`org_idempotency_keys`, `resource_type='collect_payment'`, keyed on the bare route-supplied `idempotencyKey`): identical-payload replay short-circuits and returns the original cached `SettlementResult` with zero new effects (before the order lock even runs, so a replay never re-validates against an outstanding balance the original call already reduced); a changed payload throws `IDEMPOTENCY_CONFLICT`. Per-leg sub-keys (`${idempotencyKey}_leg_${legIndex}`) ride the voucher-line service's own idempotency (skip-on-existing, D010 grammar); the voucher itself is keyed `${idempotencyKey}_vch`; post-and-wire is keyed `${idempotencyKey}_vch_post` (existing `postAndWireBizVoucher` mechanism) — four independent, layered guards, all off the one caller-supplied key
Database/schema: none new — reuses the existing `org_idempotency_keys` table (no new sparse unique index needed; the table already carries a `(tenant_org_id, key, resource_type)` unique constraint)
API/endpoints: both collect routes — `idempotencyKey` required in the Zod schema (400 on missing/empty via the existing generic validation-error path); `IDEMPOTENCY_CONFLICT` mapped to 409 (was previously falling through to a generic 422)
Frontend page/screen/dialog/action: collect-payment modal — the per-attempt key is now generated once per dialog-open (`useState(() => crypto.randomUUID())`, regenerated in the existing open-reset `useEffect` alongside amount/cashTendered) instead of freshly per click, so a retry of the SAME attempt reuses it while a genuinely new collection (dialog reopened) gets a fresh one; submit stays disabled while in flight (pre-existing `submitting` state); 409 mapped to `t('idempotencyConflict')`
Reusable components/helpers: `hashPayload`/`canonicalize` (`lib/utils/idempotency`) reused as-is for the payload-hash comparison; no new shared helper needed beyond that
Permissions: unchanged
Validation: key presence (`z.string().min(1).max(200)`, required); payload-hash comparison via SHA-256 over `{orderId, paymentLegs, cashDrawerSessionId, posSessionId, customerId, overpaymentResolution}` (includes `orderId` so a key reused across two different orders is caught as a conflict, not silently misapplied)
i18n/RTL: `orders.collectPayment.idempotencyConflict` EN/AR (see B04 evidence — shipped together)
Accessibility: no new interactive element; the conflict message renders through the existing error-toast path
Audit trail: replay returns the original cached result — no duplicate outbox emission (the whole function short-circuits before the outbox emit line runs)
Observability: none new added this pass (a duplicate-attempt log/metric was scoped out — not required by this package's acceptance criteria; can be added if the reconciliation team wants one)
Jobs/workers: none
Feature flag: none — ships unconditionally with B4 (see B04 evidence for the flag-vs-unconditional decision)
Rollout: ships in the B4 wave (same commit/Preview/QA cycle)
Rollback: revert the B4/B5 commit together (no flag toggle)

## End-to-end operational flow

1. Modal generates the attempt key when the dialog opens; user submits; a double-click is already blocked by the disabled-while-submitting state, and a genuine network retry of the same attempt re-sends the same key.
2. Server: the top-level idempotency check runs before the order lock. Same key + same payload → returns the original `SettlementResult` verbatim, zero new voucher/payment/drawer/outbox effects. Same key + different payload → 409 with a "refresh and try again" message.
3. A genuinely new collection (dialog reopened, or a new amount/method chosen) gets a fresh key and proceeds normally.

## Completion evidence

**Migration:** none (reuses the existing `org_idempotency_keys` table — no new index needed).

**Implementation (2026-07-20):** see B04's Completion evidence for the full file list (B4 and B5 landed in the same `collectPaymentTx` rewrite, per their own "ships in the same wave" sequencing). B5-specific pieces: the `org_idempotency_keys` replay-check/store block at the top and bottom of `collectPaymentTx`; the required `idempotencyKey` Zod field + 409 mapping on both routes; the collect-payment modal's per-open stable key.

**Tests:** `__tests__/services/settlement.service.test.ts` → `describe('idempotency (B5/D010)')` — identical-payload replay returns the cached result without creating a new voucher (and asserts the order lock's `$queryRaw` was never called, proving the short-circuit happens before any re-validation); same-key-different-payload throws `IDEMPOTENCY_CONFLICT`. `__tests__/migrations/phase1-order-fin.test.ts` "1C" section rewritten for the new required-key contract (see B04 evidence — the old F-10 "falls back to a per-request UUID" assertion was itself the behavior B5 supersedes).

**Gates:** see B04's Completion evidence — shared gate run (tsc/eslint/i18n/jest/build all green).

**Commit:** — (owner) · **Preview QA (deploy/result/approval):** — pending (duplicate-retry scenario: submit the same collection twice with a forced-stable key → exactly one payment/voucher/drawer-movement set; missing-key request → 400; same-key-different-amount → 409) · **Reviewer:** — · **Verification:** — · **Authoritative report update:** — (H5 finding closes once VERIFIED).
