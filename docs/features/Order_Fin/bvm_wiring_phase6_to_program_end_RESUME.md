# RESUME — BVM Wiring: Phase 6 → program summary

**Created:** 2026-05-30 (mid-session checkpoint, just before user runs `/clear`).
**Predecessor:** `docs/features/Order_Fin/bvm_wiring_phase4_close_to_program_end_RESUME.md` — its Phase 4 close + Phase 5 sections are both ✅ Done. This doc carries forward Phase 6 + program summary only.

This doc is self-contained. After `/clear`, paste the single-line prompt below.

---

## Single-line prompt to paste in the new session

> Read `docs/features/Order_Fin/bvm_wiring_phase6_to_program_end_RESUME.md` then load the `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation`, `/i18n`, `/code-documentation`, `/navigation`, `/testing`, `/documentation` skills. Resume at **Phase 6 Sub-item 1** (verify-payment endpoint). Continue through Sub-items 2–7 in priority order, stopping for user apply on every migration. After every code step, run `cd web-admin && npx tsc --noEmit` filtered to exclude `payment-config|cash-drawers` + the 172/172 baseline sweep (command at bottom of this doc). Append a progress entry to `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` per sub-item. End Phase 6 with its exit checklist + close via the `/documentation` skill writing `docs/features/Order_Fin/bvm_wiring_phase6_implementation.md`. After Phase 6 closes, write `docs/features/Order_Fin/bvm_wiring_program_summary.md` capping the whole program. Production quality only: full EN/AR + RTL, Cmx components, RBAC, multi-tenant safety via `withTenantContext`, no shortcuts.

---

## State at handoff (verified clean — safe to resume cold)

| Thing | Value | Verify command |
|---|---|---|
| Branch | `main` | `git branch --show-current` |
| HEAD | Phase 3 close (`5c7a78b 28_05_2026_14 ...`) | `git log -1 --oneline` |
| Last migration on disk | `0330_phase5_order_history_bvm_action_types.sql` (applied by user) | `Get-ChildItem supabase/migrations/03*.sql \| Sort-Object Name \| Select-Object -Last 3` |
| Next free seq | `0331` | as above |
| Phase 4 | ✅ Done — `bvm_wiring_phase4_implementation.md` |
| Phase 5 | ✅ Done — `bvm_wiring_phase5_implementation.md` |
| Phase 6 | ⏳ Next | this doc |
| tsc (filtered) | **0 errors** | see baseline below |
| Full jest sweep | **172/172 pass** (163 baseline + 9 consumer) | see baseline below |
| i18n parity | **green** | `npm run check:i18n` |
| Supabase MCP | configured (`supabase_remote_db`) | `.mcp.json` |

### Files dirty at handoff — Phase 4 + Phase 5 work-in-progress (ship as Phase 4 + Phase 5 commits when user is ready)

```
# Phase 4 (from previous session, still dirty)
web-admin/app/api/v1/finance/reconciliation/issues/[issueId]/route.ts        # BUG-R1 fix
web-admin/app/api/v1/finance/vouchers/[voucherId]/reconciliation/route.ts    # NEW
web-admin/app/api/v1/orders/[id]/financial-reconcile/route.ts                # JSDoc cross-ref
web-admin/app/api/v1/orders/[id]/financial-reconciliation/route.ts           # JSDoc cross-ref
web-admin/app/dashboard/internal_fin/reconciliation/[runId]/page.tsx         # Cmx back-link
web-admin/lib/constants/order-financial.ts                                   # 20 new check codes
web-admin/lib/services/reconciliation.service.ts                             # full orchestrator rewrite
web-admin/lib/services/reconciliation/types.ts                               # NEW
web-admin/lib/services/reconciliation/ar-checks.ts                           # NEW
web-admin/lib/services/reconciliation/stored-value-checks.ts                 # NEW
web-admin/lib/services/reconciliation/order-checks.ts                        # NEW
web-admin/lib/services/reconciliation/order-snapshot-checks.ts               # NEW
web-admin/lib/services/reconciliation/voucher-checks.ts                      # NEW
web-admin/lib/services/voucher-reconciliation.service.ts                     # NEW
web-admin/src/features/billing/ui/reconciliation-list-client.tsx             # Cmx/RTL/i18n
web-admin/src/features/billing/ui/reconciliation-detail-client.tsx           # Cmx/RTL/i18n
web-admin/__tests__/services/reconciliation.service.test.ts                  # createMany contract
web-admin/__tests__/integration/reconciliation-run.test.ts                   # createMany contract
web-admin/__tests__/services/reconciliation/check-modules.test.ts            # NEW

# Phase 5 (this session)
supabase/migrations/0330_phase5_order_history_bvm_action_types.sql           # NEW, applied by user
web-admin/prisma/schema.prisma                                               # outbox_event_id field + relation
web-admin/lib/services/order-history-consumer.service.ts                     # NEW
web-admin/src/features/orders/ui/order-timeline.tsx                          # icons/colors/labels for 3 BVM types
web-admin/__tests__/services/order-history-consumer.service.test.ts          # NEW
web-admin/messages/en.json                                                   # 3 new BVM action labels
web-admin/messages/ar.json                                                   # 3 new BVM action labels

# Docs (both Phase 4 + Phase 5)
docs/features/Order_Fin/IMPLEMENTATION_STATUS.md
docs/features/Order_Fin/CHANGELOG.md
docs/features/Order_Fin/bvm_wiring_phase4_implementation.md                  # NEW
docs/features/Order_Fin/bvm_wiring_phase5_implementation.md                  # NEW
docs/features/Order_Fin/bvm_wiring_phase4_close_to_program_end_RESUME.md     # earlier RESUME
docs/features/Order_Fin/bvm_wiring_phase6_to_program_end_RESUME.md           # THIS DOC
```

