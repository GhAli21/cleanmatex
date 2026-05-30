# BVM Wiring Phase 6 — Implementation Log

**Date:** 2026-05-30
**Status:** ✅ Shipped (PRD §22.3 + §D9 — Settlement Verify / Invoice Retire / Modal Hardening / D9 Tenant-Override UI / Per-Leg Status / Voucher-Status Audit)
**Predecessor commits:** Phase 5 close (migration 0330, this branch).
**Plan source:** `docs/features/Order_Fin/bvm_wiring_phase6_sub5_onward_RESUME.md` (terminal RESUME, supersedes the earlier `bvm_wiring_phase6_sub1_inflight_RESUME.md` and `bvm_wiring_phase6_to_program_end_RESUME.md`).

---

## Overview

Phase 6 is the BVM-Wiring program's settlement-hardening phase. Where Phases 1A–5 wired the producer side end-to-end (voucher headers + lines + ledger backlinks + outbox events + history timeline), Phase 6 stiffens the **operator-visible settlement surface** and tightens the constants & schemas that drive every BVM downstream:

| Sub-item | Surface affected | Outcome |
|---|---|---|
| **1. Verify-Payment** | API route + history consumer + service + UI table | New `POST /api/v1/orders/[id]/payments/[paymentId]/verify` flips a PENDING `REAL_PAYMENT` leg to COMPLETED, emits `PAYMENT_VERIFIED`, which the Phase 5 consumer translates into a `PAYMENT_VERIFIED` row on `org_order_history`. **Done.** |
| **2. Retire legacy `createInvoice`** | Service layer | The legacy `createInvoice` (and its helpers) deleted; the action becomes a thin shim that translates the legacy payload into the canonical `createArInvoiceFromOrders` writer. ERP-lite blocking-policy semantics preserved through a shared `erp-lite-auto-post.util.ts`. **Done.** |
| **3. Hoist `STORED_VALUE_SUB_IDEMPOTENCY_CODE`** | Constants | Sub-idempotency-key short codes moved out of `order-submit-orchestrator` into `lib/constants/order-financial.ts` as a frozen `Record<CreditApplicationType, …>` so other services / reconciliation / replay tooling can derive the same key shape. **Done.** |
| **4. Payment Modal v4 hardening** | Modal utils + Zod messages | Added `validateCheckDueDate` + `todayYyyyMmDd` (CHECK rule) and `buildGatewayReturnState` / `parseGatewayReturnState` (HYPERPAY redirect envelope). 6 new unit tests; 2 new i18n keys. **Done.** |
| **5. Payment Method settings UI (D9 toggles)** | Tenant settings dialog + Zod schema + action | Surfaces 5 D9 tenant-override columns (`settlement_type_code`, `credit_application_type`, `default_creation_status`, `allow_status_override`, `is_user_id_required`) inside the existing method-config dialog. Tri-state dropdown pattern with pure round-trip helpers + 14 helper tests. **Done.** |
| **6. `paymentStatus` on `paymentLegSchema`** | Schema + planner + settler + server-side CHECK rule | Closes Phase-1B B7 by giving callers an explicit per-leg `paymentStatus` channel; the planner honors `'PENDING'` over the gateway / D9 fallback. The CHECK due-date helper is hoisted into `lib/utils/check-date.ts` and consumed by a Zod `.superRefine` so the same rule fires on the server. 3 new planner tests + 8 new schema tests. **Done.** |
| **7. Voucher status triple-column collapse** | DB column + TS readers | **DEFERRED.** Pre-flight audit found 0 view/function readers but the TypeScript voucher services still read the legacy `status` column. The drop requires a coordinated TS refactor that exceeds the safe Phase 6 envelope. Recorded as the headline follow-up. |

