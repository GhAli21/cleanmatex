# B37 — Order Edit Charge-Fact Parity

## Metadata
Backlog ID: B37 · Severity: HIGH · Classification: CONTROL_GAP · Status: **PROPOSED · DECISION_REQUIRED** (design only — no code written)
Required decisions: D-B37-1 (write-path shape), D-B37-2 (existing-order backfill) — **NOT YET APPROVED**
Dependencies: B18 (IMPLEMENTED — established the charge-fact model this package extends to the edit path) · Blocks: —
Related: **B36** (collection) — separate concern, same trigger (editing an order)
Recommended phase: **small and self-contained — can ship ahead of B36**
Origin: documented as a known gap in B18's own self-review; re-surfaced 2026-08-14 when the owner asked what happens when edits change items, pieces, and preferences after intake.

---

## Confirmed problem

**Adding or changing a preference through an order *edit* moves money but writes no charge fact, so two already-live BLOCKER-severity reconciliation checks fail.**

B18 established that every chargeable preference (item, piece, or order level) with `extra_price > 0` gets one `org_order_charges_dtl` row with `charge_source_id` pointing at the preference. That writer exists **only on the create path**. The edit path writes the preference rows — and therefore the money — without the corresponding fact.

## Current evidence (verified 2026-08-14)

| Check | Result |
|---|---|
| `org_order_charges_dtl.createMany` in `order-service.ts` | **one** call, line **1578** |
| Enclosing function | `createOrderInTransaction` (starts 1105; next function `updateOrder` starts 2752) |
| Charge-fact writes inside `updateOrder` | **zero** |

`updateOrder`'s add-item flow delegates to the shared `OrderPieceService.createPiecesForItemWithTx` (also used by create), which writes real preference rows carrying `extra_price` — but the charge-fact writer never runs for them.

**Consequence:** the two BLOCKER-severity checks introduced by an earlier BVM program — `ORDER_PIECES_MATCH_CHARGES` and `ORDER_PREFERENCES_MATCH_CHARGES` — compare real preference/piece `extra_price` sums against the charge ledger. Any order edited to add a chargeable preference will fail them.

This is a **pre-existing gap, not a regression** — B18 documented it in its own self-review ("broader than originally documented"). It becomes materially more likely as order editing is used more.

---

## Design

### D-B37-1 — Write-path shape *(decision required)*
**Recommended:** extract B18's charge-fact writer from `createOrderInTransaction` into a shared, idempotent `syncOrderChargeFactsTx(tx, tenantId, orderId)` that **re-derives** the full chargeable-preference set for the order and reconciles the charge rows to match (insert missing, void removed). Call it from both create and edit.

Re-deriving rather than appending is what makes it safe on the edit path, where preferences can be **removed** as well as added — an append-only writer would leave orphan charges behind and fail the same checks from the other direction.

*Rejected:* duplicating the create-path writer into `updateOrder`. Two copies of money-fact logic is precisely the drift pattern that produced this gap and B36's triplicated `isPoc`.

### D-B37-2 — Existing orders *(decision required)*
Orders already edited before this ships may carry the inconsistency. Options: (a) leave and let the checks report them, (b) one-off reconciliation/backfill script, (c) self-heal on next edit via the re-derive writer.

**Recommended: (c) + (a)** — the re-derive writer heals any order on its next edit at no extra cost, and the existing checks give visibility on the rest. A dedicated backfill (b) can follow if the reported volume justifies it. Mirrors the owner-approved "fix forward only, flag backfill separately" decision from B18.

---

## Scope
- Shared idempotent charge-fact sync helper, called from create **and** edit
- Coverage for all three preference levels (order / item / piece), matching B18's model
- Regression proof that the create path's behaviour is unchanged

## Out of scope
- Changing what counts as chargeable, or `charge_type` semantics (B18 owns these)
- Per-charge taxability (`is_taxable` does not exist — B18 deferred it)
- Collection of the resulting balance (**B36**)
- Backfill of historical orders (D-B37-2 option b, deferred)

## Financial effects
| Area | Impact |
|---|---|
| Order totals | NO — `recalculateOrderFinancialSnapshotTx` already sums preference `extra_price` directly; totals are already correct |
| Charge ledger | YES — the missing facts get written |
| Reconciliation | YES — clears two BLOCKER-severity checks |

> The customer is **not** being mis-charged today. The total is right; the *audit fact* backing it is missing. This is a control/reconciliation defect, not a money defect — which is why it is separable from B36.

## Acceptance criteria
1. Adding a chargeable preference via edit writes exactly one charge fact per preference, with `charge_source_id` set.
2. Removing one voids/removes its charge fact.
3. `ORDER_PIECES_MATCH_CHARGES` and `ORDER_PREFERENCES_MATCH_CHARGES` pass for edited orders.
4. Re-running an edit does not duplicate charge facts (idempotent re-derive).
5. Create-path behaviour byte-identical (B18 suite green).

## Required tests
Unit (re-derive: add / remove / unchanged / zero-price) · integration (edit → charge facts → snapshot) · **DB-integration** (real edit adding a preference, then assert both recon checks pass — extends `order-amendment-governed-flow.db.test.ts`) · regression (full B18 suite).

## Dependencies and sequencing
Self-contained, no migration expected, no new permission. **Can ship independently of and ahead of B36** — smaller, lower-risk, and clears live reconciliation failures.

## Delivery surfaces
Backend services: shared `syncOrderChargeFactsTx`; called by `createOrderInTransaction` + `updateOrder`
Database/schema: none — no migration expected
API/endpoints: none new (existing edit route)
Frontend page/screen/dialog/action: **NOT_APPLICABLE**
Reason: pure server-side fact-writing parity; no operator-visible behaviour change
Existing consumer: reconciliation checks `ORDER_PIECES_MATCH_CHARGES`, `ORDER_PREFERENCES_MATCH_CHARGES`; order financial snapshot charge components
Operational visibility: reconciliation run results
Failure detection: the two BLOCKER checks
Recovery method: re-run the edit (re-derive is idempotent) or the deferred backfill
Reusable components/helpers: extracted from B18's existing create-path writer
Permissions / Validation / i18n / Accessibility / Audit / Jobs: NOT_APPLICABLE (no new surface; charge rows carry standard audit columns)
Feature flag: none — this is a defect fix
Rollout: ships with normal release; behaviour is additive
Rollback: revert the edit-path call; create path unaffected

## Completion evidence
Migration: n/a · Implementation files: none — **no code written** · Tests: none yet
Commit: — · Preview QA: — · Reviewer: — · **Approved decision: NOT YET APPROVED**
