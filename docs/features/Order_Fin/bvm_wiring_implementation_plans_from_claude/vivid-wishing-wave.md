# Plan — BVM Wiring Phase 3 (Scope B: AR Invoice canonical writer + Gift-card-as-voucher-line)

**User preference noted:** future planning docs should live in `docs/features/<feature>/` (e.g. `docs/features/Order_Fin/`). To be saved to memory after `ExitPlanMode`. Final per-phase implementation doc (`bvm_wiring_phase3_implementation.md`) is already destined for `docs/features/Order_Fin/` per the resume doc.

---

## Context

Phase 2 of BVM Wiring closed 2026-05-28 (commit `13f8872`; HEAD currently `475f754`). Phase 3 was originally scoped as **"AR Invoice via CREDIT_INVOICE"** — wire `createArInvoiceFromOrders` into the orchestrator. Discovery surfaced that:

1. CREDIT_INVOICE orders **already** get an `org_invoice_mst` row via the **deprecated** `createInvoice` adapter at `invoice-service.ts:56-196`, which then runs `ensureCanonicalArInvoiceArtifactsTx` to produce canonical AR child rows. The end-state shape already matches the new writer; Phase 3 is a code-organisation migration + idempotency-key alignment.
2. Gift-card-by-id is debited at TX1 (`orchestrator:597-625`) via direct `redeemGiftCardTx`, NOT through the planner's `creditApplicationLegs`. It's the only stored-value type that doesn't flow through the voucher transaction (TX2). The plumbing for the move (`CREDIT_APPLICATION_TYPES.GIFT_CARD`, `STORED_VALUE_LOCK_ORDER`, `redeemGiftCardTx(voucherId, voucherLineId)`, `applyStoredValueDebitTx` dispatcher case for GIFT_CARD at `order-credit-application.service.ts:177-191`) is ALL ready.

The user picked **Scope B**: ship both changes together. The intended outcome is a single Phase 3 commit that (a) makes the orchestrator use the canonical AR writer, (b) routes gift-card-by-id through the voucher transaction like every other stored-value type, and (c) corrects the breakdown snapshot math so `creditsTotal`/`netReceivable`/`outstanding` reflect ALL credit-application legs (not just gift-card).

---

## Critical corrections from Phase 2 design pass

The Plan agent's discovery refined the brief:

1. **`applyStoredValueDebitTx` already has a `GIFT_CARD` case** at `lib/services/order-credit-application.service.ts:177-191`. No dispatcher change needed.
2. **`STORED_VALUE_CODE` lives locally in the orchestrator** at `order-submit-orchestrator.service.ts:88-94` with `GIFT_CARD: 'gc'` already present. The TX2 loop's idempotency key `${orderId}_sv_gc_${legIndex}` works out of the box once gift-card reaches the planner.
3. **`createInvoice` has two callers besides orchestrator**: `app/actions/payments/invoice-actions.ts` (deprecated server action) and one test file. Full retirement is Phase 6; mark `@internal` for now.
4. **`createArInvoiceFromOrders` creates DRAFT** (`ar-invoice.service.ts:1500`) and does NOT dispatch ERP-lite. To preserve parity with legacy `createInvoice` we must add (a) an `issueImmediately?: boolean` option that flips DRAFT → OPEN inline (calling `appendLedgerEntryTx` + emitting `AR_INVOICE_ISSUED`), and (b) call `ErpLiteAutoPostService.dispatchInvoiceCreatedInTransaction` immediately after the create.
5. **`org_invoice_mst.gift_card_applied_amount` exists** and is currently written by `createInvoice` (line 139). New writer must also populate it (from `serverTotals.giftCardApplied`) so reporting doesn't lose this column.
6. **Outstanding-math risk**: today `outstanding = finalTotal - giftCardApplied - amountToCharge`. The Plan agent flagged that `amountToCharge` may include wallet/advance legs (it filters by `DEFERRED_METHODS`, not `paymentNature`). Phase 6 of this plan switches to `plan.realPaymentAmount` to avoid double-subtraction. **MUST verify by reading `amountToCharge` construction at orchestrator ~line 348 before Step 6.**

