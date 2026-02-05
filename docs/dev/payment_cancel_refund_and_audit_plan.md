# Payment Cancel, Refund & Audit History — Implementation Plan

**Goal:** Implement cancel and refund of payment following best practices, and add a payments audit history that records all changes with before/after values.

**References:** Existing cancel flow (`cancelPayment` service, `cancelPaymentAction`, `cancel-payment-dialog`), existing `refundPayment` service, order history pattern (`org_order_history`), price audit pattern (`org_price_history_audit`).

---

## Part 1: Cancel Payment (Harden & Align)

Cancel is already implemented. This phase tightens validation, permissions, and audit integration.

### 1.1 Current state
- **Service:** `cancelPayment(paymentId, reason, cancelledBy)` in `payment-service.ts` — atomic transaction, reverses invoice/order.
- **Action:** `cancelPaymentAction` — checks `payments:cancel`, validates reason.
- **UI:** Cancel button on list + detail, `cancel-payment-dialog.tsx`.

### 1.2 Best-practice refinements
| Item | Action |
|------|--------|
| **Idempotency** | Already safe: "already cancelled" returns error. No change. |
| **Validation** | Reason min/max in `cancelPaymentSchema` — already present. |
| **Permission** | Already gated by `payments:cancel` server-side. |
| **Audit** | **Add:** After successful cancel, insert one row into payment audit table (see Part 3). |
| **Reversals** | Already updates invoice `paid_amount`/`status` and order `paid_amount`/`payment_status` in same transaction. |

### 1.3 Implementation (minimal)
- After Part 3 (audit table) is done: inside `cancelPayment` (within the same `$transaction`), call audit helper to insert one record: `action_type = 'CANCELLED'`, `before_value` = snapshot of payment (and optionally invoice/order affected fields), `after_value` = cancelled state + reason.

---

## Part 2: Refund Payment (Full Flow)

Refund exists only at service level. Add action, validation, permission, UI, and audit.

### 2.1 Refund rules (best practice)
- **Partial refund:** Amount &lt; original payment; original transaction stays `completed`; new row with negative `paid_amount`, status `refunded` (or link to original).
- **Full refund:** Amount = original; optionally mark original as `refunded` or keep as-is and rely on refund row.
- **Validation:** Amount &gt; 0, amount ≤ original `paid_amount`, transaction exists and is `completed` (not already cancelled/refunded).
- **Permission:** New permission `payments:refund` (or reuse `payments:cancel` — recommend separate `payments:refund`).
- **Idempotency:** Same refund (same transaction_id + amount + reason) could be deduplicated by business key if needed later; v1 can allow multiple partial refunds up to original amount.

### 2.2 Service layer (`payment-service.ts`)

| Task | Detail |
|------|--------|
| **Reject non-completed** | In `refundPayment`, reject if `transaction.status` is not `completed` (e.g. already refunded/cancelled). |
| **Use transaction** | Wrap refund + invoice/order updates in `prisma.$transaction` so all-or-nothing. |
| **Invoice reversal** | Already decreases `invoice.paid_amount`; recalc `status` (pending/partial/paid). |
| **Order reversal** | **Add:** If original payment has `order_id`, decrease `org_orders_mst.paid_amount` and recalc `payment_status` (same as cancel). |
| **Original status** | Option A: Leave original row as `completed`. Option B: If refund amount = original amount, set original `status = 'refunded'`. Recommend Option A for traceability; keep refund as separate row. |
| **Audit** | After Part 3: insert audit row for `REFUNDED` with before/after snapshots. |

### 2.3 Validation schema

**New/update:** `web-admin/lib/validations/payment-crud-schemas.ts` (or refund-specific schema)

- `refundPaymentSchema`: `transaction_id` (UUID), `amount` (positive number), `reason` (string, min 1, max 500).
- Export type `RefundPaymentFormInput`.

### 2.4 Server action

**New:** `web-admin/app/actions/payments/refund-payment-action.ts` (or add in `payment-crud-actions.ts`)

- `refundPaymentAction(transactionId, amount, reason)`:
  - `getAuthContext()`; require `tenantId` and `userId`.
  - Check permission `payments:refund` (e.g. via `hasPermissionServer('payments:refund')`).
  - Parse input with `refundPaymentSchema`.
  - Call `refundPayment({ transaction_id, amount, reason, processed_by: userId })`.
  - On success: `revalidatePath` for `/dashboard/billing/payments`, `/dashboard/billing/payments/[id]`, `/dashboard/billing/invoices`, `/dashboard/orders`.
  - Return `{ success, error?, refund_transaction_id? }`.

### 2.5 Permission

**New migration:** `supabase/migrations/[NEXT_SEQ]_add_payments_refund_permission.sql`

- Insert `payments:refund` into `sys_auth_permissions` (code, name, category, description).
- Assign to `tenant_admin` and `super_admin` in `sys_auth_role_default_permissions`.
- Pattern: same as `payments:cancel` (e.g. 0095).

