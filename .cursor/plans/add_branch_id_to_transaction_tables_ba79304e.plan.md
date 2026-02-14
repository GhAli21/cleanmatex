---
name: Add branch_id to transaction tables
overview: Add `branch_id` to all transaction tables (org_payments_dtl_tr, org_gift_card_transactions, org_rcpt_receipts_mst) with nullable column, composite FK to org_branches_mst, backfill strategy, indexes, and full codebase updates for create/update flows.
todos: []
isProject: false
---

# Add branch_id to All Transaction Tables

## Scope Summary


| Table                      | Has branch_id? | Action    |
| -------------------------- | -------------- | --------- |
| org_orders_mst             | Yes            | No change |
| org_invoice_mst            | Yes            | No change |
| org_fin_vouchers_mst       | Yes            | No change |
| org_payments_dtl_tr        | No             | Add       |
| org_gift_card_transactions | No             | Add       |
| org_rcpt_receipts_mst      | No             | Add       |


Audit tables (`org_payment_audit_log`, `org_fin_voucher_audit_log`) are out of scope; branch can be derived from parent for queries.

---

## 1. Database Migration

**File:** `supabase/migrations/0106_add_branch_id_to_transaction_tables.sql`

- **org_payments_dtl_tr:** Add `branch_id UUID NULL`, FK to `org_branches_mst(id, tenant_org_id)` with `ON DELETE SET NULL`, index `idx_org_payments_branch` on `(tenant_org_id, branch_id)` where branch_id IS NOT NULL.
- **org_gift_card_transactions:** Add `branch_id UUID NULL`, same FK pattern, index `idx_gift_card_trans_branch`.
- **org_rcpt_receipts_mst:** Add `branch_id UUID NULL`, same FK pattern, index `idx_rcpt_receipts_branch`.

**Backfill strategy:**

- **org_payments_dtl_tr:** `UPDATE ... SET branch_id = (SELECT branch_id FROM org_orders_mst WHERE id = p.order_id) WHERE order_id IS NOT NULL`; then from `org_invoice_mst` where `invoice_id` set; then from `org_fin_vouchers_mst` where `voucher_id` set. Fallback: leave NULL.
- **org_gift_card_transactions:** `UPDATE ... SET branch_id = (SELECT branch_id FROM org_orders_mst WHERE id = g.order_id) WHERE order_id IS NOT NULL`. Fallback: `branch_id` from `org_invoice_mst` where `invoice_id` set. Leave NULL otherwise.
- **org_rcpt_receipts_mst:** `UPDATE ... SET branch_id = (SELECT branch_id FROM org_orders_mst WHERE id = r.order_id) WHERE order_id IS NOT NULL`; then from `org_fin_vouchers_mst` where `voucher_id` set.

Naming: constraints `fk_org_payment_branch`, `fk_org_gift_card_trans_branch`, `fk_org_rcpt_receipt_branch` (max 30 chars per project rules).

---

## 2. Prisma Schema Updates

**File:** [web-admin/prisma/schema.prisma](web-admin/prisma/schema.prisma)

- **org_payments_dtl_tr:** Add `branch_id String? @db.Uuid` and relation `org_branches_mst? @relation(fields: [branch_id, tenant_org_id], references: [id, tenant_org_id], onDelete: SetNull, map: "fk_org_payment_branch")`. Add to `@@index([tenant_org_id, branch_id])`.
- **org_gift_card_transactions:** Add `branch_id String? @db.Uuid` and relation to `org_branches_mst`; add index.
- **org_rcpt_receipts_mst:** Add `branch_id String? @db.Uuid` and relation to `org_branches_mst`; add index.
- **org_branches_mst:** Add inverse relations `org_payments_dtl_tr[]`, `org_gift_card_transactions[]`, `org_rcpt_receipts_mst[]`.

---

## 3. Application Code Changes

### 3.1 Payment Service

**File:** [web-admin/lib/services/payment-service.ts](web-admin/lib/services/payment-service.ts)

- **recordPaymentTransaction (create):** Pass `branch_id: input.branch_id` into `org_payments_dtl_tr.create` data.
- **refund flow (around line 1357):** Add `branch_id: transaction.branch_id ?? undefined` (or derive from order/invoice if we load them) to refund `create` data.
- **mapTransactionToType / PaymentTransaction type:** Include `branch_id` in return shape if the type exposes it.

### 3.2 Invoice Service

**File:** [web-admin/lib/services/invoice-service.ts](web-admin/lib/services/invoice-service.ts)

- Already sets `branch_id` from order (line 73). No schema change for invoice.
- When creating standalone invoices (if any path does not pass order), ensure `branch_id` is passed where available.

### 3.3 Gift Card Service

**File:** [web-admin/lib/services/gift-card-service.ts](web-admin/lib/services/gift-card-service.ts)

- **applyGiftCardToOrder (around line 238):** Accept `branch_id` in input (e.g. from order). Fetch order if not passed: `const order = input.order_id ? await tx.org_orders_mst.findUnique({ where: { id: input.order_id }, select: { branch_id: true } }) : null`; set `branch_id: order?.branch_id ?? undefined` in create.
- **refundToGiftCard (around line 328):** Derive `branch_id` from order: `const order = await tx.org_orders_mst.findUnique({ where: { id: orderId }, select: { branch_id: true } });` then pass `branch_id: order?.branch_id ?? undefined` to create.
- Trace all callers of `applyGiftCardToOrder` to ensure `branch_id` or order context is available (e.g. create-with-payment flow has `orderId` and can pass `branchId`).

### 3.4 Receipt Service

**File:** [web-admin/lib/services/receipt-service.ts](web-admin/lib/services/receipt-service.ts)

- **generateReceipt (around line 169):** Order is already fetched; add `branch_id: (order as { branch_id?: string })?.branch_id ?? undefined` to the `.insert()` payload.

### 3.5 Types

**File:** [web-admin/lib/types/payment.ts](web-admin/lib/types/payment.ts)

- `PaymentTransaction` and any list-item types: add `branch_id?: string` if exposed to UI/API.
- `CreatePaymentTransactionInput` already has `branch_id`; no change needed.

---

## 4. Call Sites and Data Flow


| Flow                           | branch_id Source                                                    |
| ------------------------------ | ------------------------------------------------------------------- |
| create-with-payment API        | `input.branchId` (already passed to `recordPaymentTransaction`)     |
| processPayment (invoice_id)    | Derive from invoice → order.branch_id, or pass in `input.branch_id` |
| processPayment (order_id only) | Load order, use `order.branch_id`; or `input.branch_id`             |
| refundPayment                  | Copy from original `transaction.branch_id`                          |
| applyGiftCardToOrder           | Order (order_id in input) → `order.branch_id`                       |
| refundToGiftCard               | Order (orderId) → `order.branch_id`                                 |
| ReceiptService.generateReceipt | Order (already loaded) → `order.branch_id`                          |


---

## 5. RLS and Security

- No RLS policy changes required; policies filter by `tenant_org_id`. `branch_id` is a data attribute, not a security boundary. Tenant isolation remains enforced via `tenant_org_id`.

---

## 6. Validation and Testing

- Run `npm run build` in `web-admin` after changes.
- Manually verify: create order with payment (branch selected) → check `org_payments_dtl_tr`, `org_invoice_mst` have `branch_id`.
- Test refund: ensure refund row gets `branch_id` from original payment.
- Test gift card apply/refund and receipt generation with branch context.

---

## 7. Migration Version

Use next migration number after `0105` → `0106_add_branch_id_to_transaction_tables.sql`.