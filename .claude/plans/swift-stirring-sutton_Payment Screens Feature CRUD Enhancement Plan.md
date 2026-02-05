# Payment Feature CRUD Enhancement Plan

## Goal
Enhance the existing Payments page (`/dashboard/billing/payments`) with full CRUD: detail view, dedicated create page, note editing, cancel with `payments:cancel` permission, table row actions, and enhanced filtering.

## Current State
- **List page** exists with stats cards, search-only filter bar, 30-column table (no actions column)
- **Service layer** has `listPayments`, `getPaymentStats`, `processPayment`, `recordPaymentTransaction`, `refundPayment` — but NO `getPaymentById`, `updatePayment`, or `cancelPayment`
- **No detail page** (`[id]/page.tsx` does not exist)
- **No create page** (payments only created through order flow)
- **No cancel functionality** with permission enforcement
- **Navigation** already configured in `config/navigation.ts`
- **RBAC system** exists with `RequirePermission` components, `useHasPermission` hooks, `requirePermission` middleware, and DB migration pattern for adding permissions

---

## Implementation Phases

### Phase 1: Service Layer (`web-admin/lib/services/payment-service.ts`)

**1.1** Add `getPaymentById(paymentId: string): Promise<PaymentListItem | null>`
- Fetch single payment with joins (customer, order, invoice, method, type, promo, gift card)
- Extract shared `mapPaymentToListItem()` helper from existing `listPayments` inline mapping (~line 1246)
- Pattern: `getTenantIdFromSession()` + `withTenantContext()`

**1.2** Add `updatePaymentNotes(paymentId: string, notes: string, updatedBy: string): Promise<PaymentTransaction>`
- Guard: reject if payment status is `cancelled` or `refunded`
- Update `rec_notes`, `updated_at`, `updated_by`

**1.3** Add `cancelPayment(paymentId: string, reason: string, cancelledBy: string): Promise<{success, error?}>`
- Guard: reject if already cancelled or refunded
- **Use `prisma.$transaction()`** to atomically:
  - Set status to `'cancelled'`, store cancel reason in `rec_notes`
  - Store cancelled_by/cancelled_at in metadata JSON
  - Reverse `paid_amount` on linked invoice (recalculate status: paid/partial/pending)
  - Reverse `paid_amount` on linked order (recalculate payment_status)

**1.4** Add `CreateStandalonePaymentInput` type to `web-admin/lib/types/payment.ts`
- Fields: customer_id?, order_id?, payment_kind, payment_method_code, amount, currency_code?, payment_type_code?, notes?, check fields

---

### Phase 2: Server Actions & Validation Schemas

**New file:** `web-admin/app/actions/payments/payment-crud-actions.ts`
- `getPaymentAction(paymentId)` — fetch single payment
- `updatePaymentNotesAction(paymentId, notes)` — update notes + revalidatePath
- `cancelPaymentAction(paymentId, reason)` — **checks `payments:cancel` permission server-side** via `hasPermissionServer('payments:cancel')`, then calls `cancelPayment` service, reason is stored in `rec_notes`, revalidates payments/orders/invoices paths
- `createStandalonePaymentAction(input)` — create via existing `processPayment` with payment_kind routing

**New file:** `web-admin/lib/validations/payment-crud-schemas.ts`
- `updatePaymentNotesSchema` — z.object({ notes: z.string().max(1000) })
- `cancelPaymentSchema` — z.object({ reason: z.string().min(1, 'Cancel reason is required').max(500) })
- `createStandalonePaymentSchema` — payment_kind enum (invoice/deposit/advance/pos), method, amount positive, optional customer/order/invoice/check fields

---

### Phase 3: Payment Detail Page

**New files:**
- `web-admin/app/dashboard/billing/payments/[id]/page.tsx` — Server component
  - Fetch payment via `getPaymentAction(id)`, `notFound()` if missing
  - Pass data to client component
