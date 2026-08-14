# B36 — Outstanding Balance Collection & Release Control

## Metadata
Backlog ID: B36 · Severity: HIGH · Classification: BLOCKS_FEATURE / CONTROL_GAP · Status: **PROPOSED · DECISION_REQUIRED** (design only — no code written)
Required decisions: D-B36-1 … D-B36-5 — all **NOT YET APPROVED**
Dependencies: B12 (IMPLEMENTED — supplies the delta + settlement endpoint) · B30 (worklist pattern to copy) · B5 (idempotency) · Workflow Engine V2 (for §5 release gate — see risk) · Blocks: —
Related: **B24** owns customer-level multi-order allocation (explicitly out of scope here) · **B37** owns the edit-path charge-fact gap
Recommended phase: **after the current IMPLEMENTED batch reaches VERIFIED** — see Sequencing
Origin: owner, from the Edit Order screen, expanded across a 2026-08-14 design conversation covering edits outside the counter, handover screens, and collection surfaces.

---

## Confirmed problem

**An order can accumulate a real receivable that no screen can collect, and nothing prevents the goods being handed over anyway.**

B12 correctly records amendments and recalculates `outstanding_amount`. But collection is gated on a *static classification* (`payment_type_code`) rather than the *derived state* (`outstanding_amount`), so orders that become payable through amendment fall outside every collection surface. The financial release gate that should catch this at handover is an unimplemented stub.

---

## Current evidence (verified against code + remote DB, 2026-08-14)

### E1 — Collection is scoped to one payment type, in three duplicated places
| Location | Gate | Effect |
|---|---|---|
| `order-settlement.service.ts:727` | `AND payment_type_code = 'PAY_ON_COLLECTION'` | only collection service in the codebase |
| `order-receivable-collection-panel.tsx:60` | `isPoc && payOnCollectionAmount > 0.001` | Order Details button hidden |
| `app/dashboard/ready/[id]/page.tsx:356` | `isPoc` | Pickup button hidden |

The policy is **copy-pasted three times** — which is why it drifted when amendments began producing outstanding balances on non-POC orders.

### E2 — Call sites disagree on the amount
`ready/[id]` passes `order.paymentSummary?.remaining`; `order-receivable-collection-panel` passes `amounts.payOnCollectionAmount`. Two different fields feed the same modal — a live inconsistency risk in a prefilled money field.

### E3 — Delivery has no collection path at all
`app/dashboard/delivery/` contains no reference to `OrderCollectPaymentModal` or outstanding balances, despite being a handover point.

### E4 — 🔴 The financial release gate is a stub
`lib/services/workflow/workflow-engine.service.ts:359`
```ts
case 'fin_release_eligible': {
  // TODO(Order Fin): replace stub with real Fin release eligibility check
  // (outstanding balance, hold flags, release policy). Must not invent logic here.
  return { allowed: true, blockedReasons: [] };
}
```
A repo-wide search of the workflow/transition path finds **no other reference to `outstanding`**. Nothing blocks releasing an order with money owed.

### E5 — Edits happen when the customer is gone
`EDITABLE_STATUSES = ['processing', 'draft', 'intake', 'preparation']`. Two of those four are customer-absent, so "collect at the counter" cannot be the only answer.

### E6 — Order-level receivables are invisible
The AR module (`internal_fin/ar/*`: aging, customers, ledger, statements, dunning) is **read-only** and `getArAgingReport` reads `org_invoice_mst` — **AR invoices only**. An amended prepaid order appears in neither AR aging (no invoice) nor a collectible state in Order Details. It is findable only by knowing its order number.

### E7 — Live stranded balances (remote `org_orders_mst`)
| `payment_type_code` | Orders | Outstanding > 0 | Amount | Collectible? |
|---|---|---|---|---|
| `PAY_ON_COLLECTION` | 33 | 21 | 110.400 | ✅ |
| `PAY_IN_ADVANCE` | 36 | **2** | **9.717** | ❌ **stranded** |
| `CREDIT_INVOICE` | 6 | 6 | 65.172 | out of scope (AR flow) |

### E8 — The governed path is live
`org_ff_overrides_cf`: `order_fin_governed_amendments` = `true`, `approved`, `is_active` for **2 tenants** including the demo tenant.

### E9 — `PaymentModalV4` cannot be reused directly
Its props take `items[]` and it prices them via `/api/v1/orders/preview-payment` — a **cart-pricing** model for an order that does not exist yet, with no concept of prior payments. Prefilling it on a partly-paid order and confirming would settle the **full** total again (double-charge).

---

## Design

