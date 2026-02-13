# Finance Module – Invoices & Payments (CleanMateX Web Admin)

## Overview

This document summarizes the current implementation of **invoices and payments** inside the `web-admin` app and how it aligns with the master plan (`master_plan_cc_01.md`):

- Uses core finance tables: `org_invoice_mst` and `org_payments_dtl_tr` (multi-tenant, RLS enforced).
- Implements invoice and payment business logic in TypeScript services under `web-admin/lib/services` with **strict tenant context** via `withTenantContext()` and `getTenantIdFromSession()`.
- Exposes functionality to the UI via **Next.js server actions** and **dashboard pages** (App Router).

> Note: External REST APIs for mobile apps / third-party integrations will live in the dedicated NestJS backend (Phase 2). The web-admin focuses on admin-facing workflows.

---

## Data Model

### Tables

- `org_invoice_mst`
  - 1–many with `org_orders_mst` (currently 1 invoice per order in the main flow).
  - Stores `subtotal`, `discount`, `tax`, `total`, `status`, `paid_amount`, `due_date`, `payment_method` and audit fields.
  - Tenant isolation via `tenant_org_id` + RLS and composite FKs.

- `org_payments_dtl_tr`
  - Optional link to `org_invoice_mst` (`invoice_id` nullable); optional `order_id`, `customer_id`.
  - **Payment kind**: `payment_kind` (`invoice` | `deposit` | `advance` | `pos`) — allows payments without an invoice (down payments, POS receipts, advance payments).
  - Constraint: at least one of `invoice_id`, `order_id`, or `customer_id` must be set.
  - Stores individual payment transactions (`paid_amount`, `status`, `payment_method_code`, `paid_at`, `paid_by`, `gateway`, `transaction_id`, `metadata`). Column is **`payment_method_code`** (not `payment_method`); Prisma schema and DB match.
  - Supports **partial payments**: invoice-level `paid_amount` is the aggregate of successful transactions when `invoice_id` is set.
  - Unapplied payments (e.g. deposit/advance/pos with `invoice_id` null) can be **applied to an invoice** later via `applyPaymentToInvoice`.

Database indexes and foreign keys are defined in `supabase/migrations/0001_core_schema.sql` and `0087_payments_nullable_invoice_and_kind.sql`, and enforced in Prisma models (`web-admin/prisma/schema.prisma`). Tenant isolation is guaranteed by:

- `tenant_org_id` on all `org_*` tables.
- RLS policies from the Supabase migration set.

**After schema/DB changes:** run `npx prisma generate` in `web-admin` so the Prisma client matches the schema. To refresh Supabase typings: `supabase gen types typescript --local > web-admin/types/database.ts` (from repo root or `supabase`).

---

## Backend Logic (Web Admin)

### Services

- `web-admin/lib/services/invoice-service.ts`
  - `createInvoice`, `getInvoice`, `getInvoicesForOrder`, `listInvoices`, `updateInvoice`, `markInvoiceAsPaid`.
  - `getInvoiceStats` returns aggregate metrics used on the invoices dashboard.
  - All functions run inside `withTenantContext(tenantId, ...)` and resolve tenant via `getTenantIdFromSession()` when needed.

- `web-admin/lib/services/payment-service.ts`
  - `getAvailablePaymentMethods`, `validatePaymentMethod` (from `sys_payment_method_cd`; uses `payment_method_icon`, `payment_method_color1`, etc.).
  - `processPayment` orchestrates validation and supports two paths: **(1) invoice-linked** (existing flow: order/invoice, partial payments, invoice status, order paid_amount); **(2) non-invoice** (when `payment_kind` is `deposit`, `advance`, or `pos`: requires `order_id` and/or `customer_id`, records payment without invoice; optionally updates order `paid_amount`).
  - `recordPaymentTransaction` writes to `org_payments_dtl_tr`; accepts optional `invoice_id`; requires at least one of `invoice_id`, `order_id`, `customer_id`; supports `payment_kind`.
  - `getPaymentHistory(invoiceId)` returns all payment transactions for a given invoice.
  - `getPaymentsForOrder(orderId)` returns all payments for an order (including unapplied deposit/pos).
  - `getPaymentsForCustomer(customerId)` returns all payments for a customer (e.g. advance balance).
  - `applyPaymentToInvoice(paymentId, invoiceId)` applies an unapplied payment (deposit/advance/pos) to an invoice: sets `invoice_id`, updates invoice `paid_amount` and status, and order if applicable.
  - `refundPayment` implements refund transactions; copies `invoice_id`, `order_id`, `customer_id` from original (all nullable); only updates invoice when `transaction.invoice_id` is not null.

### Server Actions

- `web-admin/app/actions/payments/process-payment.ts`
  - `processPayment`: validates request (`validatePaymentData`) then delegates to `processPayment` service; accepts optional `customerId`, `paymentKind` for non-invoice payments; revalidates order/invoice pages on success.
  - `getPaymentsForOrder(orderId)`, `getPaymentsForCustomer(customerId)` for UI.
  - `applyPaymentToInvoice(paymentId, invoiceId, userId?, orderId?)` for applying unapplied payments to an invoice; revalidates invoice and order paths.

- `web-admin/app/actions/payments/invoice-actions.ts`
  - Wraps invoice service functions for use in UI and future API handlers:
    - `createInvoiceAction`, `getInvoiceAction`, `getOrderInvoices`.
    - `updateInvoiceAction`, `markAsPaidAction`, `applyDiscountAction`.
    - `getInvoiceStatsAction` for tenant-level invoice KPIs.