### 2.6 UI

| Component | Purpose |
|-----------|--------|
| **Refund dialog** | **New:** `web-admin/app/dashboard/billing/payments/components/refund-payment-dialog.tsx`. Fields: amount (number, max = original amount), reason (required textarea). Submit → `refundPaymentAction`. Show loading and success/error toast. |
| **Detail page** | In `payment-detail-client.tsx`: add "Refund" button (only when status is `completed` and amount &gt; 0). Wrap in `<RequirePermission resource="payments" action="refund">`. Open refund dialog with current payment id and `paid_amount`. |
| **List page** | In `payments-table.tsx`: add "Refund" action in actions column (same visibility as Refund button on detail). Optional: open same dialog with payment id and amount. |
| **i18n** | Add keys under `payments.refund.*`: title, amountLabel, amountPlaceholder, reasonLabel, reasonPlaceholder, submit, cancelling, cancel, success, error, permissionDenied, maxRefund. EN + AR. |

### 2.7 Refund service fixes (concrete)

- In `refundPayment`:
  - Add guard: if `transaction.status !== 'completed'`, return error (e.g. "Only completed payments can be refunded").
  - Wrap entire logic (find transaction, create refund row, update invoice, **and update order if order_id present**) in `prisma.$transaction`.
  - For order: same as cancel — `findUnique` order by `transaction.order_id`, compute new `paid_amount` and `payment_status`, `update` order.

---

## Part 3: Payments Audit History

### 3.1 Design principles
- **Immutable log:** Append-only; no updates/deletes.
- **Before/after:** Every record stores a snapshot (or field-level diff) of "before" and "after" for the entity affected.
- **Tenant-scoped:** All rows with `tenant_org_id`; RLS on tenant.
- **Action types:** Explicit enum-like set (e.g. CREATED, CANCELLED, REFUNDED, NOTES_UPDATED, STATUS_CHANGE) so reporting is simple.

### 3.2 Audit table (DB)

**New migration:** `supabase/migrations/[NEXT_SEQ]_create_org_payment_audit_log.sql`

**Table name:** `org_payment_audit_log` (max 30 chars: 22 — OK).

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID, PK, default gen_random_uuid() | |
| `tenant_org_id` | UUID, NOT NULL, FK org_tenants_mst | |
| `payment_id` | UUID, NOT NULL, FK org_payments_dtl_tr(id) | Payment transaction that was changed (or the new refund row for REFUNDED) |
| `action_type` | VARCHAR(30), NOT NULL | CREATED, CANCELLED, REFUNDED, NOTES_UPDATED, etc. |
| `before_value` | JSONB | Snapshot of relevant fields before change (e.g. status, paid_amount, rec_notes, invoice_id, order_id). For CREATED, null or {}. |
| `after_value` | JSONB | Snapshot after change. For REFUNDED, include refund_transaction_id, refund_amount. |
| `changed_by` | VARCHAR(120) | User id or identifier |
| `changed_at` | TIMESTAMPTZ, default now() | |
| `metadata` | JSONB, optional | Reason, IP, user agent, etc. |

**Indexes:**
- `(tenant_org_id, payment_id)` — list history for one payment.
- `(tenant_org_id, changed_at DESC)` — recent activity.

**RLS:** Same pattern as other org_* tables: policy on `tenant_org_id = current_setting('app.current_tenant_id', true)::uuid` for SELECT/INSERT (and no UPDATE/DELETE).

**Comments:** Comment table and columns (action_type enum description, before_value/after_value purpose).

### 3.3 Action types (canonical list)

| action_type | When | before_value | after_value |
|-------------|------|--------------|-------------|
| `CREATED` | recordPaymentTransaction create | {} or null | New payment row (id, status, paid_amount, invoice_id, order_id, ...) |
| `CANCELLED` | cancelPayment | Payment + linked invoice/order paid amounts | status=cancelled, rec_notes=reason, invoice/order updated amounts |
| `REFUNDED` | refundPayment | Original payment row + invoice/order paid | New refund row id, amount, invoice/order new paid_amount |
| `NOTES_UPDATED` | updatePaymentNotes | { rec_notes: old } | { rec_notes: new } |
| (Future) | Status change, link/unlink | As needed | As needed |

### 3.4 Application layer: audit helper

**New:** `web-admin/lib/services/payment-audit.service.ts` (or `payment-audit.ts`)

- `recordPaymentAudit(params: { tenantId, paymentId, actionType, beforeValue, afterValue, changedBy, metadata? })`.
- Single responsibility: build insert payload and call `prisma.org_payment_audit_log.create`.
- Use from:
  - `recordPaymentTransaction`: after create, call with action_type `CREATED`, after_value = snapshot of created row.
  - `cancelPayment`: inside transaction, after update, call with `CANCELLED`, before = snapshot before update, after = snapshot after + reason in metadata.
  - `refundPayment`: inside transaction, after creating refund row and updating invoice/order, call with `REFUNDED`, before = original payment + invoice/order paid, after = refund row id + new amounts.
  - `updatePaymentNotes`: after update, call with `NOTES_UPDATED`, before/after = { rec_notes }.

