# BVM Wiring Phase 2 — Entry Plan

**Created:** 2026-05-28
**Status:** Draft — ready for review before next session
**Predecessor:** BVM Phase 1B + 2026-05-28 Stabilization (see `IMPLEMENTATION_STATUS.md`)

---

## Context

Phase 1A (2026-05-22) shipped the BVM wiring layer: posting a voucher atomically writes operational fact rows in `org_order_payments_dtl`, `org_order_credit_apps_dtl`, and `org_cash_drawer_movements_dtl` in a single DB transaction.

Phase 1B (2026-05-23) shipped the canonical `submit-order` orchestrator that creates a receipt voucher, wires it, and runs `settleOrder({ wiringMode: true })` to skip the legacy direct-write of payment fact rows. The orchestrator runs **four separate transactions**:

```
tx1: order + (AR invoice if credit) + promo + gift card
tx2: createBizVoucher + addVoucherLine × N + postAndWireBizVoucher
tx3: settleOrder (charges, taxes, discounts, stored-value debits, snapshot, outbox)
tx4: AR allocation (only when result.invoiceId is set)
```

**Key invariant deferred from Phase 1B:** stored-value redemptions (wallet, advance, credit-note, loyalty, gift-card) live in tx3 (`settleOrder`) — NOT in tx2 (the voucher transaction). If tx3 fails after tx2 commits, voucher fact rows exist but stored-value balances were not debited. This is acceptable for Phase 1B because:
1. `addVoucherLine` writes the `org_fin_voucher_trx_lines_dtl` row with `line_role = ORDER_CREDIT_APPLICATION`
2. `settleOrder(wiringMode: true)` skips the direct-write of `org_order_credit_apps_dtl` (BVM wiring already wrote it)
3. But `settleOrder` STILL runs `redeemWalletTx` / `redeemAdvanceTx` / etc. to debit the actual balance

The gap: if tx3 fails after tx2 succeeds, the order shows a credit application leg but the wallet was never debited. The system relies on the small window (<200ms typical) and manual reconciliation to detect drift.

Phase 2 closes this gap by consolidating stored-value debits into the voucher transaction.

---

## Phase 2 Scope

### Primary goal

**Consolidate stored-value debits into the voucher transaction (tx2) so balance debits + voucher line + payment fact rows succeed or fail atomically.**

### Secondary goals (bundled because they share the surface)

1. **B4 — `creditReferenceId` plumbing** (deferred from Phase 1B stabilization)
   - Add `creditReferenceId`, `loyaltyAccountId`, `customerAdvanceId` to `PaymentLeg` validation schema
   - Thread through planner → orchestrator → wiring handler
   - Add validation: `creditType === CUSTOMER_CREDIT` requires `creditReferenceId`; otherwise throw `CUSTOMER_CREDIT_REFERENCE_REQUIRED`

2. **Idempotency parity across stored-value redemption services**
   - `redeemAdvanceTx` — currently has NO idempotency parameter. Add `idempotencyKey?: string`, pre-check `org_advance_txn_dtl(tenant_org_id, idempotency_key)` before debit (mirror `redeemGiftCardTx` pattern), return `{ skipped: true }` on duplicate
   - `redeemCreditNoteTx` — same gap; same fix
   - `redeemWalletTx` — has idempotencyKey but only stores it on the ledger row; relies on DB unique constraint to throw on duplicate. Upgrade to pre-check + skip
   - `redeemPointsTx` (`loyalty.service.ts`) — same as wallet; upgrade to pre-check + skip
   - DB uniqueness already exists on all 5 ledger tables (`uq_*_txn_idempotency`) per audit F15 — no migration needed

3. **Deterministic lock ordering**
   - Add `STORED_VALUE_LOCK_ORDER` constant in `lib/constants/order-financial.ts`:
     ```typescript
     export const STORED_VALUE_LOCK_ORDER = [
       'GIFT_CARD',
       'WALLET',
       'CUSTOMER_ADVANCE',
       'CUSTOMER_CREDIT',
       'LOYALTY_CREDIT',
     ] as const;
     ```
   - Sort credit-application legs by this order before iterating in the wiring handler
   - Document in JSDoc: any future redemption-from-refund path that touches the same rows MUST use the same lock order