No new permissions, no new navigation, no new feature flag. Two new migrations during the phase (`0332_phase6_verify_payment_permission_and_action.sql` from Sub-item 1; Sub-item 7's deferral means `0333` is **not** created). One new outbox event type seeded into the existing `OUTBOX_EVENT_TYPES` constant (`PAYMENT_VERIFIED`).

---

## Requirements

- [x] Operators can verify a PENDING `REAL_PAYMENT` leg (CHECK / BANK_TRANSFER) from the order-detail financial table; verification is a single-button, RBAC-gated action.
- [x] Verification flips the leg's `payment_status` to COMPLETED, sets `paid_at`, captures `received_by`, and emits `PAYMENT_VERIFIED` so the history timeline picks it up automatically (no per-feature consumer plumbing).
- [x] Legacy `createInvoice` is fully retired — every code path that previously created an order-scoped invoice now flows through `createArInvoiceFromOrders`. ERP-lite BLOCKING semantics preserved.
- [x] Stored-value sub-idempotency-key short codes live in `lib/constants/order-financial.ts` as the single source of truth.
- [x] Payment Modal v4 prevents backdated CHECK due-dates at the client AND the server (Zod refine).
- [x] Payment-method settings dialog exposes the 5 D9 tenant-override columns with tri-state "inherit" semantics.
- [x] `paymentLegSchema` exposes a `paymentStatus` field that the planner and `settleOrder` honor; existing callers (which never set the field) are unaffected.
- [x] Every Prisma write enforces tenant context via `withTenantContext`.
- [x] All EN/AR i18n keys present; `check:i18n` green.
- [x] `npx tsc --noEmit` = **0 errors** (full, unfiltered).
- [x] Full jest sweep = **221/221 pass** (196 baseline end-of-Sub-item-4 + 14 D9 helpers + 3 planner B7 + 8 leg-schema).
- [x] Sub-item 7 deferral documented with the exact pre-flight evidence so a future phase can resume without rerunning the audit.

---

## Database Schema

### Migration 0332 — `0332_phase6_verify_payment_permission_and_action.sql` (Sub-item 1)

| Change | Detail |
|---|---|
| Permission seed | Insert `order_payments:verify` into `sys_auth_permissions`. Idempotent via `ON CONFLICT (code) DO NOTHING`. |
| Role grants | `NOT EXISTS` insert into `sys_auth_role_default_permissions` for `super_admin`, `tenant_admin`, `admin`, `operator`. Cashier-tier roles excluded by design (verification is a back-office function). |
| CHECK extension | `chk_history_action_type` extended with `PAYMENT_VERIFIED` so the Phase-5 history consumer can write the new row type without violating the constraint. Drop uses `RESTRICT` (CHECK constraints have no dependents). |

**No new tables, no new columns, no new indexes.** Sub-item 1's API + consumer are purely additive on existing structures (`org_order_payments_dtl`, `org_domain_events_outbox`, `org_order_history`).

### No migration from Sub-items 2 / 3 / 4 / 5 / 6

Pure code, pure constants, pure validation. The D9 settings dialog (Sub-item 5) consumes columns added by Phase-1B Stabilization migration 0325 — no new DDL required.

### Sub-item 7 — no migration on disk

The pre-flight audit blocked the drop; the migration was never written. Next free seq remains `0333` for the follow-up program.

---

## API Endpoints

### Sub-item 1 — `POST /api/v1/orders/[id]/payments/[paymentId]/verify`

**Request:** No body. `:id` and `:paymentId` come from the URL.

**Response (success):**
```json
{ "success": true, "data": { "payment_status": "COMPLETED", "paid_at": "2026-05-30T08:14:22.000Z" } }
```

**Response (failures):**
- `404` — payment not found for this `(tenant_org_id, order_id, paymentId)` triple.
- `409` — payment already `COMPLETED` or `payment_nature_snapshot != REAL_PAYMENT`.
- `403` — caller lacks `order_payments:verify`.

The route uses the existing `withTenantContext` + `getAuthContext` plumbing. Verification side-effects run inside a single Prisma transaction:

1. `org_order_payments_dtl` row UPDATEd (status, `paid_at`, `received_by`, audit cols).
2. `emitEventTx('PAYMENT_VERIFIED', { aggregate_id: paymentId, aggregate_type: 'order_payment', payload: { order_id, payment_method_code, amount, currency_code, paid_at, received_by } })`.
3. Caller receives the updated leg snapshot for optimistic UI.

The Phase-5 outbox worker eventually picks up the event and calls `consumeOrderHistoryEvent`, which writes a `PAYMENT_VERIFIED` row on `org_order_history` via the idempotent upsert path documented in `bvm_wiring_phase5_implementation.md`. No new consumer plumbing.

### No new routes from Sub-items 2 / 3 / 4 / 5 / 6 / 7

---

## UI Components

### Sub-item 1 — `order-payments-credits-tables.tsx` extension

`OrderPaymentsCreditsTables` (existing, mounted inside the order-detail financial section) gets a Verify button on every PENDING `REAL_PAYMENT` row:

- Disabled when `status !== 'PENDING'` or `payment_nature_snapshot !== 'REAL_PAYMENT'`.
- Hidden when the user lacks `order_payments:verify`.
- Confirmation `CmxDialog` shows a localized question and the leg amount; submit posts to the API and triggers the order-detail refetch.

### Sub-item 5 — `payment-method-config-dialog.tsx` new BVM Routing card

A new Cmx card section ("BVM Routing") sits between the existing "Behavior" and "Limits & Fees" cards. Controls:

| Field | Control | Inherit value |
|---|---|---|
| `settlement_type_code` | `CmxSelectDropdown` (4 options + Inherit) | `null` |
| `credit_application_type` | `CmxSelectDropdown` (5 options + Inherit) — only rendered when `payment_nature === 'CREDIT_APPLICATION'` | `null` |
| `default_creation_status` | `CmxSelectDropdown` (PENDING / COMPLETED + Inherit) | `null` |
| `allow_status_override` | Tri-state `CmxSelectDropdown` (Yes / No + Inherit) using `common.yes` / `common.no` | `null` |
| `is_user_id_required` | Same tri-state pattern | `null` |

Empty-string in the form layer round-trips to `null` in persistence via the helpers shipped under `src/features/payment-config/ui/d9-routing-helpers.ts`. The dialog stays RTL-aware via the Cmx primitives.

### No UI changes from Sub-items 2 / 3 / 4 / 6 / 7

Sub-item 4 *did* touch `payment-modal-v4.tsx` (CHECK due-date `min` attr + inline error), but the surface is the existing v4 modal — no new components were added.

---

## Business Logic

### Sub-item 1 — verify-payment flow

```
Operator clicks Verify on a PENDING CHECK leg
  → POST /api/v1/orders/[id]/payments/[paymentId]/verify
  → verifyPaymentTx(tenantId, orderId, paymentId, userId)   [server-side, withTenantContext]
       UPDATE org_order_payments_dtl SET payment_status='COMPLETED', paid_at=NOW(), received_by=:userId
       emitEventTx PAYMENT_VERIFIED, aggregate=order_payment
  → Phase-5 worker picks up the event
       consumeOrderHistoryEvent(PAYMENT_VERIFIED)
       UPSERT org_order_history { action_type='PAYMENT_VERIFIED', tenant_org_id_outbox_event_id }
  → Order timeline rerenders with a new "Payment Verified" row (icon: ShieldCheck, color: green-700)
```

### Sub-item 2 — `createInvoice` retirement

Before: two parallel writers (`createInvoice` legacy + `createArInvoiceFromOrders` canonical) → divergent ERP-lite behaviour. After: a single canonical writer; the legacy entry point becomes a 12-line shim that translates the legacy `CreateInvoiceInput` shape into the canonical `{ order_ids: [order_id], invoice_date: today, due_date: caller-provided | today, allocation_policy: 'REMAINING_ONLY', issueImmediately: true, idempotency_key: 'legacy_action_<orderId>' }`. The ERP-lite BLOCKING-policy guard is now in a shared util `erp-lite-auto-post.util.ts` imported by both `ar-invoice.service.ts` and (via the shim) `invoice-actions.ts`.

### Sub-item 6 — explicit per-leg `paymentStatus`

```
Request leg {
  method: 'CHECK',
  amount: 100,
  checkNumber: 'CHK001',
  checkDate: '2026-06-15',
  paymentStatus: 'PENDING'   ← NEW (optional)
}
  → paymentLegSchema parses (CHECK refine accepts future date; paymentStatus enum accepted)
  → orchestrator builds settlementLegs with leg.paymentStatus forwarded onto ResolvedSettlementLeg
  → buildSettlementPlan resolves status:
        explicit 'PENDING' → 'PENDING'
        explicit 'COMPLETED' or undefined → defaultCreationStatus
            ↳ D9 override > gateway fallback > CASH/CARD → COMPLETED, else PENDING
  → BVM voucher line carries the explicit status onto org_order_payments_dtl.payment_status
  → Subsequent Verify-Payment (Sub-item 1) can later flip PENDING → COMPLETED
```

Backwards compatibility: every existing caller that never sets `paymentStatus` continues to use the gateway-driven path verbatim. The Zod field is `.optional()` (no `.default('COMPLETED')`), so `PaymentLeg.paymentStatus` stays optional and the many `paymentLegs` literals at call sites continue to compile.

### Sub-item 6 — CHECK due-date server-side enforcement

```
paymentLegSchema.superRefine(leg, ctx) {
  if (leg.method !== 'CHECK' || !leg.checkDate) return;
  const reason = validateCheckDueDate(leg.checkDate);   // shared lib/utils/check-date.ts
  if (reason) ctx.addIssue({ code: custom, message: reason, path: ['checkDate'] });
}
```

Same function powers the client modal error (Sub-item 4). The `.message` is the i18n key suffix (`'checkDateInPast'` / `'checkDateInvalid'`), so callers that surface Zod errors in the locale layer get the right copy automatically.

---

## Testing

| Test ID | File | Scenario |
|---|---|---|
| T-VRF-1..6 | `__tests__/services/verify-payment.service.test.ts` | Sub-item 1: happy path, idempotency on already-COMPLETED, non-REAL_PAYMENT rejection, missing leg, RLS cross-tenant, outbox event emitted with correct shape. |
| T-HIST-PV1..2 | `__tests__/services/order-history-consumer.service.test.ts` | Sub-item 1: `PAYMENT_VERIFIED` event → history row with `aggregate_type=order_payment`; cross-tenant isolation. |
| T-MOD-CHECK1..4 | `__tests__/features/orders/payment-modal-v4.utils.test.ts` | Sub-item 4: `validateCheckDueDate` happy / past / non-parseable / empty + gateway-state round-trip + malformed envelope. |
| T-D9-1..14 | `__tests__/features/payment-config/d9-routing-helpers.test.ts` | Sub-item 5: every `triStateToBoolean` / `booleanToTriState` / `nullableStringToFormValue` / `formStringToNullable` direction + round-trip invariants. |
| T-PLN-B7-1..3 | `__tests__/services/order-settlement-planner.service.test.ts` | Sub-item 6: explicit `'PENDING'` overrides COMPLETED fallback; explicit `'COMPLETED'` preserves COMPLETED path; explicit `'COMPLETED'` does NOT downgrade a gateway PROCESSING leg. |
| T-LEG-1..8 | `__tests__/validations/payment-leg-schema.test.ts` | Sub-item 6: default-omission + enum acceptance + unknown-value rejection + CHECK refine acceptance / past / non-parseable / no-checkDate / non-CHECK ignore. |

**Total sweep: 221/221 pass** (196 baseline end-of-Sub-item-4 + 14 D9 + 3 planner B7 + 8 schema). No regressions.

### Acceptance scenarios for manual QA

1. **Cash submit on a no-gateway leg without explicit `paymentStatus`** → leg persists with `payment_status='COMPLETED'`. Verify button is hidden (no PENDING leg).
2. **Cash submit on a HYPERPAY leg without explicit `paymentStatus`** → leg persists with `payment_status='PENDING'` (gateway-driven). Verify button appears after gateway redirect resolves to `PENDING`.
3. **CHECK leg with `paymentStatus='PENDING'` + future due date** → submit accepted; leg persists PENDING; operator later clicks Verify (Sub-item 1) → leg flips to COMPLETED; timeline picks up `PAYMENT_VERIFIED` row.
4. **CHECK leg with a past due date** → Zod refine rejects with `'checkDateInPast'` whether the client validates first or not (server enforces). Modal shows the localized error.
5. **Operator opens the payment-method config dialog for CASH** → BVM Routing card shows "Inherit (platform default)" for every D9 field. Selecting `settlement_type_code = 'PAY_IN_ADVANCE'` and saving persists the override.
6. **Operator opens the dialog for HYPERPAY** → BVM Routing card shows the `credit_application_type` row hidden (only renders for `payment_nature === 'CREDIT_APPLICATION'`).
7. **Operator changes `allow_status_override` from Inherit → No, saves, reopens** → dropdown shows "No" with the persisted boolean override.
8. **Order with a verified payment, viewed by an Arabic operator** → timeline row renders the AR copy for `PAYMENT_VERIFIED`; existing RTL flow unaffected.

---

## Implementation Status

- [x] Sub-item 1 — Verify-Payment shipped (migration 0332 + route + service + UI + i18n + tests).
- [x] Sub-item 2 — Legacy `createInvoice` retired; shim covers backward compatibility.
- [x] Sub-item 3 — `STORED_VALUE_SUB_IDEMPOTENCY_CODE` hoisted to constants module.
- [x] Sub-item 4 — Payment Modal v4 CHECK + gateway helpers shipped with 6 new tests.
- [x] Sub-item 5 — D9 tenant-override UI shipped with 14 new helper tests + 19 new i18n leaf keys.
- [x] Sub-item 6 — `paymentStatus` on `paymentLegSchema` + planner + settler + server-side CHECK refine shipped with 11 new tests.
- [x] Sub-item 7 — Audited and deferred with documented evidence; no migration on disk.
- [x] Phase 6 exit checklist (tsc + sweep + i18n + nav-parity + permission-parity) — green.
- [x] IMPLEMENTATION_STATUS.md updated with one entry per sub-item.
- [x] This document.
- [x] Program summary doc (next).

---

## Feature Implementation Requirements

### Permissions

- `order_payments:verify` — seeded by migration 0332. Granted to `super_admin`, `tenant_admin`, `admin`, `operator`. Used as the RBAC gate on the verify-payment route, the Verify button visibility, and the action server-side.

### Navigation Tree

- **None added.** Sub-item 1 reuses the existing order-detail route. Sub-item 5 extends an existing dialog inside the existing payment-settings page.

### Tenant Settings

- **None added.** Sub-item 5 surfaces five D9 columns that already exist as tenant-scoped overrides on `org_payment_methods_cf` (added in Phase-1B mig 0325).

### Feature Flags

- **None.** Phase 6 is a hard-cut. Existing data is unaffected — the `paymentStatus` field is optional, the D9 columns default to `NULL` (inherit), and the verify endpoint only acts on PENDING legs.

### Plan Limits

- **None changed.**

### i18n Keys

| Key | EN | AR |
|---|---|---|
| `orders.detail.financial.verify.*` | verify-payment UI strings (Sub-item 1) | parity |
| `orders.new.splitPayment.checkDateInvalid` | `Enter a valid date` | `أدخل تاريخاً صحيحاً` |
| `orders.new.splitPayment.checkDateInPast` | `Check date cannot be in the past` | `تاريخ الشيك لا يمكن أن يكون في الماضي` |
| `orders.timeline.actions.paymentVerified` | `Payment Verified` | `تم التحقق من الدفع` |
| `paymentConfig.methods.sections.bvmRouting` | `BVM Routing` | `توجيه BVM` |
| `paymentConfig.methods.settlementTypeCode` | `Settlement type override` | `تجاوز نوع التسوية` |
| `paymentConfig.methods.creditApplicationType` | `Credit application type` | `نوع تطبيق الاعتماد` |
| `paymentConfig.methods.defaultCreationStatus` | `Default creation status` | `الحالة الافتراضية عند الإنشاء` |
| `paymentConfig.methods.allowStatusOverride` | `Allow status override` | `السماح بتجاوز الحالة` |
| `paymentConfig.methods.isUserIdRequired` | `User ID required` | `معرف المستخدم مطلوب` |
| `paymentConfig.methods.inheritFromPlatform` | `Inherit (platform default)` | `وراثة (الافتراضي المنصة)` |
| `paymentConfig.methods.settlementTypeCodes.*` (4 keys) | localized settlement type names | parity |
| `paymentConfig.methods.creditApplicationTypes.*` (5 keys) | localized credit application names | parity |
| `paymentConfig.methods.creationStatuses.{PENDING,COMPLETED}` | `Pending` / `Completed` | `معلّق` / `مكتمل` |

`check:i18n` green at every checkpoint.

### API Routes

- `POST /api/v1/orders/[id]/payments/[paymentId]/verify` (Sub-item 1, NEW).
- No other routes added or modified.

### Migrations

- `supabase/migrations/0332_phase6_verify_payment_permission_and_action.sql` (applied during Sub-item 1).
- Sub-item 7's `0333_voucher_status_collapse.sql` **NOT written** — deferred.

### Constants & Types

| Location | Change |
|---|---|
| `lib/constants/order-financial.ts` | Added `OUTBOX_EVENT_TYPES.PAYMENT_VERIFIED` (Sub-item 1) and `STORED_VALUE_SUB_IDEMPOTENCY_CODE` + `StoredValueSubIdempotencyCode` (Sub-item 3). |
| `lib/types/order-financial.ts` | `ResolvedSettlementLeg.paymentStatus?` added (Sub-item 6). |
| `lib/types/payment.ts` | `OrgPaymentMethodConfig` + `CreatePaymentMethodConfigInput` extended with 5 D9 raw fields (Sub-item 5). |
| `lib/validations/new-order-payment-schemas.ts` | `paymentLegSchema.paymentStatus?` + `.superRefine` for CHECK due date (Sub-item 6). |
| `src/features/payment-config/model/payment-method-config-schema.ts` | 5 new D9 fields on the base schema (Sub-item 5). |
| `lib/utils/check-date.ts` | NEW. Shared check-date helpers (Sub-item 6). |
| `src/features/payment-config/ui/d9-routing-helpers.ts` | NEW. Pure tri-state round-trip helpers (Sub-item 5). |
| `src/features/orders/ui/payment-modal-v4.utils.ts` | CHECK helpers re-exported from `lib/utils/check-date` (Sub-item 6 follow-on to Sub-item 4). |

### Environment Variables

- **None added.**

### Dependencies

- **None added.** Every new import comes from existing modules / Cmx primitives.

### Logging

- Verify-payment route logs structured failures (`tenantId`, `userId`, `paymentId`, `reason`) through the centralized `logger`. Success path is silent (the outbox + history layers carry the audit trail).

### Metrics

- Verify event volume is observable through `org_domain_events_outbox` filtered by `event_type='PAYMENT_VERIFIED'`. No new dedicated metric.

---

## Verification Matrix (final, post-Phase-6)

| Check | Command | Result |
|---|---|---|
| TypeScript (full) | `cd web-admin; npx tsc --noEmit` | **0 errors** |
| Full jest sweep | (16-file sweep, see Quick sanity test at bottom of the RESUME doc + d9 + leg-schema additions) | **221/221 pass** |
| i18n parity | `npm run check:i18n` | **green** |
| Prisma | `npx prisma generate` | **clean** (no schema changes after Sub-item 1 / Phase 5) |
| Migration on disk | `0332_phase6_verify_payment_permission_and_action.sql` | **applied by user during Sub-item 1** |
| Sub-item 7 audit | `pg_depend`/`pg_proc` queries via Supabase MCP | **0 view/function readers**; TS-layer readers documented under IMPLEMENTATION_STATUS.md → Sub-item 7 |

---

## Risks & Mitigations

| Risk | Status | Mitigation |
|---|---|---|
| Operator verifies the wrong leg (typo on paymentId) | closed | Route filters `where: { id: paymentId, order_id: orderId, tenant_org_id: tenantId }`. 404 on miss, no double-tenant exposure. |
| Verify is replayed (network retry) | closed | Route is idempotent — second call sees `payment_status='COMPLETED'` and returns 409 with the existing snapshot. Outbox dedup via the partial unique idx from Phase 5. |
| Explicit `paymentStatus='COMPLETED'` from a malicious / buggy client downgrades a HYPERPAY leg | closed | Planner gate: only `'PENDING'` bypasses the gateway/D9 fallback. Test T-PLN-B7-3 pins this. |
| Past-dated CHECK reaches the BVM voucher tx | closed | Server-side Zod refine fires before the orchestrator; rejected with localized `'checkDateInPast'`. |
| Operator picks an invalid D9 combination (e.g. `settlement_type_code='CREDIT_INVOICE'` on a CASH method) | tracked, low | Existing `org_payment_methods_cf` business rules enforced at runtime by the planner; the dialog gives operators direct visibility so misconfiguration is now easy to spot and self-correct. A future hardening could add cross-field warnings in the dialog. |
| `voucher.status` reads diverge from `voucher_status` over time | open (Sub-item 7 deferral) | Documented headline follow-up. Phase 4 reconciliation `VOUCHER_TOTAL_EQUALS_LINES` indirectly catches the worst divergences; an explicit `voucher.status === voucher.voucher_status` reconciliation check would close it pre-collapse. |
| Phase 6 doc drift (Sub-item 7 audit forgotten by the next program) | closed | The audit query SQL and TS-reader scan results are reproduced verbatim in IMPLEMENTATION_STATUS.md → Sub-item 7 so the next program can re-run without re-deriving. |

---

## Rollback Strategy

1. **Code revert per sub-item** — every sub-item lives in its own commit-shaped change set (route + service + UI + i18n + tests for Sub-item 1; pure code for Sub-items 2–6). `git revert <sub-item-commit>` is safe in isolation; ordering not strict.
2. **DB rollback (only if codespace and DB schema diverge):**
   - Sub-item 1's permission seed: `DELETE FROM sys_auth_role_default_permissions WHERE permission_code='order_payments:verify'; DELETE FROM sys_auth_permissions WHERE code='order_payments:verify';` plus re-issue the prior `chk_history_action_type` CHECK without `PAYMENT_VERIFIED`. Any consumer-written history rows would then violate the constraint — clean those up first.
3. **Forward-fix (preferred)** — for production data, fix-forward via a follow-up migration that adjusts the affected rows; do not roll back schema after operator activity.

---

## Follow-ups (Program Summary candidates)

1. **Sub-item 7** — Voucher status triple-column collapse (deferred). See IMPLEMENTATION_STATUS → Sub-item 7 for the 4-step plan and the pre-flight evidence package.
2. **HYPERPAY redirect envelope wiring** — Sub-item 4 shipped `buildGatewayReturnState` / `parseGatewayReturnState` as unit-tested helpers; the actual `payment-modal-v4.tsx` redirect handler still needs to consume them. Belongs in a payment-gateway hardening pass.
3. **D9 cross-field warning hints in the settings dialog** — Sub-item 5 surfaces the raw fields; a future iteration can warn when the combination contradicts the platform default (e.g. CASH method with `settlement_type_code='CREDIT_INVOICE'`).
4. **Per-order `AR_INVOICE_LINKED` sub-events** — carried forward from Phase 5; still open. Would close the multi-order AR-invoice silent-skip path documented in Phase 5 §SKIPPED_NOT_ORDER_LINKED.

---

## References

- Phase 5 implementation log: `bvm_wiring_phase5_implementation.md`
- Phase 4 implementation log: `bvm_wiring_phase4_implementation.md`
- BVM Wiring PRD: `CleanMateX_Business_Voucher_Wiring_PRD_v2_1_Ready_For_Implementation.md` §§22.3, D9
- Active RESUME (this phase): `bvm_wiring_phase6_sub5_onward_RESUME.md`
- Predecessor RESUME (Sub-item 1 mid-flight, archive): `bvm_wiring_phase6_sub1_inflight_RESUME.md`
- Entry RESUME (Sub-item 1 un-started, archive): `bvm_wiring_phase6_to_program_end_RESUME.md`
- Phase-1B D9 column source (`org_payment_methods_cf` D9 columns): mig `0325_payment_methods_d9_overrides.sql`
- Verify-payment surface (Sub-item 1): mig `0332_phase6_verify_payment_permission_and_action.sql`
- Order Financial constants: `lib/constants/order-financial.ts`
- Payment Modal v4 utils: `src/features/orders/ui/payment-modal-v4.utils.ts`
- Shared check-date helpers (Sub-item 6 extraction): `lib/utils/check-date.ts`
- Order History consumer (extended by Sub-item 1): `lib/services/order-history-consumer.service.ts`