**Snapshot shape:** Keep JSON small but sufficient. Example for payment: `{ id, status, paid_amount, invoice_id, order_id, rec_notes, updated_at }`. For invoice/order reversals, store only `invoice_id`/`order_id` and `paid_amount` (and status if desired) in a nested object inside before_value/after_value.

### 3.5 Prisma schema

Add model `org_payment_audit_log` with fields matching migration (id, tenant_org_id, payment_id, action_type, before_value, after_value, changed_by, changed_at, metadata). Relation to `org_payments_dtl_tr` and `org_tenants_mst`.

### 3.6 Where to call audit (summary)

| Location | Action | When |
|----------|--------|------|
| `recordPaymentTransaction` | CREATED | After `org_payments_dtl_tr.create` |
| `cancelPayment` | CANCELLED | Inside `$transaction`, after payment update |
| `refundPayment` | REFUNDED | Inside `$transaction`, after refund row + invoice/order updates |
| `updatePaymentNotes` | NOTES_UPDATED | After `org_payments_dtl_tr.update` |

---

## Part 4: UI for Audit History

### 4.1 Payment detail page
- New section "Audit history" or "Change history".
- Fetch list: `getPaymentAuditLog(paymentId)` (tenant-scoped, order by changed_at DESC).
- Display: table or list with columns — Date/time, Action, Changed by, Before → After (or summary per action type). Optional: expand row to show full before_value/after_value JSON.

### 4.2 API / server action
- **New:** `getPaymentAuditLogAction(paymentId)` or direct `payment-audit.service.getPaymentAuditLog(paymentId)` used from server component.
- Returns: `{ entries: { id, action_type, before_value, after_value, changed_by, changed_at }[] }`.

### 4.3 i18n
- Keys: `payments.audit.*` — title, actionCreated, actionCancelled, actionRefunded, actionNotesUpdated, changedBy, changedAt, before, after, noHistory.

---

## Implementation Order

1. **Part 3 (Audit table + helper)** — Migration, Prisma model, `recordPaymentAudit` helper and integrate into `recordPaymentTransaction`, `updatePaymentNotes`, `cancelPayment`. (Refund not yet wired; can add REFUNDED when Part 2 is done.)
2. **Part 2 (Refund)** — Service fixes (transaction, order reversal, status check), schema, action, permission migration, refund dialog, buttons on detail + list, i18n. Then add REFUNDED audit in `refundPayment`.
3. **Part 1 (Cancel)** — Only audit integration (CANCELLED) if not already done in step 1.
4. **Part 4 (Audit UI)** — getPaymentAuditLog, detail page section, i18n.
5. **Verification** — Build, manual tests: create payment → audit; edit notes → audit; cancel → audit + reversal; refund (full/partial) → audit + reversals; view history on detail page.

---

## File Checklist

### New files
- `supabase/migrations/[NEXT_SEQ]_create_org_payment_audit_log.sql`
- `supabase/migrations/[NEXT_SEQ]_add_payments_refund_permission.sql`
- `web-admin/lib/services/payment-audit.service.ts`
- `web-admin/app/dashboard/billing/payments/components/refund-payment-dialog.tsx`

### Modified files
- `web-admin/lib/services/payment-service.ts` — refund: transaction, order reversal, status check; audit calls in create/cancel/refund/updateNotes.
- `web-admin/lib/validations/payment-crud-schemas.ts` — refundPaymentSchema (or new refund schema file).
- `web-admin/app/actions/payments/payment-crud-actions.ts` — refundPaymentAction (or new refund action file).
- `web-admin/app/dashboard/billing/payments/[id]/payment-detail-client.tsx` — Refund button, Audit history section.
- `web-admin/app/dashboard/billing/payments/components/payments-table.tsx` — Refund action.
- `web-admin/prisma/schema.prisma` — org_payment_audit_log model.
- `web-admin/messages/en.json`, `web-admin/messages/ar.json` — payments.refund.*, payments.audit.*.

---

## Verification Checklist

- [ ] Cancel: only for non-cancelled/refunded; reason required; permission enforced; invoice/order reversed; one CANCELLED audit row.
- [ ] Refund: only for completed; amount ≤ original; partial and full; invoice + order reversed; REFUNDED audit row.
- [ ] Create payment: one CREATED audit row with after_value.
- [ ] Edit notes: one NOTES_UPDATED audit row with before/after rec_notes.
- [ ] Audit history visible on payment detail; RLS and tenant isolation verified.
- [ ] `npm run build` passes.