4. **Outbox 4-tx → 1-tx merge**
   - Merge tx2 + tx3 (and ideally tx1) into a single `prisma.$transaction` so outbox events for voucher-posted, order-completed, and loyalty-earn all commit atomically with their state changes
   - Keeps tx4 (AR allocation) separate because it's only relevant when an AR invoice was created and is naturally a downstream concern
   - Requires `withTenantContext` propagation through the consolidated transaction

5. **Phase 2 implementation doc + ADR**
   - `docs/features/Order_Fin/bvm_wiring_phase2_implementation.md` — outcomes
   - `docs/features/Order_Fin/ADR_voucher_transaction_owns_stored_value.md` — architectural contract

---

## Files affected (planned)

### New
- `web-admin/lib/services/wiring/stored-value-redemption-wiring.handler.ts` — new wiring handler that inlines stored-value debits inside the voucher tx
- `docs/features/Order_Fin/bvm_wiring_phase2_implementation.md`
- `docs/features/Order_Fin/ADR_voucher_transaction_owns_stored_value.md`

### Modified
- `web-admin/lib/services/voucher-wiring.service.ts` — register the new handler in `WIRING_HANDLERS`, ensure lock order
- `web-admin/lib/services/voucher-line.service.ts` — accept `creditReferenceId` / `loyaltyAccountId` / `customerAdvanceId` on `CreateVoucherLineInput`
- `web-admin/lib/services/stored-value.service.ts` — add `idempotencyKey` to `redeemAdvanceTx` and `redeemCreditNoteTx`; pre-check pattern for all redemption functions
- `web-admin/lib/services/loyalty.service.ts` — pre-check pattern for `redeemPointsTx`
- `web-admin/lib/services/order-settlement.service.ts` — REMOVE the `redeem*Tx` calls (they move into the wiring handler); `wiringMode: true` now skips stored-value debits too
- `web-admin/lib/services/order-settlement-planner.service.ts` — accept and validate `creditReferenceId`
- `web-admin/lib/validations/new-order-payment-schemas.ts` — extend `PaymentLeg` schema with reference fields
- `web-admin/lib/constants/order-financial.ts` — add `STORED_VALUE_LOCK_ORDER`
- `web-admin/lib/services/order-submit-orchestrator.service.ts` — merge tx2 + tx3 (orchestrator transactions)
- `web-admin/__tests__/services/` — new concurrency tests for each redemption function (model on existing `__tests__/integration/gift-card-redemption.test.ts`)
- `web-admin/__tests__/services/voucher-wiring.service.test.ts` — new file covering the consolidated transaction
- `web-admin/__tests__/services/order-submit-orchestrator.service.test.ts` — orchestration test covering tx2/tx3 merge + 6 typed error paths

### NOT changed (defer further)
- Orchestrator tx1 (order + invoice + promo + gift-card-in-tx1) — Phase 3 candidate; merging tx1 with tx2 would couple order creation to voucher creation which is a larger architectural decision
- AR allocation tx4 — naturally a different concern (only runs when invoice exists)
- Tax Documents Module — separate dedicated PRD

---

## Schema changes

**None expected.** All required uniqueness constraints already exist (`uq_wallet_txn_idempotency`, `uq_advance_txn_idempotency`, `uq_cn_txn_idempotency`, `uq_loyalty_txn_idempotency`, `uq_gc_txn_idem`).

If the lock-ordering constant uncovers a missing index on a balance column (e.g. `org_credit_notes_mst(customer_id, status)`), a migration may be added during impl. Verify during Step 0 of Phase 2 implementation.

