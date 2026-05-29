# BVM Wiring Phase 3 — Implementation Log

**Date:** 2026-05-29
**Status:** ✅ Shipped (Scope B = AR Invoice canonical writer + Gift-card-as-voucher-line)
**Predecessor commit:** `13f8872` (Phase 2 close). Working HEAD at start: `475f754`.
**Plan source:** `C:\Users\JHNLP\.claude\plans\vivid-wishing-wave.md` (working scratch — to be archived alongside this implementation doc per the user's "plans live in the feature folder" preference).

---

## Overview

Phase 3 closed two related changes in a single session:

| Change | Effect |
|---|---|
| **1. AR Invoice canonical writer migration** | Replaced the deprecated `createInvoice` adapter call in `order-submit-orchestrator.service.ts` with `createArInvoiceFromOrders`. Threaded `tx?` through the writer so it joins the order/voucher transaction atomically. Preserved legacy parity (OPEN-with-ledger-debit + ERP-lite auto-post dispatch) via a new `issueImmediately` flag. |
| **2. Gift-card-by-id as ORDER_CREDIT_APPLICATION voucher line** | Closed the Phase 2.1 deferred item. Gift-card debit moved out of TX1 (orchestrator's order-creation tx) into TX2 (the voucher tx) by synthesising a credit-application leg before `buildSettlementPlan`. The voucher line + stored-value debit now carry `fin_voucher_id` + `fin_voucher_trx_line_id` backlinks atomically — same pattern as wallet / advance / credit-note / loyalty. |
| **3. Breakdown snapshot math fix** | `breakdown.creditsTotal`/`netReceivable`/`outstanding` now use `plan.creditAppliedAmount` + `plan.realPaymentAmount` instead of `serverTotals.giftCardApplied` + `amountToCharge` — corrects under-counting when wallet/advance legs are in play. |

No DB migration shipped — Step 0 discovery confirmed every column the new writer needs already exists.

---

## Requirements

- [x] CREDIT_INVOICE orders produce one canonical AR invoice row at submit time, atomic with the order header
- [x] AR invoice replay (same `${orderId}_ar` idempotency key) collapses to the existing row — no duplicates
- [x] Non-credit orders (cash / card / gateway / PAY_ON_COLLECTION) do NOT produce an AR invoice row
- [x] Gift-card-by-id produces a `LINE_ROLE.ORDER_CREDIT_APPLICATION` voucher line with `credit_application_type = GIFT_CARD`
- [x] Gift-card stored-value ledger row carries `fin_voucher_id` + `fin_voucher_trx_line_id` backlinks (migration 0329 FKs)
- [x] Breakdown snapshot reflects ALL credit-application legs, not just gift-card
- [x] ERP-lite auto-post dispatch parity preserved (BLOCKING policy still blocks)
- [x] `npx tsc --noEmit` filtered = 0 errors; Phase 2 baseline 69/69 still green; Phase 3 adds 8 new test cases (77/77 total)
- [x] `npm run build` succeeds

---

## Database Schema

**No migration.** Step 0 discovery via Supabase MCP confirmed every column already exists:

| Column | Type | Source |
|---|---|---|
| `org_invoice_mst.id` | uuid NOT NULL | existing |
| `org_invoice_mst.order_id` | uuid NULL | existing |
| `org_invoice_mst.tenant_org_id` | uuid NOT NULL | existing |
| `org_invoice_mst.invoice_no` | text NOT NULL | existing |
| `org_invoice_mst.total / outstanding_amount` | numeric | existing |
| `org_invoice_mst.status` | text | existing |
| `org_invoice_mst.invoice_date / due_date` | date | existing |
| `org_invoice_mst.issued_at / issued_by` | timestamptz / varchar | existing |
| `org_invoice_mst.gift_card_id / gift_card_applied_amount` | uuid / numeric | existing |
| `org_invoice_mst.customer_id / currency_code` | uuid / varchar | existing |

`SELECT COUNT(*) FROM org_invoice_mst WHERE status='DRAFT' AND order_id IS NOT NULL` → 0 in-flight DRAFTs at time of shipping (safe to flip submit-order to `issueImmediately: true`).

`org_payment_methods_cf` confirmed: 2 tenant rows with `payment_method_code='GIFT_CARD', credit_application_type='GIFT_CARD', payment_nature='CREDIT_APPLICATION'`, all active. Gift-card synthesis path is operational without seed migration.

**Note:** `org_orders_mst` has NO `invoice_id` column. The resume doc's "backlink to org_orders_mst.invoice_id" instruction was wrong — linkage is unidirectional via `org_invoice_mst.order_id` (already populated by the canonical writer). The spurious update was removed before commit.

---

## API Endpoints

**No new routes.** `POST /api/v1/orders/submit-order` (existing) now uses the canonical AR writer internally; request/response contracts unchanged.

`POST /api/v1/ar/invoices/from-orders` (existing) unaffected — when `issueImmediately` is omitted the writer preserves legacy DRAFT behavior.

---

## UI Components

**No UI changes in Phase 3.** Payment-modal-v4 work continues in parallel (Phase 6).

---

## Business Logic

### Submit-order flow after Phase 3

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Pre-flight: pricing, payment-method config resolution, settlement plan   │
│  └── Step 4: synthesize gift-card credit-app leg if input.giftCardId set │
│  └── buildSettlementPlan (planner classifies gift-card via lock-order)   │
├──────────────────────────────────────────────────────────────────────────┤
│ TX1 (order-creation tx)                                                  │
│  ├── OrderService.createOrderInTransaction                               │
│  ├── if shouldCreateArInvoice (= CREDIT_INVOICE):                        │
│  │     createArInvoiceFromOrders({ …, issueImmediately:true,             │
│  │       idempotency_key:'${orderId}_ar' }, …, tx)                       │
│  │     → org_invoice_mst (status OPEN)                                   │
│  │     → ErpLiteAutoPostService.dispatchInvoiceCreatedInTransaction      │
│  │     → org_invoice_lines_dtl, org_invoice_orders_dtl                   │
│  │     → org_invoice_status_history_dtl (CREATE_FROM_ORDERS_ISSUED)      │
│  │     → org_customer_ar_ledger_dtl (INVOICE_ISSUED DEBIT)               │
│  │     → AR_INVOICE_ISSUED outbox event                                  │
│  ├── if input.promoCodeId: applyPromoCodeTx                              │
│  └── (Phase 3 removed: gift-card debit moved to TX2)                     │
├──────────────────────────────────────────────────────────────────────────┤
│ TX2 (voucher tx) — Phase 2 atomicity preserved                           │
│  ├── createBizVoucher                                                    │
│  ├── for leg in plan.realPaymentLegs: addVoucherLine                     │
│  ├── for leg in plan.creditApplicationLegs (now includes GIFT_CARD):     │
│  │     addVoucherLine(LINE_ROLE.ORDER_CREDIT_APPLICATION)                │
│  │     applyStoredValueDebitTx(creditType, voucherId, voucherLineId, …)  │
│  │       → redeemGiftCardTx (for GIFT_CARD), redeemWalletTx (WALLET), …  │
│  └── postAndWireBizVoucher                                               │
├──────────────────────────────────────────────────────────────────────────┤
│ TX3 (settle): settleOrder with breakdown using plan.creditAppliedAmount  │
│  + plan.realPaymentAmount (Step 6 math fix)                              │
├──────────────────────────────────────────────────────────────────────────┤
│ TX4 (AR allocation): for each immediate paid leg, allocateArPaymentTx    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Idempotency contracts

| Key | Owner | Purpose |
|---|---|---|
| `${orderId}_ar` | `createArInvoiceFromOrders` via `withIdempotency` | Replay-safe AR invoice creation. 24h TTL. |
| `${orderId}_vch`, `${orderId}_vch_post` | Phase 2 voucher header + post | Pre-existing; unchanged |
| `${orderId}_sv_gc_${legIndex}` | TX2 dispatcher → `redeemGiftCardTx` | Replay-safe gift-card debit. `${legIndex}` typically 0 since gift-card lands as the first credit-app leg by STORED_VALUE_LOCK_ORDER. |
| `${orderId}_sv_w / _a / _cn / _lp_${legIndex}` | TX2 dispatcher → other redeem*Tx | Pre-existing; unchanged |

### Breakdown math (post-Phase-3)

```
creditsTotal     = plan.creditAppliedAmount      ← gift + wallet + advance + cn + loyalty
netReceivable    = serverTotals.finalTotal - plan.creditAppliedAmount
outstanding      = max(0, serverTotals.finalTotal - plan.creditAppliedAmount - plan.realPaymentAmount)
paymentLegsTotal = amountToCharge                ← unchanged; still filters by DEFERRED_METHODS
```

The shift from `amountToCharge` → `plan.realPaymentAmount` in the `outstanding` formula closes the latent under-counting bug where wallet/advance legs arriving through `paymentLegs` would have been subtracted by BOTH `creditsTotal` AND `amountToCharge`.

---

## Testing

| Test ID | File | Scenario |
|---|---|---|
| T-AR-1 | `__tests__/services/ar-invoice.service.test.ts` | `issueImmediately:true` → status OPEN, AR ledger DEBIT INVOICE_ISSUED, AR_INVOICE_ISSUED outbox, ERP-lite dispatched, status_history `CREATE_FROM_ORDERS_ISSUED` |
| T-AR-2 | same | default (no `issueImmediately`) → status DRAFT, no ledger debit, no AR_INVOICE_ISSUED outbox; ERP-lite still dispatched on create |
| T-AR-3 | same | `gift_card_applied_amount` input mirrors onto invoice header; `gift_card_id` taken from source order |
| T-AR-4 | same | ERP-lite BLOCKING policy + failed execute → throws and aborts invoice creation |
| T-AR-5 | same | caller-supplied `tx` bypasses outer `prisma.$transaction` wrapper (atomic-with-order invariant) |
| T-PLN-1 | `__tests__/services/order-settlement-planner.service.test.ts` | orchestrator-synthesized gift-card leg without paymentLegs counterpart classifies correctly with `creditReferenceId` preserved |
| T-PLN-2 | same | mixed cash + wallet + gift-card → `plan.creditAppliedAmount` sums both credit-apps; STORED_VALUE_LOCK_ORDER ranks gift-card first |
| Pre-existing | Phase 2 sweep (6 suites, 69 tests) | All green — no regression |

**Total: 77/77 pass.** Plus `gift-card-service.test.ts` 40/40 (service-level untouched).

### Acceptance scenarios for manual QA

1. **B2B customer, CREDIT_INVOICE, mixed cash + gift-card** → AR invoice OPEN at submit; voucher posted; gift-card appears as ORDER_CREDIT_APPLICATION line on the voucher; AR allocation credits the cash payment against the invoice.
2. **Same submit replayed (same idempotency hash)** → no duplicate AR invoice; no duplicate gift-card debit; voucher idempotency unchanged.
3. **Cash retail customer with gift-card** → no AR invoice; gift-card produces a voucher CREDIT_APPLICATION line; gift-card balance debited once; settlement order in voucher follows STORED_VALUE_LOCK_ORDER.
4. **Cash retail customer no gift-card** (sanity) → no AR invoice, no credit-application legs, voucher contains only real-payment lines.
5. **CREDIT_INVOICE with wallet + gift-card** → both produce credit-application voucher lines; AR invoice covers the unpaid remainder; `breakdown.creditsTotal` = wallet + gift-card sum.

---

## Implementation Status

- [x] Database schema — no migration needed (Step 1 skipped)
- [x] Backend service — `createArInvoiceFromOrders` extended; orchestrator rewired
- [x] API contract — preserved (no client-visible changes)
- [x] Frontend UI — no Phase 3 UI changes
- [x] Tests — +8 cases; 77/77 pass; gift-card-service 40/40 unchanged
- [x] Build gate — `npm run build` succeeds
- [x] Documentation — IMPLEMENTATION_STATUS, CHANGELOG, this file
- [x] User commit prep — pending user `DD_MM_YYYY_N` prefix commit

---

## Feature Implementation Requirements

### Permissions
- **None added.** Existing `invoices:read` / `orders:create` / `orders:read` continue to apply. AR invoice creation is internal to the submit-order flow — not a separate permission-gated action.

### Navigation Tree
- **None changed.**

### Tenant Settings
- **None added.** The tenant's existing GIFT_CARD `org_payment_methods_cf` row drives behavior. Step 0 confirmed both production tenants already have it.

### Feature Flags
- **None.** Phase 3 is a hard cut — every CREDIT_INVOICE submit now uses the canonical writer; every gift-card submit now routes through the voucher tx.

### Plan Limits
- **None changed.**

### i18n Keys
- **None added.** `GIFT_CARD_PAYMENT_METHOD_NOT_CONFIGURED` is an internal Error code surfaced as a generic 500; not user-displayed (operator config error).

### API Routes
- **None added or modified at the route layer.**

### Migrations
- **None.** Discovery confirmed the schema is complete.

### Constants & Types
- **`createArInvoiceFromOrdersSchema`** extended (`web-admin/lib/validations/ar-invoice-schemas.ts:82-102`): `issueImmediately?: boolean`, `gift_card_applied_amount?: number`.
- **`CreateArInvoiceFromOrdersInput`** type auto-updates via `z.infer`.
- **`createArInvoiceFromOrders` signature** (`web-admin/lib/services/ar-invoice.service.ts`): now `(input, actor = {}, tx?: PrismaTx)`.
- New internal helper `createArInvoiceFromOrdersInTx` (not exported) for the in-tx producer.
- Locally-copied `assertBlockingInvoiceAutoPostSucceeded` helper — Phase 6 cleanup will extract a shared util.

### Environment Variables
- **None added.**

### Dependencies
- **None added.** All new imports (`ErpLiteAutoPostService`, `ERP_LITE_BLOCKING_MODES`, `PAYMENT_NATURE`) come from existing modules.

### Logging
- AR_INVOICE_ISSUED outbox event now fires on every CREDIT_INVOICE submit (previously only on the DRAFT → ISSUE transition). Downstream consumers must tolerate the timing shift — they already handle async issuance.

### Metrics
- None added.

---

## Risks & Mitigations

| Risk | Status | Mitigation |
|---|---|---|
| Breakdown math change drifts snapshot for in-flight CREDIT_INVOICE orders | low | `settleOrder` re-derives outstanding from fact rows; only the snapshot column moves; T-PLN-2 covers |
| `amountToCharge` double-subtraction in outstanding formula | closed | Step 6 uses `plan.realPaymentAmount` |
| ERP-lite BLOCKING policy gate broken | closed | T-AR-4 exercises the failure path |
| Synthetic gift-card leg overshoots order total | very low | `order-calculation.service.ts` caps `giftCardApplied ≤ amountBeforeGiftCard`; planner sums to `plan.immediateSettlementAmount` |
| Missing tenant D9 GIFT_CARD row | mitigated | Throws `GIFT_CARD_PAYMENT_METHOD_NOT_CONFIGURED` — operator setup signal, no silent fallback |
| Legacy `giftCardNumber` (string-only) path broken | low | Not in current request schema; grep confirmed no caller; if reintroduced, Step 5 comment block explains where the resolver belongs |
| `createInvoice` lingers as dead code | tracked | Marked for Phase 6 retirement; still required for `createInvoiceAction` |
| Duplicated `assertBlockingInvoiceAutoPostSucceeded` | tracked | Phase 6 cleanup — extract to `lib/services/erp-lite-auto-post.util.ts` |

---

## Rollback Strategy

Phase 3 ships no migration, so revert is purely code:

```
git revert <phase-3-commit>
```

- `${orderId}_ar` keys in `org_idempotency_keys` auto-expire (24h TTL) — no orphaned reservations.
- New-writer AR invoices are indistinguishable from legacy ones in `org_invoice_mst` shape (status, ledger, history) — no reporting breakage.
- Snapshot `outstanding_amount` reverts to legacy formula on next settlement recomputation; AR fact rows remain authoritative.
- Steps 2/3/4 each revert independently; Step 5 (TX1 gift-card deletion) is the only "load-bearing" deletion — must revert alongside Step 4 if rolling back the gift-card change while keeping the AR writer migration.

---

## Follow-ups (Phase 6 candidates)

1. Retire `createInvoice` from `invoice-service.ts` once `createInvoiceAction` (`app/actions/payments/invoice-actions.ts:38`) migrates to the canonical writer.
2. Extract `assertBlockingInvoiceAutoPostSucceeded` into `lib/services/erp-lite-auto-post.util.ts` (currently duplicated between `invoice-service.ts:868-894` and `ar-invoice.service.ts`).
3. Hoist the local `STORED_VALUE_CODE` map (`order-submit-orchestrator.service.ts:88-94`) into `lib/constants/order-financial.ts` so it's reusable by any service that builds Phase-2-style sub-idempotency keys.

---

## References

- Phase 2 implementation log: `bvm_wiring_phase2_implementation.md`
- AR Invoice scope ADR: `../AR_Invoice/ADR_ar_invoice_is_receivable_only.md`
- Resume doc (predecessor): `C:\Users\JHNLP\.claude\plans\bvm-phase-3-to-6-RESUME.md`
- Working plan: `C:\Users\JHNLP\.claude\plans\vivid-wishing-wave.md`
- PRD: `CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md` §20.3