These actions use the same tenant context as the services and are safe to call from server components or client components via `use server` actions.

---

## Web Admin UI

### Pages

Invoices live under **`/dashboard/billing/invoices`** for consistent information architecture (Billing → Invoices) and alignment with navigation.

- `web-admin/app/dashboard/billing/invoices/page.tsx`
  - Server Component, lists invoices for the current tenant with basic filters via `searchParams`.
  - Calls `listInvoices` and `getInvoiceStats` from `invoice-service`.
  - Shows:
    - Invoice number, linked order ID, total, paid amount, remaining balance, and status.
    - Simple stats: total, paid, pending/partial, overdue.
  - i18n namespace: `invoices` in `messages/en.json` / `messages/ar.json`.

- `web-admin/app/dashboard/billing/invoices/[id]/page.tsx`
  - Server Component, detail view for a single invoice:
    - Invoice financial summary (subtotal, discount, tax, total, paid, balance, status, method).
    - Payment history table (via `getPaymentHistory` service).
    - Optional order summary section (via `getOrder` action) when `order_id` is present.
  - Embeds a small **client component** to record additional payments.

### Record Payment UI

- `web-admin/app/dashboard/billing/invoices/[id]/record-payment-client.tsx`
  - `'use client'` component rendered on invoice detail page (invoice-linked payments).
  - Props: `tenantOrgId`, `userId`, `invoiceId`, `orderId`, `remainingBalance`, and a typed `processPaymentAction` bridge.
  - Features: amount input (defaults to remaining balance), payment method CASH/CARD, optional notes; calls `processPayment` with tenant/user context; success/error and `router.refresh()`.
  - Fully localized via the `invoices.recordPayment.*` keys. Payment history table shows **payment kind** badge (invoice / deposit / advance / pos) via `invoices.history.kind_*`.

- **Order detail** (`web-admin/app/dashboard/orders/[id]/`)
  - **Unapplied payments** section: lists payments for the order with `invoice_id` null (deposit/pos); each row has an **Apply to invoice** button that opens a modal to select an invoice for the order, then calls `applyPaymentToInvoice`.
  - **Record deposit / POS** form: records payment with `payment_kind` `deposit` or `pos`, `order_id` set; no invoice; amount, method (CASH/CARD), notes; calls `processPayment` without `invoiceId`.

- **Customer detail** (`web-admin/app/dashboard/customers/[id]/`)
  - **Advance balance** section: shows total unapplied advance payments (where `customer_id` matches and `invoice_id` is null) via `getPaymentsForCustomer`; optional list and count.
  - **Record advance** form: records payment with `payment_kind` `advance`, `customer_id` set; calls `processPayment` without `invoiceId`.

> **New Order Flow (Server-Side Payment Calculation):** The new order page uses `PaymentModalEnhanced02`, which fetches totals from `POST /api/v1/orders/preview-payment` and submits via `POST /api/v1/orders/create-with-payment`. This single API creates order + invoice + payment (and receipt voucher when CASH/CARD/CHECK) in one transaction. On amount mismatch, the API returns `AMOUNT_MISMATCH` (400) with differences; nothing is persisted; the client shows `AmountMismatchDialog`. This flow **replaces** the previous sequential `createOrder` → `createInvoiceAction` → `processPayment` for new orders. The invoice detail payment form is for counter staff updating existing invoices; order and customer pages support non-invoice payments (deposit, advance, POS) and apply-to-invoice flow.

---

## Feature Flags Integration

The finance UI is designed to align with plan-based feature flags defined in `FeatureFlags` (`web-admin/lib/types/tenant.ts`) and served via `feature-flags.service.ts`:

- `pdf_invoices` controls advanced PDF/printing flows (planned).
- Basic invoice list, detail, and manual cash/POS payments are considered **core** for POS flows and intentionally do **not** require `pdf_invoices`.

For API-level or UI-level gating of future features (e.g., PDF export, B2B billing, online gateways), use:

- `requireFeature(tenantId, 'pdf_invoices')` inside API routes / server actions.
- Client-side checks using `/api/feature-flags` when rendering optional buttons.

---

## Best Practices & Notes

- **Multi-tenancy**
  - Always rely on `getTenantIdFromSession()` + `withTenantContext()` when using Prisma.
  - Never query `org_invoice_mst` or `org_payments_dtl_tr` without a tenant filter.

- **Partial Payments**
  - Multiple `org_payments_dtl_tr` rows per invoice are supported; `paid_amount` on the invoice is updated as the sum of completed payments.
  - Remaining balance = `total - paid_amount` (calculated in service/UI, not stored).

- **Payment Methods (current scope)**
  - UI restricts invoice-detail payments to `CASH` and `CARD` (in-branch POS).
  - Gateway methods (`HYPERPAY`, `PAYTABS`, `STRIPE`, etc.) are reserved for future phases and are currently handled as placeholders in `processPaymentByMethod`.

- **i18n / RTL**
  - All new strings live under the `invoices` namespace in `messages/en.json` and `messages/ar.json`.
  - Amounts are formatted as OMR with 3 decimals, consistent with existing order/payment UI.

- **Future Extensions**
  - PDF invoice generation (guarded by `pdf_invoices` flag).
  - B2B consolidated invoices (leveraging existing schema and `b2b_contracts` feature flag).
  - External REST APIs for mobile apps and third-party clients via NestJS backend, reusing the same tables and business rules.