---

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Merging tx2 + tx3 inflates transaction duration and triggers row-lock contention | Medium | Medium | Keep AR allocation in tx4; ensure stored-value SELECT FOR UPDATE order matches lock constant; benchmark before/after |
| `redeemAdvanceTx` / `redeemCreditNoteTx` idempotency change is a signature break | Low | Low | Both currently have no idempotency param; adding optional param is non-breaking |
| Removing stored-value debits from `settleOrder` could break legacy callers that pass `wiringMode: false` | Medium | High | Audit every caller of `settleOrder(wiringMode: false)`; ensure Phase 1B is the only producer left; if any legacy caller remains, gate the move on a feature flag |
| Outbox event timing changes break downstream consumers | Low | Medium | Verify consumers tolerate batched event commits (they should — outbox is async by design) |
| Tax Documents Module dependency surfaces unexpectedly | Low | Low | Already deferred; voucher receipt covers GCC Simplified Tax Invoice until that module ships |

---

## Acceptance criteria

1. ✅ Submit-order with mixed CASH + WALLET payment: voucher tx commits voucher header, voucher lines, AND wallet debit atomically. If wallet has insufficient balance, the whole transaction rolls back — no voucher created, no order in PAID state.
2. ✅ Forced failure mid-redemption (e.g. simulated lock timeout on `org_loyalty_accounts_mst`): the voucher transaction rolls back. `org_orders_mst` shows no payment; stored-value balances unchanged; outbox emits no event.
3. ✅ Idempotency replay: same order, same key, same body → second voucher post is a no-op (skipped via pre-check on every redemption ledger).
4. ✅ Multi-balance order (gift-card + wallet + loyalty in one submit): locks taken in the order specified by `STORED_VALUE_LOCK_ORDER` regardless of caller leg ordering.

---

## UI debt carried into Phase 2 (added 2026-05-28 Round 2 Stabilization)

These were uncovered by manual QA Step 8 of the Phase 1B stabilization. Code fixes for the backend bugs landed in Round 2; the UI work below remains pending for Phase 2.

| Item | Symptom | Phase 2 task |
|---|---|---|
| Payment Modal v4 — WALLET method missing | Scenario 4 (multi-leg CASH+WALLET) can't be exercised from UI | Add WALLET leg builder to `payment-modal-v4.tsx`; wire to stored-value balance lookup |
| Payment Modal v4 — CHECK silent submit-block | Scenario 6: submit button silently disabled with no validation message when `checkNumber` is missing | Surface `CHECK_NUMBER_REQUIRED` validation in modal footer instead of disabling button |
| Payment Modal v4 — HYPERPAY/gateway silent submit-block | Scenario 8: submit button silently disabled on gateway methods | Implement gateway-initiation flow or show "Gateway not yet supported in admin" message |
| Payment Method settings UI — 4 D9 toggles missing | `allow_status_override`, `default_creation_status`, `is_user_id_required`, `allow_outside_integration` cannot be edited per tenant | Add toggles + select to the Payment Method settings form; null = inherit sys |
| Payment Method settings UI — `currency_code` per-method | Save requires `currency_code` on every method row; should be tenant-level | Move `currency_code` to tenant settings; remove from per-method form |
| Status-override paymentStatus field | `allow_status_override` flag exists in DB but planner ignores override because `paymentLegSchema` has no `paymentStatus` field | Add `paymentStatus` optional field to `paymentLegSchema` + honor in planner when `allow_status_override = true` |
| **Verify-payment path** (PENDING → COMPLETED) | After a BANK_TRANSFER / CHECK / gateway-PENDING submit, the payment row sits in `payment_status='PENDING'`. The recalc service excludes non-COMPLETED payments, so the order stays UNPAID with full outstanding. No endpoint or UI currently exists to confirm the payment once the bank/clearing house releases funds. Identified during 2026-05-28 Round 2 manual QA. | Add `POST /api/v1/orders/[id]/payments/[paymentId]/verify` (permission: `orders:verify_payment`). Service: `verifyOrderPayment(orderId, paymentId, tenantId, userId)` that updates `payment_status`, runs `recalcOrderSnapshotIfLinked`, audits the verification, emits an outbox event. UI: "Verify" button on order payments tab when status=PENDING. Also support batch verify (multi-select rows + bulk action) and partial verification (split a PENDING row before flipping). |

