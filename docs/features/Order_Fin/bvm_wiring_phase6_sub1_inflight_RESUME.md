# RESUME — BVM Wiring: Phase 6 Sub-item 1 mid-flight → program summary

**Created:** 2026-05-30 (mid-session checkpoint after migration 0332 applied; code/tests/UI not yet written).
**Predecessor:** `docs/features/Order_Fin/bvm_wiring_phase6_to_program_end_RESUME.md` — Phase 6 entry doc. Sub-item 1's migration is now applied; remaining work is code + tests + UI.

This doc is self-contained. After `/clear`, paste the single-line prompt below.

---

## Single-line prompt to paste in the new session

> Read `docs/features/Order_Fin/bvm_wiring_phase6_sub1_inflight_RESUME.md` then load the `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation`, `/i18n`, `/code-documentation`, `/navigation`, `/testing`, `/documentation` skills. Resume at **Phase 6 Sub-item 1 Step 3** (code + UI + tests; migration 0332 already applied). Continue through Sub-items 2–7 in priority order, stopping for user apply on every migration. After every code step, run `cd web-admin && npx tsc --noEmit` filtered to exclude `payment-config|cash-drawers` + the 172/172 baseline sweep (command at bottom of this doc). Append a progress entry to `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` per sub-item. End Phase 6 with its exit checklist + close via the `/documentation` skill writing `docs/features/Order_Fin/bvm_wiring_phase6_implementation.md`. After Phase 6 closes, write `docs/features/Order_Fin/bvm_wiring_program_summary.md` capping the whole program. Production quality only: full EN/AR + RTL, Cmx components, RBAC, multi-tenant safety via `withTenantContext`, no shortcuts.

---

## State at handoff (verified clean — safe to resume cold)

| Thing | Value | Verify command |
|---|---|---|
| Branch | `main` | `git branch --show-current` |
| HEAD | `15385a84 29_05_2026_1 fix order fin and enhance Order Details Page` | `git log -1 --oneline` |
| Working tree | **clean** (Phase 4 + 5 already committed) | `git status --short` |
| Last migration on disk | `0332_phase6_verify_payment_permission_and_action.sql` (**applied by user**) | `Get-ChildItem supabase/migrations/03*.sql \| Sort-Object Name \| Select-Object -Last 3` |
| Next free seq | `0333` | as above |
| Phase 4 | ✅ Done — `bvm_wiring_phase4_implementation.md` |
| Phase 5 | ✅ Done — `bvm_wiring_phase5_implementation.md` |
| Phase 6 Sub-item 1 | 🟡 In progress — migration applied, code/tests/UI pending |
| Phase 6 Sub-items 2–7 | ⏳ Pending |
| tsc (filtered) | **0 errors** (baseline before code edits) |
| Full jest sweep | **172/172 pass** (baseline before code edits) |
| i18n parity | **green** |

### Files touched in this session — only the migration

```
supabase/migrations/0332_phase6_verify_payment_permission_and_action.sql   # NEW, applied
docs/features/Order_Fin/bvm_wiring_phase6_sub1_inflight_RESUME.md          # THIS DOC
```

No code, no tests, no UI written yet — the session was cleared before that started.

---

## Phase 6 Sub-item 1 — Verify-Payment (resume from Step 3)

### What migration 0332 delivered (already done)

- New permission `orders:verify_payment` seeded in `sys_auth_permissions`.
- Role defaults for `super_admin`, `tenant_admin`, `admin`, `branch_manager` (operator intentionally excluded — verify is a finance control).
- `chk_history_action_type` on `org_order_history` extended with the new `PAYMENT_VERIFIED` value.
- Wrapped in `BEGIN/COMMIT`, `DROP … RESTRICT`, idempotent `ON CONFLICT DO NOTHING` + `NOT EXISTS`.
- `DO $$ … $$` validation block raises if anything failed.
- No Prisma regen required (no new tables/columns).

### Step 3 — Remaining work in this sub-item

Implement all of the below in **one atomic Sub-item 1 commit batch**:

#### 3a. Constants — `web-admin/lib/constants/order-financial.ts`

Add `PAYMENT_VERIFIED` to `OUTBOX_EVENT_TYPES`:

```ts
export const OUTBOX_EVENT_TYPES = {
  // …existing…
  /**
   * BVM Wiring — Phase 6 Sub-item 1. Emitted by verifyPaymentTx() after
   * a PENDING REAL_PAYMENT leg is flipped to COMPLETED. The Phase 5
   * order-history consumer translates this into a PAYMENT_VERIFIED row
   * on org_order_history. Aggregate type = 'order_payment'.
   */
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
} as const;
```

DB-mirror invariant: value must be the literal string `'PAYMENT_VERIFIED'` (same as the `chk_history_action_type` enum from migration 0332).

#### 3b. Consumer — `web-admin/lib/services/order-history-consumer.service.ts`