---

## Phase 3 — final plan (step-by-step)

### Step 0 — Read-only discovery confirmation (Supabase MCP + grep)

1. MCP `list_tables` against `org_invoice_mst` → confirm columns: `gift_card_applied_amount`, `gift_card_id`, `status`, `issued_at`, `issued_by`, `outstanding_amount`.
2. MCP `execute_sql` (read-only): `SELECT count(*) FROM org_invoice_mst WHERE status='DRAFT' AND order_id IS NOT NULL` — sanity check no in-flight DRAFTs from prior submits.
3. Grep `creditsTotal:` and `breakdown.creditsTotal` across `web-admin/lib` + `app` — confirm no downstream reader depends on "gift-card only" semantics.
4. Grep `redeemGiftCardTx(` and `createInvoice(` — confirm caller counts match Plan agent's findings.
5. Read `orchestrator:340-360` to confirm exact `amountToCharge` construction (which payment-leg filter is applied).
6. Read `order-credit-application.service.ts:177-191` to confirm the GIFT_CARD dispatcher case.

**Exit:** all 6 confirmations recorded in IMPLEMENTATION_STATUS.md Phase 3 Step 0 entry. If any assumption breaks, halt and re-design.

### Step 1 — Migration `0330` (likely SKIP)

If Step 0 surfaces a column gap, create `supabase/migrations/0330_phase3_ar_invoice_canonical_writer.sql`, **STOP for user review + apply + `npx prisma generate`**. Most likely outcome: skip — record "no migration needed" in IMPLEMENTATION_STATUS.md.

### Step 2 — Thread `tx?` + add `issueImmediately` + ERP-lite into `createArInvoiceFromOrders`

File: `web-admin/lib/services/ar-invoice.service.ts:1401-1583`.

Mirror Phase 2's pattern:

```ts
async function createArInvoiceFromOrdersInTx(tx, input, tenantId, userId) { /* current body */ }
export async function createArInvoiceFromOrders(input, actor = {}, tx?: PrismaTx) {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;
  if (tx) return createArInvoiceFromOrdersInTx(tx, input, tenantId, userId);
  return withTenantContext(tenantId, () =>
    prisma.$transaction(inner => createArInvoiceFromOrdersInTx(inner, input, tenantId, userId)));
}
```

Inside the in-tx body:

- Extend `CreateArInvoiceFromOrdersInput` Zod schema to accept optional `issueImmediately?: boolean` (default `false`) and `gift_card_applied_amount?: number`.
- Add `gift_card_applied_amount` to the `org_orders_mst` SELECT (lines 1421-1437) so it falls back to the order snapshot.
- After `org_invoice_mst.create`, call `ErpLiteAutoPostService.dispatchInvoiceCreatedInTransaction(tx, {...})` and gate with `assertBlockingInvoiceAutoPostSucceeded`. Extract that helper from `invoice-service.ts:868-894` into `lib/services/erp-lite-auto-post.util.ts` (or accept a duplicated local helper for now — note as Phase 6 cleanup).
- When `issueImmediately === true`: compute `status = deriveArInvoiceStatus({ currentStatus: OPEN, totalAmount, paidAmount: 0, dueDate })`; populate `issued_at`/`issued_by` on the create payload (or do an immediate `update`); call `appendLedgerEntryTx` with `INVOICE_ISSUED` debit + `AR_LEDGER_ENTRY_SIDES.DEBIT`; emit `OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED` via `emitEventTx`. Add a status-history row with `actionCd: 'ISSUE_IMMEDIATE'`.

**Exit:** `npx tsc --noEmit` filtered clean; existing `__tests__/services/ar-invoice.service.test.ts` still green; new code paths dormant when `issueImmediately !== true` (preserves API route behavior).