### Carry-over files — NOT MINE, leave alone

Already dirty before Phase 4 started; do not touch in Phase 6 unless a sub-item explicitly requires:

- `web-admin/app/dashboard/internal_fin/invoices/[id]/page.tsx`
- `web-admin/src/features/ar/ui/ar-invoice-detail-tabs.tsx`
- `web-admin/src/features/ar/ui/ar-invoice-detail-data-table.tsx` (untracked)
- `docs/features/Order_Fin/CleanMateX_Order_Details_Financial_Summary_Enhancement_Spec_v1_0.md` (untracked)
- Payment Modal v4 work (`payment-modal-v3.tsx`, `payment-modal-v4.tsx`, related test/route/i18n files) — **EXCEPT** when Phase 6 Sub-item 4 explicitly attacks it. Check `git status` first.

---

## Phase 6 — UI / schema debt cleanup

Priority order — each sub-item is its own step with its own STATUS entry, its own tsc + sweep run, and its own optional migration (which STOPS for user apply).

### Sub-item 1 — Verify-payment endpoint (highest UX value)

| Aspect | Detail |
|---|---|
| Route | `POST /api/v1/orders/[id]/payments/[paymentId]/verify` |
| Service | `verifyPaymentTx(tx, { orderId, paymentId, userId })` — flips `payment_status` PENDING → COMPLETED on `org_order_payments_dtl`, emits a new outbox event `PAYMENT_VERIFIED`, writes a payment-audit-log row. |
| Permission | New `orders:verify_payment` — **needs DB seed migration** (`0331_orders_verify_payment_permission.sql`). STOP for user apply. |
| UI | Add a "Verify" button + "Verification status" badge in the payment details surface (Cmx primitives). RTL + EN/AR i18n keys: `orders.payments.verify`, `orders.payments.verifiedBy`, `orders.payments.unverified`. |
| Tests | Unit tests for `verifyPaymentTx` (idempotent on retry, blocks if already COMPLETED, raises permission error if no `orders:verify_payment`). UI a11y test for the verify button (disabled when permission missing). |
| Multi-tenant | `withTenantContext`. Composite where filter on `(tenant_org_id, order_id, payment_id)`. |
| Reconciliation tie-in | Update `RECONCILIATION_CHECK_NAMES` or follow-up phase if needed. Likely no new check — the existing `PAYMENT_TOTAL_MATCH` and `GATEWAY_PENDING_INTEGRITY` already detect unverified-but-claimed-as-paid drift. |

### Sub-item 2 — Retire `createInvoice` (legacy adapter)

| Aspect | Detail |
|---|---|
| Driver | `lib/services/invoice-service.ts` still exposes a `createInvoice` adapter that pre-dates `createArInvoiceFromOrders` (Phase 3). The single remaining caller is `app/actions/payments/invoice-actions.ts:createInvoiceAction`. |
| Steps | 1. Migrate `createInvoiceAction` to `createArInvoiceFromOrders` (use `issueImmediately: true` when the existing behaviour was to OPEN; preserve idempotency key shape). 2. Update `__tests__/services/invoice-service.test.ts` — drop the legacy assertions, port the meaningful ones to `ar-invoice.service.test.ts`. 3. Delete `createInvoice` + its private helpers from `invoice-service.ts`. 4. Extract `assertBlockingInvoiceAutoPostSucceeded` to `lib/services/erp-lite-auto-post.util.ts` (currently duplicated in `invoice-service.ts` and `ar-invoice.service.ts`). Update both consumers. |
| Tests | Full sweep + tsc; no migration needed. |