- Add `OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED` to the `HISTORY_EVENT_TYPES` set.
- Add a `case OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED:` in `mapEventToHistoryRow()` that:
  - Looks up the order id from `org_order_payments_dtl` via `aggregate_id = paymentId` (filter on `tenant_org_id`).
  - Returns null if not found (defensive — payment may have been hard-deleted).
  - Writes `action_type: 'PAYMENT_VERIFIED'`, `from_value: 'PENDING'`, `to_value: 'COMPLETED'`, `done_by` from payload `actor_id`/`verified_by`/`user_id`.
- Update the consumer's table-of-events JSDoc to add the new row.

#### 3c. Service — `web-admin/lib/services/order-settlement.service.ts` (or new `payment-verify.service.ts`)

Pick one (recommended: extend `order-settlement.service.ts` — same domain).

```ts
export interface VerifyPaymentParams {
  orderId: string;
  paymentId: string;
  tenantId: string;
  verifiedBy: string;
}

export interface VerifyPaymentResult {
  paymentId: string;
  previousStatus: string;        // 'PENDING'
  newStatus: 'COMPLETED';
  verifiedAt: string;            // ISO
  orderPaymentStatus: string;    // header snapshot after recalc
  outstanding: number;
}

/**
 * Verify a single PENDING REAL_PAYMENT leg → flip to COMPLETED.
 * Idempotent: re-running on a COMPLETED leg returns the same result
 * without re-emitting an outbox event.
 */
export async function verifyPaymentTx(params: VerifyPaymentParams): Promise<VerifyPaymentResult>
```

Required invariants:
- Composite WHERE: `(tenant_org_id, order_id, id)` on `org_order_payments_dtl`.
- `SELECT … FOR UPDATE` the payment row inside the tx.
- Reject if `payment_status` not in `('PENDING','COMPLETED')` (e.g. CANCELLED/FAILED).
- Reject if `payment_nature_snapshot !== 'REAL_PAYMENT'` (credit applications cannot be "verified").
- On PENDING → set `payment_status='COMPLETED'`, `paid_at=now()`, `updated_at=now()`, `updated_by=verifiedBy`.
- After flip: call `recalculateOrderFinancialSnapshotTx(tx, tenantId, orderId)`.
- Emit outbox `PAYMENT_VERIFIED` with `aggregate_type='order_payment'`, `aggregate_id=paymentId`, payload `{ orderId, paymentId, verifiedBy, actor_id: verifiedBy, previousStatus: 'PENDING', newStatus: 'COMPLETED' }`.
- Wrap with `prisma.$transaction`, NOT `withTenantContext` (this is a server-side route service called after `requirePermission` resolves tenant explicitly).
- If the leg is already COMPLETED: return the same result shape but skip the UPDATE and the outbox emit (idempotent no-op). Add a comment explaining why.

#### 3d. Route — `web-admin/app/api/v1/orders/[id]/payments/[paymentId]/verify/route.ts`

Mirror the slug rule: the existing parent is `[id]`. Inside `[id]/payments/`, adding `[paymentId]` is allowed (different segment level). Confirmed pattern in `app/api/v1/orders/[id]/items/[itemId]/...`.

```ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requirePermission('orders:verify_payment')(request);
  if (auth instanceof NextResponse) return auth;
  const { tenantId, userId } = auth;

  const { id: orderId, paymentId } = await params;

  try {
    const result = await verifyPaymentTx({ orderId, paymentId, tenantId, verifiedBy: userId });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment verification failed';
    return NextResponse.json({ success: false, error: message }, { status: 422 });
  }
}
```

JSDoc per `/code-documentation`: file-level block, CSRF rationale inline, permission code inline.

#### 3e. UI — `web-admin/src/features/orders/ui/order-financial/order-payments-credits-tables.tsx`

- Add a new "Verify" column to the real-payments table.
- For PENDING rows: render a `CmxButton` (size `sm`, variant `outline`) labeled with `t('verify')` — opens a `CmxDialog` confirm modal with the order/payment summary, then POSTs to the verify route, then refreshes the financial summary.
- For COMPLETED rows: render a `Badge` with `t('verified')` (variant `success`).
- For any other status: render `t('unverified')` (variant `secondary`).
- Permission guard: hide the Verify button entirely if the user does not have `orders:verify_payment`. Use the existing permission-resolution helper used elsewhere in `src/features/orders` (search for `hasPermission` or `usePermissions`).
- RTL: confirm button alignment via existing `isRTL` pattern.
- The table state refresh on success — invoke whatever `onPaymentsRefresh` / `router.refresh()` pattern the parent uses (check `orders-financial-tab-rprt.tsx`).

#### 3f. i18n — `web-admin/messages/en.json` + `ar.json`

Add under `orders.payments` (search for `orders.detail.financial` first — keys may already cluster there):