### Step 3 — Replace `createInvoice` call in orchestrator

File: `web-admin/lib/services/order-submit-orchestrator.service.ts:565-582`.

```ts
if (shouldCreateArInvoice) {
  const invoiceDetail = await createArInvoiceFromOrders(
    {
      order_ids: [orderId],
      customer_id: input.customerId!,
      currency_code: serverTotals.currencyCode,
      gift_card_applied_amount: serverTotals.giftCardApplied,
      issueImmediately: true,
      idempotency_key: `${orderId}_ar`,
      allocation_policy: 'REMAINING_ONLY',
    },
    { tenantId, userId },
    tx,
  );
  invoiceId = invoiceDetail.invoice.id;
  await tx.org_orders_mst.update({
    where: { id_tenant_org_id: { id: orderId, tenant_org_id: tenantId } },
    data:  { invoice_id: invoiceId },
  });
}
```

- Idempotency key `${orderId}_ar` matches convention from `${orderId}_vch` / `${orderId}_vch_post`. `withIdempotency` returns cached result on replay.
- Remove `createInvoice` import (line 19) and the eslint-disable for `no-restricted-imports` if present.
- Mark `createInvoice` `@internal` (not deletion — `createInvoiceAction` server action still calls it; that migration is Phase 6).

**Exit:** TS clean; full Phase 2 jest sweep still 69/69.

### Step 4 — Synthesize gift-card credit-application leg (option G1)

File: `web-admin/lib/services/order-submit-orchestrator.service.ts` — insert immediately BEFORE `buildSettlementPlan` is called.

```ts
if (input.giftCardId && serverTotals.giftCardApplied > 0) {
  const gcMethodRow = await prisma.org_payment_methods_cf.findFirst({
    where: {
      tenant_org_id: tenantId,
      credit_application_type: CREDIT_APPLICATION_TYPES.GIFT_CARD,
      payment_nature: PAYMENT_NATURE.CREDIT_APPLICATION,
      is_active: true, is_enabled: true, is_platform_disabled: false,
    },
    select: { /* match listEffectivePaymentMethodConfigs shape */ },
  });
  if (!gcMethodRow) throw new Error('GIFT_CARD_PAYMENT_METHOD_NOT_CONFIGURED');
  const gcOption: SettlementOption = { /* map row → option mirroring lines 421-443 */ };
  settlementLegs.push({
    settlementOption: gcOption,
    amount:           serverTotals.giftCardApplied,
    creditReferenceId: input.giftCardId,
  });
}
```

Rationale (G1 vs G2):
- **G1** (orchestrator-side synthesis): planner stays pure; signature unchanged (10 planner unit tests untouched); orchestrator already owns gift-card lookup at lines 597-625.
- **G2** (planner accepts `{ giftCardId, giftCardAmount }`): planner signature ripples to every caller and tests.

G1 wins. After synthesis the planner classifies via `option.paymentNature === CREDIT_APPLICATION`, sorts by `STORED_VALUE_LOCK_RANK` (GIFT_CARD ranks first), and emits a credit-application leg. The existing TX2 voucher loop (lines 716-758) creates the voucher line + calls `applyStoredValueDebitTx`, which dispatches to `redeemGiftCardTx` with `voucherId`/`voucherLineId` populated.

The synthesized `gcOption` needs at minimum: `id` (the D9 row id), `paymentMethodCode`, `paymentNature: CREDIT_APPLICATION`, `creditApplicationType: GIFT_CARD`, `requiresCashDrawer: false`, `requiresReference: false`. Other D9 fields can default.

**Prerequisite — D9 row must exist:** the tenant's `org_payment_methods_cf` must have a row tagged `credit_application_type = 'GIFT_CARD'`. Discovery to confirm via MCP read query in Step 0. If absent, Step 1 migration seeds it OR we throw `GIFT_CARD_PAYMENT_METHOD_NOT_CONFIGURED` and document operator setup. **Decision needed at Step 0**.