### D-B36-1 — One server-derived eligibility truth *(decision required)*
**Recommended:** expose **`collectibleAmount`** (plus a `reason` string when zero) on the order financial view-model. Every surface then reduces to `if (collectibleAmount > 0) → show Collect, prefilled`.

No `isPoc` in the UI. No policy duplicated per screen. New screens inherit correct behaviour automatically, and E1/E2 become structurally impossible. Policy lives in one server function that can state *why* collection is unavailable ("settles through AR invoice AR-2026-014") instead of silently hiding a button.

### D-B36-2 — One collection core, many entry points *(decision required)*
**Recommended:** extract the shared money-movement core (payment row → BVM voucher + line → drawer movement → snapshot recalc → ERP dispatch → outbox) and make **`collectPaymentTx` a caller of it**, not a competitor.

Explicitly **rejected:** loosening `collectPaymentTx`'s `PAY_ON_COLLECTION` filter. One line to write, but it rides 33 live orders and the entire B4/B5/B31 wave, and it would merge two genuinely different business events (pickup collection vs. amendment settlement) — the same "two mechanisms, one concern" failure B17 flagged.

⚠️ **This is the riskiest item in the package.** It must be gated on the existing `PAY_ON_COLLECTION` regression suite passing byte-identical, and reviewed before merge rather than trusted.

### D-B36-3 — Surface selection by state, not by screen *(decision required)*
| Order state | Operation | Surface |
|---|---|---|
| No prior payments | initial settlement | full payment modal |
| Prior payments + outstanding | delta settlement | `OrderCollectPaymentModal` |

Today Edit Order offers **neither**, even for an unpaid order. Add prior-payment context to the collect modal — *"Order total 3.300 · Already paid 2.730 · Outstanding 0.570"* — so it reads as complete without inheriting V4's double-charge risk (E9).

**Non-negotiable invariant:** the settled amount is always the server-derived `collectibleAmount`, **never** the modal's displayed order total.

*Deferred:* converging both modals onto a shared tender component (method / tendered / change / drawer / split legs, parameterised by `amountDue`). Legitimate, but V4 stabilised over six July iterations and refactoring it mid-B36 risks destabilising the one payment surface that works. Its own package, after B36 is QA'd.

### D-B36-4 — Collect wherever goods change hands *(decision required)*
Wire the same modal at **Delivery** (E3) and **Edit Order**, alongside existing Pickup and Order Details.

### D-B36-5 — Implement `fin_release_eligible` *(decision required — highest control value)*
Replace the stub with a real check: block release while `outstanding_amount > tolerance`, unless an explicit, permissioned override is recorded.

**Gate and remedy must ship together.** A gate alone strands staff at handover with no on-screen resolution — they will escalate or route around it, and a control people route around is not a control. The remedy alone is optional and gets forgotten under counter pressure. Together: the transition is blocked *and* one click resolves it.

⚠️ **Risk:** the gate lives in Workflow Engine V2, which is **off by default**. Either this rides the V2 rollout or an equivalent check is needed on the legacy path. **Decide before implementation** — it changes sequencing materially.

---

## Scope
1. `collectibleAmount` on the order financial view-model (+ eligibility policy function)
2. Shared collection core; `collectPaymentTx` refactored to call it
3. Collect modal wired at Delivery + Edit Order; existing call sites migrated off `isPoc`
4. Prior-payment context in the collect modal
5. `fin_release_eligible` implemented, paired with on-screen collect
6. Order-level receivables **worklist** — copy B30's `internal_fin/pending-payments` pattern (table conventions, access contract, `orders:collect_payment`)
7. Settlement recorded against `editHistoryId` via B12's **existing** endpoint
8. Idempotency on the collection write (`claimIdempotencyKey`, available from B28)

## Out of scope
- **Customer-level multi-order allocation → B24** (NOT_STARTED, hard-blocked on B6). Building it ad-hoc would create a second allocation mechanism.
- **Edit-path charge facts → B37.**
- `CREDIT_INVOICE` orders (settle via AR-invoice flow), gateway work (B8), refund execution (B9), installment plans.
- Backfilling the 2 stranded `PAY_IN_ADVANCE` balances — flag separately once the mechanism exists.
- Structured amendment reason codes (collect-vs-waive policy) — recorded as a follow-up; needs its own decision on the code set.

---

## Financial effects
| Area | Impact |
|---|---|
| Order totals | NO — settles a total already computed by B12 |
| Payments ledger / BVM / drawer / GL / snapshot | YES — same shape as intake collection, via the shared core |
| Release control | YES — orders can no longer be handed over with an unpaid balance (D-B36-5) |

