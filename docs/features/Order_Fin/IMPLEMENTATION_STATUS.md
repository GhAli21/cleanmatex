# Order Financial Platform — Implementation Status

Last updated: 2026-05-28
Renamed from `current_status.md` for parity with `docs/features/AR_Invoice/IMPLEMENTATION_STATUS.md`.

## Phase Completion

| Phase | Description | Status |
|---|---|---|
| P0 | Foundation — migrations 0278–0282, constants, types | ✅ Done |
| P1 | Order financial fact tables (charges, taxes, discounts, payments, credit_apps) | ✅ Done |
| P2 | Stored value tables (wallets, advances, credit notes) | ✅ Done |
| P3 | Loyalty tables (accounts, transactions) | ✅ Done |
| P4 | Promotions engine tables | ✅ Done |
| P5 | Tax configuration tables | ✅ Done |
| P6 | Infrastructure (outbox, reconciliation, cash drawer) | ✅ Done |
| P7 | Permissions seed + navigation | ✅ Done |
| P8 | Service layer (10 services) | ✅ Done |
| P9 | API routes (~30 routes) | ✅ Done |
| P10–P19 | Billing UI, prints, jobs, i18n, tests, docs | ✅ Done |
| BVM-1A | BVM Wiring Phase 1A — order payment, credit application, cash drawer wiring | ✅ Done (2026-05-22) |
| BVM-1B | BVM Wiring Phase 1B — submit-order canonical path + orchestrator | ⚠ Implemented 2026-05-23 with bugs; **STABILIZED 2026-05-28** |
| BVM-1B-STAB | Phase 1B Stabilization — pre-Phase-2 bug-fix + hardening | ✅ Done (2026-05-28) |
| BVM-2 | Stored-value consolidation into voucher transaction | ⏳ Next — see `BVM_PHASE_2_ENTRY_PLAN.md` |

---

## BVM-1B Stabilization Session (2026-05-28)

**Context:** Phase 1B was marked complete on 2026-05-23 but the build was broken, AR ledger was producing wrong debits for cash sales, manual voucher posts silently drifted order snapshots, and several yellow-tier code-quality issues remained. This session fixed all of them before opening Phase 2.

**Session plan:** `C:\Users\JHNLP\.claude\plans\sleepy-zooming-goose.md` (13 stages, all complete)

### Bugs fixed

| ID | Severity | Fix |
|---|---|---|
| B1 | Build-blocking | `TaxLineItem.isCompound` threaded from `calculateTax()` via `org_tax_profiles_cf.is_compound`; legacy route marked `@ts-expect-error` |
| B2 | 403 for non-admin | `invoices:view` permission code (unseeded) renamed to `invoices:read` (seeded) across 5 sites |
| B3 | AR ledger pollution | `createInvoice()` gated on `effectiveOutstandingPolicy === 'CREDIT_INVOICE'`; AR allocation gated on `result.invoiceId`; `applyPromoCodeTx.invoiceId` made optional; `ensureCanonicalArInvoiceArtifactsTx` adds defense-in-depth guard. See `ADR_ar_invoice_is_receivable_only.md`. |
| X1 | Drift / drift-risk | Raw outbox insert in `voucher-wiring.service.ts` replaced with `emitEventTx()`; `OUTBOX_EVENT_TYPES.VOUCHER_POSTED_AND_WIRED` added to constants |
| X5 | Live silent drift | `recalcOrderSnapshotIfLinked()` helper added; called from `POST /api/v1/finance/vouchers/[voucherId]/post` route and `postBizVoucherAction` server action. Manual Finance UI posts now refresh order snapshots. |
| Y3 | Live data loss | `collectPaymentTx` now persists `check_no` / `check_bank_name` / `check_due_date` on `org_order_payments_dtl` |
| Y4 | Log noise | `Jh65` / `Jh66` debug `logger.info` calls deleted from `permission-service-server.ts` |
| S1 | Prisma drift | 6 D9 columns added to `sys_payment_method_cd` Prisma model, 4 to `org_payment_methods_cf`; `prisma generate` clean (Step 0h debt closed) |
| S2 | Silent retry inconsistency | SHA-256 payload-hash conflict detection added to `submit-order` route via new `lib/utils/idempotency.ts`; returns 409 IDEMPOTENCY_CONFLICT on payload mismatch |
| S3 | Fallback drift | Planner + settlement both `throw 'CREDIT_APPLICATION_TYPE_REQUIRED'` when `credit_application_type` is null (was: planner→WALLET, settlement→GIFT_CARD) |
| S4 | Stale URL | `orders-access.ts:58` updated from `/create-with-payment` to `/submit-order` |
| S6 | Float drift | `lib/utils/money.ts` created (Decimal-backed); applied at orchestrator split/sum sites, settlement change/snapshot/sum sites, AR allocation math; dead `Decimal` import + `toNumber` helper removed |
| F21 | Loyalty double-debit | `redeemPointsTx` idempotency key is now `loyalty-redeem-${orderId}` (was `${orderId}-points-redeem-${Date.now()}` — defeated unique constraint) |
| — | Pre-existing | `payment-modal-v4.tsx` use-before-declaration (`payNowAmount` / `remainingBalance`) fixed |
| — | Pre-existing | `discount-service.test.ts` stale mocks updated from `org_promo_usage_log` / `org_promo_codes_mst` to `org_promotion_usage_dtl` / `org_promotions_mst` |