**Exit:** new orchestrator unit test covering gift-card-by-id without explicit payment leg → plan contains 1 credit-application leg with creditType=GIFT_CARD.

### Step 5 — Delete TX1 gift-card debit + cleanup

File: `web-admin/lib/services/order-submit-orchestrator.service.ts:597-625`. Delete the entire `if (input.giftCardId && serverTotals.giftCardApplied > 0) { ... } else if (input.giftCardNumber && serverTotals.giftCardApplied > 0) { ... }` block. Remove the `redeemGiftCardTx` import.

Legacy `giftCardNumber` (string-only) path:
- Per Phase 2 RESUME `BVM_PHASE_2_ENTRY_PLAN.md` schema-debt section, this path is dead on submit-order in current UI.
- If Step 0 grep finds any live caller passing only `giftCardNumber` (not `giftCardId`), add a Step-5a resolver: before Step 4 synthesis, look up `org_gift_cards_mst.findFirst({ where: { gift_card_code: input.giftCardNumber } })` to derive `giftCardId`, then proceed.

**Exit:** TS clean; Phase 2 jest sweep still 69/69; orchestrator no longer references `redeemGiftCardTx`.

### Step 6 — Fix breakdown snapshot math

File: `web-admin/lib/services/order-submit-orchestrator.service.ts:817-833`. Change:

- `creditsTotal: plan.creditAppliedAmount`  ← was `serverTotals.giftCardApplied`
- `netReceivable: serverTotals.finalTotal - plan.creditAppliedAmount`
- `outstanding: Math.max(0, serverTotals.finalTotal - plan.creditAppliedAmount - plan.realPaymentAmount)`  ← was `... - amountToCharge`

Switching `amountToCharge` → `plan.realPaymentAmount` eliminates the double-subtraction risk if `amountToCharge` filter is by `DEFERRED_METHODS` rather than `paymentNature` (verified at Step 0 discovery item 5). `plan.realPaymentAmount` is the authoritative source for real-payment legs.

**Exit:** new test in `__tests__/services/order-submit-orchestrator.phase3.test.ts` validates a mixed cash + wallet + gift-card scenario → `breakdown.creditsTotal === gift + wallet amounts`, `netReceivable === finalTotal - (gift + wallet)`, `outstanding === finalTotal - (gift + wallet) - cash`.

### Step 7 — Tests

Create `web-admin/__tests__/services/order-submit-orchestrator.phase3.test.ts`. Mock Prisma, `withTenantContext`, `createArInvoiceFromOrders`, `applyStoredValueDebitTx`, voucher services.

Test scenarios:

| # | Scenario | Assertion |
|---|---|---|
| T1 | CREDIT_INVOICE order, outstanding > 0 | `createArInvoiceFromOrders` called with `issueImmediately:true, idempotency_key:'${orderId}_ar'`; `org_orders_mst.invoice_id` set; ERP-lite dispatched |
| T2 | Submit replay (same idempotency key) | no duplicate AR invoice (`withIdempotency` cache hit); no duplicate gift-card debit (`redeemGiftCardTx` idempotency-key short-circuit); no duplicate voucher line |
| T3 | Cash order with `input.giftCardId` | `createArInvoiceFromOrders` NOT called; voucher line `LINE_TYPE.CREDIT_APPLICATION, credit_application_type=GIFT_CARD` created; `applyStoredValueDebitTx({ creditType:GIFT_CARD, creditReferenceId:input.giftCardId, voucherId, voucherLineId })` called |
| T4 | Cash order, no gift-card | no AR invoice, no credit-application leg (sanity) |
| T5 | Mixed cash + wallet + gift-card | `breakdown.creditsTotal === gift + wallet`; `netReceivable === finalTotal - creditsTotal`; `outstanding === finalTotal - creditsTotal - realPaymentAmount` |