## Acceptance criteria
1. Collection works on any order with `collectibleAmount > 0`, from Order Details, Pickup, Delivery, and Edit Order.
2. No UI file contains `isPoc` collection logic; all read `collectibleAmount`.
3. Prefilled amount is server-derived and cannot exceed outstanding (except the explicit overpay path).
4. Release is blocked while a balance is outstanding, with collect available on the same screen.
5. Receivables worklist lists every order with `collectibleAmount > 0`.
6. Settlement flips `payment_adjusted` on the originating `editHistoryId`.
7. Concurrent duplicate submission settles exactly once.
8. **`PAY_ON_COLLECTION` behaviour is byte-identical to today** (regression-proven).

## Required tests
Unit (eligibility policy incl. each ineligible reason; tolerance boundary; permission fail-closed) · integration (collect → voucher → drawer → snapshot) · **DB-integration** (real concurrent double-collect settles once — reuse the B28 `*.db.test.ts` pattern) · regression (full existing `PAY_ON_COLLECTION` suite unchanged) · API (auth/CSRF/validation) · UI (button visibility across payment types × outstanding).

## Dependencies and sequencing
**Recommended: do not start until the current IMPLEMENTED batch reaches VERIFIED.** 29 packages are awaiting Preview QA; adding a program of this size first enlarges an already-large unverified batch and delays B13/B23/B24/B25.

Suggested internal order once started: (1) `collectibleAmount` + eligibility → (2) shared core + `collectPaymentTx` refactor *(riskiest — review gate)* → (3) call sites incl. Delivery + Edit Order → (4) worklist → (5) release gate *(after the V2 dependency is decided)*.

No migration identified; `orders:collect_payment` already exists (B27). If implementation reveals a schema need, it follows the normal author-then-STOP protocol.

---

## Delivery surfaces
Backend services: shared collection core; `collectPaymentTx` refactored to caller; eligibility policy function; `fin_release_eligible` evaluator; reuse `executeOverpaymentDispositionTx` for negative delta
Database/schema: none identified — no migration expected
API/endpoints: `POST /api/v1/orders/[id]/collect-payment` (extended); existing `POST .../edit-history/[id]/settlement`; worklist read endpoint
Frontend: Order Details panel · Pickup (`ready/[id]`) · **Delivery (new)** · **Edit Order (new)** · **receivables worklist (new)**
Reusable components: `OrderCollectPaymentModal` (existing — reused, not rebuilt); B30 worklist table pattern
Permissions: `orders:collect_payment` (existing, B27); release-override permission **required decision** if D-B36-5 allows override
Validation: `collectibleAmount > tolerance`; amount ≤ collectible; POS session + open drawer for CASH
i18n/RTL: new action/confirmation/ineligibility-reason strings, EN + AR aligned
Accessibility: existing Cmx dialog patterns — focus trap, labelled money inputs, keyboard-reachable
Audit trail: payment row + BVM voucher + `payment_adjusted` on edit history + outbox event
Observability: `PAYMENT_RECEIVED` outbox; existing reconciliation checks
Jobs/workers: none
Feature flag: Edit Order surface rides `order_fin_governed_amendments`; **the eligibility fix and Delivery wiring are bug fixes and should NOT be flagged**; the release gate needs its own flag for staged rollout
Rollout: eligibility+core → call sites → worklist → release gate (last, most behavioural)
Rollback: revert gate to `isPoc`; unwire new call sites; disable release-gate flag. No data migration to unwind.

## End-to-end operational flow
Operator edits a paid order (any of the 4 editable statuses) → B12 records reason, delta, `editHistoryId`, recalculates `outstanding_amount` → **(new)** if the customer is present, Collect is offered inline, prefilled from `collectibleAmount`; if absent, the balance becomes a visible receivable on the worklist → at pickup or delivery the release gate blocks handover while a balance remains, with Collect available on that same screen → collection writes payment + voucher + drawer movement + snapshot + GL dispatch + outbox in one transaction, and records settlement against `editHistoryId` → goods release. On failure nothing partially commits; the amendment stays recorded and settleable later.

## Safety
UI design allowed: **yes** · UI implementation allowed: **only after D-B36-1/2 approved** (the UI cannot function before the mechanism exists) · Production activation allowed: **no** — requires Preview QA + recorded owner approval
Required backend gates: shared core implemented and tested · `PAY_ON_COLLECTION` regression suite green · concurrent double-collect proven safe · V2-dependency decision recorded before the release gate ships

## Completion evidence
Migration: n/a · Implementation files: none — **no code written** · Tests: none yet
Commit: — · Preview QA: — · Reviewer: — · **Approved decision: NOT YET APPROVED**