### Files created

- `web-admin/lib/utils/money.ts` — canonical money math (Decimal-based)
- `web-admin/lib/utils/idempotency.ts` — canonicalize + SHA-256 hash + store/find idempotency records
- `web-admin/__tests__/utils/money.test.ts` — 13 tests, all pass
- `web-admin/__tests__/utils/idempotency.test.ts` — 11 tests, all pass
- `web-admin/__tests__/services/order-settlement-planner.service.test.ts` — 10 tests, all pass
- `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md`
- `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` (this file — supersedes `current_status.md`)
- `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md` (next session)

### Files modified

- `web-admin/prisma/schema.prisma` — D9 columns on sys + org payment method models
- `web-admin/lib/constants/order-financial.ts` — added `VOUCHER_POSTED_AND_WIRED` outbox event type
- `web-admin/lib/services/voucher-wiring.service.ts` — `emitEventTx` + `recalcOrderSnapshotIfLinked`
- `web-admin/lib/services/order-submit-orchestrator.service.ts` — isCompound, sumMoney, gated createInvoice, gated AR allocation
- `web-admin/lib/services/order-settlement.service.ts` — money helpers, check fields in collectPaymentTx, throw on null credit type
- `web-admin/lib/services/order-settlement-planner.service.ts` — throw on null credit type
- `web-admin/lib/services/ar-invoice.service.ts` — defense-in-depth ledger guard, money helpers
- `web-admin/lib/services/discount-service.ts` — `applyPromoCodeTx.invoiceId` optional
- `web-admin/lib/services/permission-service-server.ts` — removed Jh65/Jh66 debug logs
- `web-admin/app/api/v1/orders/submit-order/route.ts` — payload-hash idempotency conflict detection
- `web-admin/app/api/v1/finance/vouchers/[voucherId]/post/route.ts` — calls recalc helper
- `web-admin/app/actions/finance/voucher-actions.ts` — calls recalc helper, revalidates linked order pages
- `web-admin/app/api/v1/ar/invoices/route.ts` + `[id]/route.ts` — `invoices:read`
- `web-admin/config/navigation.ts` — `invoices:read`
- `web-admin/src/features/billing/access/billing-access.ts` — `invoices:read` (5 sites)
- `web-admin/src/features/orders/access/orders-access.ts` — URL fix
- `web-admin/src/features/orders/ui/payment-modal-v4.tsx` — variable hoisting fix
- `web-admin/app/api/v1/orders/_legacy_create-with-payment/route.ts` — `@ts-expect-error` annotations
- `web-admin/__tests__/services/discount-service.test.ts` — stale mock fix

### Verification

- `npx tsc --noEmit` — 0 errors
- `npx jest __tests__/utils/ __tests__/services/order-settlement-planner.service.test.ts` — 34/34 pass
- `npx jest __tests__/services/discount-service.test.ts` — 7/7 pass
- Build state: GREEN

### Out of scope (deferred)

- `org_audit_logs` generic table — codebase already has 7 module-specific audit tables; deferred to dedicated audit-platform feature
- Tax Documents Module (`org_tax_documents_mst`) — separate PRD; voucher receipt covers GCC Simplified Tax Invoice for cash sales today
- B4 `creditReferenceId` plumbing — Phase 2 entry (bundled with stored-value consolidation)
- Stored-value redemption concurrency tests — Phase 2 entry
- Orchestrator 4-tx → 1-tx merge — Phase 2
- Hardcoded Arabic VAT label at orchestrator:711 — pre-existing i18n violation; separate fix
- `_legacy_create-with-payment` deletion — frozen per ADR

---

## Known limitations carried into Phase 2

1. **Manual orchestrator 4-tx split** — outbox events from voucher post commit before settleOrder runs; window is <200ms but a worker could process voucher-posted events before order snapshot is final. Phase 2 will merge transactions.
2. **Voucher print template** — not yet GCC-compliant Simplified Tax Invoice (missing item-level VAT, seller VAT registration, ZATCA QR). Tracked for dedicated print template hardening before Saudi Phase 2 ZATCA cutover.
3. **Legacy idempotency rows** — production rows written before S2 don't have `payload_hash`. They are honored as match-by-key only (no conflict check). Future submits will write the hash.

See `BVM_PHASE_2_ENTRY_PLAN.md` for next session's scope.