- `web-admin/app/dashboard/billing/payments/[id]/payment-detail-client.tsx` — Client component
  - **Header**: Back link, payment ID, status badge, action buttons
  - **Two-column layout** (md:grid-cols-3):
    - Left (col-span-2): Payment Summary, Amount Breakdown (subtotal -> discounts -> VAT -> total), Related Entities (clickable links to customer/order/invoice), Check Details (conditional)
    - Right: Quick Actions (Edit Notes, Void), Audit Info (created/updated at/by)
  - **Edit Notes Dialog**: textarea, save/cancel, calls `updatePaymentNotesAction`
  - **Cancel Payment Button**: Wrapped in `<RequirePermission resource="payments" action="cancel">` — only visible to users with `payments:cancel` permission. Opens confirmation dialog with **required** `rec_notes` textarea for cancel reason. Calls `cancelPaymentAction`.
- `web-admin/app/dashboard/billing/payments/[id]/loading.tsx` — Skeleton

---

### Phase 4: Enhanced List Page

**Modify:** `web-admin/app/dashboard/billing/payments/components/payments-table.tsx`
- Add `actions` column at end of COLUMNS array
- Render: "View" link to detail page + "Cancel" button (wrapped in `<RequirePermission resource="payments" action="cancel">`, hidden for already cancelled/refunded)
- Add row click → navigate to `/dashboard/billing/payments/${id}`
- Add `onCancelClick` callback prop — opens cancel dialog with required notes

**Modify:** `web-admin/app/dashboard/billing/payments/components/payment-filters-bar.tsx`
- Add **Status** multi-select dropdown (pending, processing, completed, failed, cancelled, refunded)
- Add **Payment Method** dropdown (CASH, CARD, CHECK, etc.)
- Add **Payment Kind** dropdown (invoice, deposit, advance, pos)
- Add **Date Range** pickers (startDate, endDate inputs)
- All write to URL search params (already parsed in page.tsx lines 69-80)

**Modify:** `web-admin/app/dashboard/billing/payments/page.tsx`
- Add "New Payment" link/button in header → navigates to `/dashboard/billing/payments/new`

---

### Phase 5: Create New Payment Page

**New file:** `web-admin/app/dashboard/billing/payments/new/page.tsx` — Server component
- Fetches available payment methods via `getAvailablePaymentMethods()`
- Renders `CreatePaymentForm` client component

**New file:** `web-admin/app/dashboard/billing/payments/new/create-payment-form.tsx` — Client component
- Full-page form (not modal) for creating a new payment
- **Fields:**
  - Payment Kind select (invoice/deposit/advance/pos)
  - Customer search (required for advance, optional otherwise)
  - Order reference (required for deposit/pos)
  - Invoice reference (required for invoice kind)
  - Amount input (DECIMAL, formatted for currency)
  - Currency code
  - Payment Method select (from available methods prop)
  - Payment Type select (optional)
  - Check Number / Bank / Date (conditional — shown only when method is CHECK)
  - Notes textarea
- Validates with `createStandalonePaymentSchema` client-side
- Calls `createStandalonePaymentAction` on submit
- On success: redirect to `/dashboard/billing/payments` or to the new payment's detail page
- On error: show inline error message
- Cancel button navigates back to list

---

### Phase 5b: Cancel Payment Dialog

**New file:** `web-admin/app/dashboard/billing/payments/components/cancel-payment-dialog.tsx`
- Confirmation dialog with warning text
- **Required** `rec_notes` textarea — user must enter reason for cancellation
- Submit button calls `cancelPaymentAction`
- Permission-gated: parent component wraps trigger in `<RequirePermission resource="payments" action="cancel">`
- Used from both the payments table (list page) and the detail page

---

### Phase 6: Permission Migration

**New file:** `supabase/migrations/[NEXT_SEQ]_add_payments_cancel_permission.sql`
- Insert `payments:cancel` into `sys_auth_permissions` (code, name, category, description)
- Assign to `tenant_admin` and `super_admin` roles via `sys_auth_role_default_permissions`
- Pattern matches existing RBAC migration in `0034_rbac_foundation.sql`

---

### Phase 7: i18n (EN + AR)