Extend `web-admin/__tests__/services/ar-invoice.service.test.ts`:

| # | Scenario | Assertion |
|---|---|---|
| T6 | `issueImmediately: true` | invoice `status = OPEN`, AR ledger DEBIT INVOICE_ISSUED, `AR_INVOICE_ISSUED` outbox event, ERP-lite dispatched |
| T7 | `issueImmediately: false` (default) | invoice `status = DRAFT` (preserves existing route behavior) |

After EACH step: Phase 2 baseline sweep `cd web-admin && npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts __tests__/services/order-settlement-planner.service.test.ts __tests__/services/discount-service.test.ts __tests__/services/stored-value.service.test.ts __tests__/services/loyalty.service.test.ts` → 69/69 + new file. TS check: `npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers' | Select-Object -Last 30`.

### Step 8 — Docs (via `/documentation` skill at phase close)

Per-step (dual-step rule): append progress entry to `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` after each numbered step.

Per-phase (at exit checklist):
1. `docs/features/Order_Fin/bvm_wiring_phase3_implementation.md` — match Phase 2 template. Sections: Scope (link `ADR_ar_invoice_is_receivable_only.md`), Change 1 (canonical writer migration), Change 2 (gift-card to voucher line, G1 decision), Step 6 breakdown math correction, test matrix, follow-ups (delete `createInvoice` once `createInvoiceAction` migrated).
2. `docs/features/Order_Fin/CHANGELOG.md` — top-of-file entry.
3. `docs/features/AR_Invoice/IMPLEMENTATION_STATUS.md` — add `issueImmediately` flag + ERP-lite dispatcher addition.
4. Memory: update `project_bvm_wiring_phases.md` with Phase 3 ✅ Done state.
5. Memory (NEW): save user preference "planning docs live in `docs/features/<feature>/`".

### Phase 3 exit checklist

- [ ] All 6 step exit criteria green
- [ ] `npx tsc --noEmit` filtered = 0 errors
- [ ] Phase 2 jest sweep (69/69) + new Phase 3 tests (T1–T7) all pass
- [ ] `cd web-admin && npm run build` succeeds
- [ ] `IMPLEMENTATION_STATUS.md` updated step-by-step + phase-close section
- [ ] CHANGELOG entry added
- [ ] `bvm_wiring_phase3_implementation.md` written in `docs/features/Order_Fin/`
- [ ] Manual QA the 5 scenarios in `brief_test_guide_01.md` (CREDIT_INVOICE / replay / cash+gift / cash-only / mixed)
- [ ] User commits with `DD_MM_YYYY_N` prefix

---

## Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Breakdown math change drifts snapshot for in-flight CREDIT_INVOICE orders | low | `settleOrder` re-derives outstanding from fact rows; only the snapshot column moves; T5 catches |
| `amountToCharge` includes wallet/advance → double-subtraction in `outstanding` | medium | Step 6 uses `plan.realPaymentAmount` (verified at Step 0 read #5) |
| ERP-lite dispatcher blocks when policy=BLOCKING and tenant misconfigured | low | preserve `assertBlockingInvoiceAutoPostSucceeded` gating — same as legacy |
| Synthetic gift-card leg pushes voucher total past order total | very low | `order-calculation.service.ts` already caps `giftCardApplied ≤ amountBeforeGiftCard`; add `assert(plan.immediateSettlementAmount ≤ serverTotals.finalTotal + TOLERANCE)` before voucher |
| No D9 `GIFT_CARD` payment-method-config row in tenant | medium | Step 0 MCP read confirms; if missing, decide migration seed or throw + operator setup |
| Legacy `giftCardNumber` path silently broken | low | Step 0 grep; if a live caller exists, add Step-5a resolver branch |
| `createInvoice` lingers as dead code | medium | mark `@internal`; track removal in Phase 6 |

## Rollback strategy

No migration shipped → pure code revert via `git revert <phase3-commit>`. Phases of safety:

- `${orderId}_ar` keys in `org_idempotency_keys` auto-expire (24h TTL).
- New-writer AR invoices indistinguishable from legacy in `org_invoice_mst` (same status, ledger, history) → no reporting breakage.
- Snapshot `outstanding_amount` reverts to legacy formula on next settlement recomputation; AR fact rows remain authoritative.
- Steps 2/3/4 can be reverted independently. Step 5 (TX1 deletion) is the only "load-bearing" deletion; revert it together with Step 4 if needed.

## Verification — end-to-end

```powershell
# 1. TS (filtered, baseline = 3 pre-existing payment-config errors)
cd f:\jhapp\cleanmatex\web-admin
npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers' | Select-Object -Last 30

# 2. Phase 2 sweep + new Phase 3 file
npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts `
         __tests__/services/order-settlement-planner.service.test.ts `
         __tests__/services/discount-service.test.ts `
         __tests__/services/stored-value.service.test.ts `
         __tests__/services/loyalty.service.test.ts `
         __tests__/services/ar-invoice.service.test.ts `
         __tests__/services/order-submit-orchestrator.phase3.test.ts

# 3. Build
npm run build

# 4. Manual QA scenarios (brief_test_guide_01.md):
#   M1. B2B customer, CREDIT_INVOICE, mixed cash + gift-card → AR invoice OPEN, voucher posted, gift-card voucher line present
#   M2. Same submit replayed (same payload) → no duplicate AR invoice, no duplicate gift-card debit
#   M3. Cash retail customer with gift-card → no AR invoice; gift-card appears as voucher CREDIT_APPLICATION line
#   M4. Cash retail customer no gift-card (sanity)
#   M5. CREDIT_INVOICE with wallet + gift-card → both produce credit-application voucher lines; AR invoice covers outstanding
```

---

## Critical files modified

- `web-admin/lib/services/ar-invoice.service.ts` (Step 2)
- `web-admin/lib/validations/ar-invoice-schemas.ts` (Step 2 — add `issueImmediately`, `gift_card_applied_amount` to `createArInvoiceFromOrders` schema)
- `web-admin/lib/services/order-submit-orchestrator.service.ts` (Steps 3, 4, 5, 6)
- `web-admin/lib/services/invoice-service.ts` (Step 3 — mark `createInvoice` `@internal`)
- `web-admin/__tests__/services/order-submit-orchestrator.phase3.test.ts` (Step 7 — new)
- `web-admin/__tests__/services/ar-invoice.service.test.ts` (Step 7 — extend)
- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` (per-step + phase-close)
- `docs/features/Order_Fin/CHANGELOG.md` (phase close)
- `docs/features/Order_Fin/bvm_wiring_phase3_implementation.md` (NEW, phase close)
- `docs/features/AR_Invoice/IMPLEMENTATION_STATUS.md` (phase close, `issueImmediately` note)

## Functions / utilities reused (no rewrites)

- `withTenantContext` (`lib/db/tenant-context.ts`)
- `withIdempotency` (`ar-invoice.service.ts:272-325`)
- `appendLedgerEntryTx`, `recordStatusHistoryTx`, `emitEventTx`, `ensureCanonicalArInvoiceArtifactsTx` (`ar-invoice.service.ts`)
- `ErpLiteAutoPostService.dispatchInvoiceCreatedInTransaction` + `assertBlockingInvoiceAutoPostSucceeded` (`erp-lite-auto-post.service.ts` + helper in `invoice-service.ts:868-894`)
- `buildSettlementPlan` (`order-settlement-planner.service.ts`) — no signature change
- `addVoucherLine`, `createBizVoucher`, `postAndWireBizVoucher` (`voucher-*.service.ts`)
- `applyStoredValueDebitTx` (`order-credit-application.service.ts:88+`)
- `redeemGiftCardTx` (`gift-card-service.ts:671-797`) — now reached only through dispatcher