### Sub-item 3 — Hoist `STORED_VALUE_CODE` map into constants

| Aspect | Detail |
|---|---|
| Driver | `lib/services/order-submit-orchestrator.service.ts:~84-90` declares a local `STORED_VALUE_CODE: Record<CreditApplicationType, string>` map (`'gc'`/`'w'`/`'a'`/`'cn'`/`'lp'`). The Phase-2 sub-idempotency key format `${orderId}_sv_${code}_${legIndex}` depends on it. |
| Steps | Move into `lib/constants/order-financial.ts` as `STORED_VALUE_SUB_IDEMPOTENCY_CODE`. Export type `StoredValueSubIdempotencyCode`. Update orchestrator import. No behaviour change. |
| Tests | tsc + sweep. No new tests needed. |

### Sub-item 4 — Payment Modal v4 completion (CHECK + WALLET + HYPERPAY validation)

| Aspect | Detail |
|---|---|
| Driver | Payment Modal v4 work was in flight in a parallel session. **First check `git status`** — someone may have merged it separately. If still dirty: missing WALLET balance precheck, CHECK due-date validation, HYPERPAY gateway round-trip happy-path UX. |
| Steps | Read existing payment-modal-v3 / payment-modal-v4 files. Decide whether to ship as v4 or merge into v3. Add: (a) WALLET balance precheck via `GET /api/v1/customers/[id]/wallet/balance`; (b) CHECK due-date field with min-date = today; (c) HYPERPAY redirect-back state preservation in URL params or sessionStorage. Cmx primitives only. RTL + EN/AR. |
| Tests | Unit tests for the helpers; UI a11y stories. |

### Sub-item 5 — Payment Method settings UI (4 D9 toggles + tenant `currency_code`)

| Aspect | Detail |
|---|---|
| Driver | `org_payment_methods_cf` carries 4 D9 columns (`payment_nature`, `credit_application_type`, `requires_voucher`, `requires_idempotency`) that are operator-editable per tenant. No UI surface today. Phase-1B Stabilization added the Prisma columns (S1), but the operator must SQL-edit. |
| Steps | New navigation entry `settings_payment_methods` under settings (DUAL-WRITE: `navigation.ts` + `sys_components_cd` migration). New route `app/dashboard/settings/payment-methods/page.tsx` with `CmxDataTable` + per-row editor (`CmxDialog` + `CmxSelectDropdown`). New service `lib/services/payment-method-settings.service.ts`. New API routes `GET/PATCH /api/v1/settings/payment-methods/[code]`. New permission `settings:payment_methods_manage` (migration). Tenant-level `currency_code` editor (separate sub-section). |
| Tests | Service tests + UI rendering. |
| Migrations | One nav migration (`0332_nav_settings_payment_methods.sql`) + one permission migration (could combine). STOP for user apply. |

### Sub-item 6 — `paymentStatus` field on `paymentLegSchema` + planner honoring (B7 unblock)

| Aspect | Detail |
|---|---|
| Driver | `paymentLegSchema` (Zod) currently has no per-leg `paymentStatus`. Phase 1B B7 left this as "planner assumes COMPLETED unless the leg is on a DEFERRED method." Client cannot mark a leg as PENDING explicitly. |
| Steps | Add optional `paymentStatus: z.enum(['COMPLETED', 'PENDING'])` to `paymentLegSchema`. Default = `COMPLETED` (preserves backwards compatibility). `order-settlement-planner.service.ts` must respect the explicit value when provided. Outstanding calc unchanged when default. |
| Tests | Unit tests for planner with explicit PENDING leg (e.g. operator marking a check as PENDING until cleared). |

### Sub-item 7 — Voucher status triple-column collapse migration (CONDITIONAL)

| Aspect | Detail |
|---|---|
| Driver | `org_fin_vouchers_mst` carries `status` (legacy text), `voucher_status` (BVM-canonical), and `posted_status` (computed). Phase 2 fix 0328 aligned the values; the columns are still split. |
| **Pre-flight audit** | Grep every reader of `status` / `voucher_status` / `posted_status` and confirm no consumer reads the legacy `status` column (Prisma-generated types, raw SQL, RLS, view definitions). Use Supabase MCP to query the DB for any view / function referencing `status`. |
| Steps (only if audit clean) | Migration `0333_voucher_status_collapse.sql` — drop `status` and `posted_status` columns; ensure `voucher_status` is `NOT NULL` everywhere; recreate any indexes/constraints. **STOP for user apply.** Update Prisma schema + any TypeScript consumer that uses the dropped columns. |
| Risk | High — schema change touches a load-bearing column. Defer if audit surfaces ANY external reader. |