**Modify:** `web-admin/messages/en.json` — Add under `"payments"`:
- `payments.recordPayment` — button label
- `payments.detail.*` — all detail page labels (title, backToList, paymentSummary, amountBreakdown, relatedEntities, checkDetails, quickActions, auditInfo, field labels)
- `payments.editNotes.*` — dialog labels (title, placeholder, save, saving, cancel, success, error)
- `payments.cancel.*` — dialog labels (title, confirm, warning, reasonLabel, reasonPlaceholder, submit, cancelling, cancel, success, error, permissionDenied)
- `payments.create.*` — page labels (title, description, paymentKind, kindInvoice/Deposit/Advance/Pos, customer, order, invoice, amount, currency, method, type, notes, checkNumber, checkBank, checkDate, submit, submitting, cancel, success, error)
- `payments.table.cancel` — "Cancel" action label
- `payments.newPayment` — "New Payment" button label

**Modify:** `web-admin/messages/ar.json` — Corresponding Arabic translations

---

## Files Summary

### New Files (10)
| File | Purpose |
|------|---------|
| `web-admin/app/actions/payments/payment-crud-actions.ts` | Get, update notes, cancel, create standalone actions |
| `web-admin/lib/validations/payment-crud-schemas.ts` | Zod schemas for CRUD validation |
| `web-admin/app/dashboard/billing/payments/[id]/page.tsx` | Detail page server component |
| `web-admin/app/dashboard/billing/payments/[id]/payment-detail-client.tsx` | Detail page client component |
| `web-admin/app/dashboard/billing/payments/[id]/loading.tsx` | Detail page loading skeleton |
| `web-admin/app/dashboard/billing/payments/new/page.tsx` | Create payment page server component |
| `web-admin/app/dashboard/billing/payments/new/create-payment-form.tsx` | Create payment form client component |
| `web-admin/app/dashboard/billing/payments/components/cancel-payment-dialog.tsx` | Cancel confirmation dialog (permission-gated) |
| `supabase/migrations/[NEXT_SEQ]_add_payments_cancel_permission.sql` | Add `payments:cancel` permission to RBAC |

### Modified Files (7)
| File | Changes |
|------|---------|
| `web-admin/lib/services/payment-service.ts` | Add getPaymentById, updatePaymentNotes, cancelPayment; extract mapPaymentToListItem helper |
| `web-admin/lib/types/payment.ts` | Add CreateStandalonePaymentInput interface |
| `web-admin/app/dashboard/billing/payments/page.tsx` | Add "New Payment" button in header |
| `web-admin/app/dashboard/billing/payments/components/payments-table.tsx` | Add actions column (View + permission-gated Cancel), row click navigation |
| `web-admin/app/dashboard/billing/payments/components/payment-filters-bar.tsx` | Add status/method/kind dropdowns, date range pickers |
| `web-admin/messages/en.json` | Add payments.detail/editNotes/cancel/create translation keys |
| `web-admin/messages/ar.json` | Corresponding Arabic translations |

---

## Implementation Order
1. Phase 1 (Service) + Phase 6 (Permission migration) + Phase 7 (i18n) — in parallel
2. Phase 2 (Actions + Schemas) — depends on Phase 1
3. Phase 3 (Detail Page) + Phase 4 (Enhanced List) + Phase 5 (Create Page) + Phase 5b (Cancel Dialog) — depends on Phase 2
4. Run `npm run build` and fix all errors

## Verification
1. `npm run build` passes with no errors
2. Navigate to `/dashboard/billing/payments` — list loads with enhanced filters, stats, and actions column
3. Click a payment row — detail page shows all payment info with amount breakdown
4. Click "Edit Notes" on detail page — dialog opens, saves, shows success toast
5. Click "Cancel" on detail page or table row — only visible with `payments:cancel` permission, opens dialog with required notes (rec_notes), cancels payment, reverses linked invoice/order balances
6. Click "New Payment" button → navigates to `/dashboard/billing/payments/new` — full-page form, fill and submit creates payment
7. Filter by status/method/kind/date — table filters correctly
8. Verify Arabic translations render correctly with RTL layout
9. Verify cancel button is hidden for users without `payments:cancel` permission