| Key | EN | AR |
|---|---|---|
| `orders.payments.verify` | `Verify` | `تحقق` |
| `orders.payments.verifying` | `Verifying…` | `جاري التحقق…` |
| `orders.payments.verified` | `Verified` | `تم التحقق` |
| `orders.payments.unverified` | `Unverified` | `غير محقق` |
| `orders.payments.verifiedBy` | `Verified by {actor}` | `تم التحقق بواسطة {actor}` |
| `orders.payments.verifyConfirmTitle` | `Verify Payment` | `التحقق من الدفعة` |
| `orders.payments.verifyConfirmBody` | `Confirm that this {method} payment for {amount} has cleared. This cannot be undone.` | `أكد أن دفعة {method} بقيمة {amount} قد تم تسويتها. لا يمكن التراجع عن هذا الإجراء.` |
| `orders.payments.verifyError` | `Could not verify payment: {error}` | `تعذر التحقق من الدفعة: {error}` |
| `orders.payments.verifySuccess` | `Payment verified` | `تم التحقق من الدفعة` |

Run `npm run check:i18n` from `web-admin/` after — must stay green.

#### 3g. Tests

Unit — `web-admin/__tests__/services/payment-verify.service.test.ts` (or extend `order-settlement.service.test.ts`):

- PENDING → COMPLETED flips the row, sets paid_at, emits outbox PAYMENT_VERIFIED once.
- COMPLETED → idempotent no-op, no second outbox row.
- CANCELLED/FAILED → rejects with descriptive error.
- Credit application leg (payment_nature_snapshot != REAL_PAYMENT) → rejects.
- Cross-tenant: payment from tenant A with verifiedBy from tenant B → rejects.

Integration — `web-admin/__tests__/integration/verify-payment.test.ts`:

- Full route happy path, snapshot recalculated, history row written by consumer.

Target: bring the sweep from 172/172 → ~178/178. Update the sweep command at the bottom of this doc.

#### 3h. STATUS update

Append a Sub-item 1 entry to `docs/features/Order_Fin/IMPLEMENTATION_STATUS.md` matching the Phase 5 style.

#### 3i. Verify

```powershell
cd F:\jhapp\cleanmatex\web-admin
npx tsc --noEmit 2>&1 | Select-String -NotMatch 'payment-config|cash-drawers' | Select-Object -Last 10
# expect: 0 errors

# Then the updated sweep — see bottom of this doc.
```

---

## Phase 6 Sub-items 2–7 — carry-forward (unchanged from predecessor)

> The text below is verbatim from `bvm_wiring_phase6_to_program_end_RESUME.md` so this doc is fully self-contained.

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
| Driver | `org_payment_methods_cf` carries 4 D9 columns (`payment_nature`, `credit_application_type`, `requires_voucher`, `requires_idempotency`) that are operator-editable per tenant. Improve and enhance the existing ( F:\jhapp\cleanmatex\web-admin\app\dashboard\settings\payments\page.tsx ) UI surface. Phase-1B Stabilization added the Prisma columns (S1), but the operator must SQL-edit. |
| Steps | Already exist navigation entry under settings. Improve existed route `app/dashboard/settings/payments/page.tsx` with `CmxDataTable` + per-row editor (`CmxDialog` + `CmxSelectDropdown`). Improve existed service `lib/services/payment-config.service.ts`. Existed/New API routes `GET/PATCH /api/v1/settings/payments/[code]`. Existed permission `payment_config:manage`. Tenant-level `currency_code` editor (separate sub-section). |
| Tests | Service tests + UI rendering. |
| Migrations | Not needed. |

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
| Steps (only if audit clean) | Migration `0334_voucher_status_collapse.sql` (or whatever the next seq is by then) — drop `status` and `posted_status` columns; ensure `voucher_status` is `NOT NULL` everywhere; recreate any indexes/constraints. **STOP for user apply.** Update Prisma schema + any TypeScript consumer that uses the dropped columns. |
| Risk | High — schema change touches a load-bearing column. Defer if audit surfaces ANY external reader. |

---

## Per-sub-item protocol (apply to every sub-item)

1. **Plan the sub-item** — confirm scope + acceptance criteria.
2. **Load any new skill** the sub-item needs. Skills already loaded by the prompt: `/database`, `/backend`, `/frontend`, `/multitenancy`, `/implementation`, `/i18n`, `/code-documentation`, `/navigation`, `/testing`, `/documentation`.
3. **Implement** with production-ready discipline (no gaps, no shortcuts, full a11y/RTL/i18n where applicable). Constants must DB-mirror exactly. Use `withTenantContext` for every Prisma call on `org_*` tables where session-resolved tenants are appropriate; route handlers that already call `requirePermission` may pass tenant explicitly. Permission codes must follow `resource:action`.
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
- Migration log (0290 → 0333+).
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
# expect: 172/172 pass (baseline before Sub-item 1 code is added)

npm run check:i18n
# expect: i18n parity check passed

git status
# expect: clean (only this RESUME doc + migration 0332 should appear if not yet committed)
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
| Predecessor RESUME (Phase 6 entry — Sub-items 2–7 spec) | `docs/features/Order_Fin/bvm_wiring_phase6_to_program_end_RESUME.md` |
| Predecessor predecessor RESUME (Phase 4 close) | `docs/features/Order_Fin/bvm_wiring_phase4_close_to_program_end_RESUME.md` |