---

## Per-sub-item protocol

1. **Plan the sub-item** — confirm scope + acceptance criteria.
2. **Load any new skill** the sub-item needs (`/i18n` for translations, `/navigation` for nav, `/database` for SQL, etc.). Skills already loaded by the prompt: `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation`, `/i18n`, `/code-documentation`, `/navigation`, `/testing`, `/documentation`.
3. **Implement** with production-ready discipline (no gaps, no shortcuts, full a11y/RTL/i18n where applicable). Constants must DB-mirror exactly. Use `withTenantContext` for every Prisma call on `org_*` tables. Permission codes must follow `resource:action`.
4. **STOP for user review** if it includes a migration. Otherwise…
5. **Verify** (baseline below).
6. **Update `IMPLEMENTATION_STATUS.md`** with the sub-item's progress entry.
7. **Mark TODO complete + next sub-item in_progress** (`TodoWrite`).

## Phase 6 close protocol

1. Run every per-sub-item protocol on every sub-item.
2. Run the Phase 6 exit checklist (mirrors Phases 4/5 — tsc + full sweep + i18n + nav-parity + permission-parity).
3. Invoke `/documentation` skill → `docs/features/Order_Fin/bvm_wiring_phase6_implementation.md` matching the Phase 4/5 template.
4. Prepend a Phase 6 entry to `docs/features/Order_Fin/CHANGELOG.md`.
5. Flip Phase 6 status to ✅ Done in `IMPLEMENTATION_STATUS.md`.
6. Update memory `project_bvm_wiring_phases.md`.

## Program summary (after Phase 6 closes)

Write `docs/features/Order_Fin/bvm_wiring_program_summary.md`:

- Recap Phases 1A → 6 in chronological order with a one-paragraph each.
- Public API surface delta (new endpoints, new services, new constants) cumulative.
- Migration log (0290 → 0333 or whatever range).
- Test coverage delta (start vs end count).
- Open follow-ups (if any).
- Production-readiness checklist (security, multi-tenancy, i18n, RTL, RBAC).
- Architecture invariants list (the LOCKED items from memory).
- Recommended next-program backlog (e.g. per-order AR_INVOICE_LINKED sub-events, reconciliation UI for vouchers, refund FK direct backlink).

---

## Quick sanity test before resuming

```powershell
Set-Location F:\jhapp\cleanmatex\web-admin
npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers' | Select-Object -Last 10
# expect: 0 errors

npx jest __tests__/utils/money.test.ts __tests__/utils/idempotency.test.ts `
         __tests__/services/order-settlement-planner.service.test.ts `
         __tests__/services/discount-service.test.ts `
         __tests__/services/stored-value.service.test.ts `
         __tests__/services/loyalty.service.test.ts `
         __tests__/services/ar-invoice.service.test.ts `
         __tests__/services/gift-card-service.test.ts `
         __tests__/services/reconciliation.service.test.ts `
         __tests__/integration/reconciliation-run.test.ts `
         __tests__/services/reconciliation/check-modules.test.ts `
         __tests__/services/order-history-consumer.service.test.ts
# expect: 172/172 pass

npm run check:i18n
# expect: i18n parity check passed

git status
# expect: dirty files listed above, nothing else new
```

If any of the above fails, investigate before continuing — do not paper over.

---

## Canonical references

| Purpose | Path |
|---|---|
| PRD (master spec, all phases) | `docs/features/Order_Fin/CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md` |
| Current implementation status | `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` |
| Phase 5 close template | `docs/features/Order_Fin/bvm_wiring_phase5_implementation.md` |
| Phase 4 close template | `docs/features/Order_Fin/bvm_wiring_phase4_implementation.md` |
| Phase 3 close template | `docs/features/Order_Fin/bvm_wiring_phase3_implementation.md` |
| Phase 2 close template | `docs/features/Order_Fin/bvm_wiring_phase2_implementation.md` |
| Phase 6 priority backlog (full context from program plan) | `docs/features/Order_Fin/BVM_PHASE_2_ENTRY_PLAN.md` |
| AR Invoice scope ADR | `docs/features/AR_Invoice/ADR_ar_invoice_is_receivable_only.md` |
| Zero-outstanding AR gate ADR | `docs/features/AR_Invoice/ADR_no_ar_invoice_when_zero_outstanding.md` |
| Changelog | `docs/features/Order_Fin/CHANGELOG.md` |
| Predecessor RESUME (archive) | `docs/features/Order_Fin/bvm_wiring_phase4_close_to_program_end_RESUME.md` |