---

## Schema debt carried into Phase 2 (added 2026-05-28 Round 2 Stabilization)

| Item | Notes | Phase 2 task |
|---|---|---|
| Voucher status triple-column cleanup | `org_fin_vouchers_mst` has `status` (legacy lowercase), `voucher_status` (Phase-1A uppercase), `posting_status` (wiring). All three are now code-synced (B8 fix), but the redundancy remains. | Audit every read of `status` (legacy); migrate readers to `voucher_status`; then DROP the legacy column. Same for `posting_status` if no consumer remains. |
| `org_payment_methods_cf` D9 NULL semantics | Migration 0328 made `requires_cash_drawer` + `requires_reference` nullable. Service layer correctly falls back to sys. Other D9 columns (`default_creation_status`, `allow_status_override`, `is_user_id_required`, `allow_outside_integration`) are already nullable. | Add a `pg_check` or migration assertion that every nullable D9 column is read with sys fallback in the service. |

5. ✅ CUSTOMER_CREDIT redemption without `creditReferenceId` → `CUSTOMER_CREDIT_REFERENCE_REQUIRED` thrown at planner validation; no voucher created.
6. ✅ All concurrency tests green (model on `__tests__/integration/gift-card-redemption.test.ts`).
7. ✅ Build green, all existing tests still green.

---

## Estimated effort

- Stored-value idempotency parity + pre-check pattern: ~4 hours
- New wiring handler + lock ordering: ~3 hours
- `creditReferenceId` plumbing (B4): ~2 hours
- Tx2 + tx3 merge in orchestrator: ~4 hours
- Concurrency tests (5 tests, one per redemption function): ~3 hours
- ADR + impl doc: ~2 hours
- Manual smoke + integration verification: ~2 hours

**Total: ~20 hours** (2-3 working days)

---

## Out of scope (carry forward to Phase 3+)

- **Phase 3:** AR Invoice creation via `createArInvoiceFromOrders()` for true B2B CREDIT_INVOICE flow (currently the orchestrator's `createInvoice` is gated on shouldCreateArInvoice but doesn't use the AR-specific creator)
- **Phase 4:** Order-reconciliation service (`order-reconciliation.service.ts`) that scans for drift between orders and their linked vouchers
- **Phase 5:** History/audit tables that don't already exist (`org_order_status_history` etc.)
- **Tax Documents Module** (separate PRD)
- **ZATCA Phase 2 compliance** (separate PRD)
- **Voucher print template hardening for GCC tax invoice compliance** (separate task)

---

## Open questions for kickoff

1. **Tx merge scope** — merge ONLY tx2 + tx3 (recommended), or also bring tx1 into the consolidated transaction? Bringing tx1 in tightens atomicity but couples order creation lifecycle to voucher creation (which has implications for invoice-only orders that need no voucher).
2. **Stored-value debits in `wiringMode: false` mode** — when (if ever) is `settleOrder({ wiringMode: false })` still called? If never, we can remove the debits from `settleOrder` entirely. If still called, we need a feature flag or compat path.
3. **Lock ordering enforcement** — should `STORED_VALUE_LOCK_ORDER` be enforced via Zod sort on planner output, or via a runtime assertion in the wiring handler? Both work; one is type-time, one is runtime.

---

## Entry checklist

When ready to start Phase 2:
- [ ] Confirm Phase 1B Stabilization is fully reviewed and accepted (see `IMPLEMENTATION_STATUS.md`)
- [ ] Re-run typecheck + test baseline to confirm green starting point
- [ ] Open Phase 2 plan as separate `.claude/plans/bvm-wiring-phase2-*.md`
- [ ] Answer the 3 open questions above
- [ ] Verify no DB rows currently have `credit_application_type IS NULL` on `org_payment_methods_cf` (planner now throws — would have been masked by old fallback)
