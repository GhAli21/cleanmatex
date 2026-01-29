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
  - 1–many with `org_invoice_mst`.
  - Stores individual payment transactions (`paid_amount`, `status`, `payment_method`, `paid_at`, `paid_by`, `gateway`, `transaction_id`, `metadata`).
  - Supports **partial payments**: invoice-level `paid_amount` is the aggregate of successful transactions.

Database indexes and foreign keys are defined in `supabase/migrations/0001_core_schema.sql` and enforced in Prisma models (`web-admin/prisma/schema.prisma`). Tenant isolation is guaranteed by:

- `tenant_org_id` on all `org_*` tables.
- RLS policies from the Supabase migration set.

---

## Backend Logic (Web Admin)

### Services

- `web-admin/lib/services/invoice-service.ts`
  - `createInvoice`, `getInvoice`, `getInvoicesForOrder`, `listInvoices`, `updateInvoice`, `markInvoiceAsPaid`.
  - `getInvoiceStats` returns aggregate metrics used on the invoices dashboard.
  - All functions run inside `withTenantContext(tenantId, ...)` and resolve tenant via `getTenantIdFromSession()` when needed.

- `web-admin/lib/services/payment-service.ts`
  - `getAvailablePaymentMethods`, `validatePaymentMethod` (from `sys_payment_method_cd`).
  - `processPayment` orchestrates validation, invoice lookup, partial payments, invoice status transitions and order payment status updates.
  - `recordPaymentTransaction` writes to `org_payments_dtl_tr` and returns a typed `PaymentTransaction`.
  - `getPaymentHistory` returns all payment transactions for a given invoice.
  - `refundPayment` implements refund transactions by inserting negative payments and adjusting invoice `paid_amount`.

### Server Actions

- `web-admin/app/actions/payments/process-payment.ts`
  - Validates request (`validatePaymentData`) then delegates to `processPayment` service.
  - Revalidates order pages on success.

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
  - `'use client'` component rendered on invoice detail page.
  - Props: `tenantOrgId`, `userId`, `invoiceId`, `orderId`, `remainingBalance`, and a typed `processPaymentAction` bridge.
  - Features:
    - Amount input (defaults to remaining balance, supports partial payments).
    - Payment method selector restricted to **`CASH`** and **`CARD`** (POS), matching the current scope.
    - Optional notes field.
    - Calls `processPayment` server action with the correct tenant/user context.
    - Displays success/error states and triggers `router.refresh()` on success.
  - Fully localized via the `invoices.recordPayment.*` keys.

> The original enhanced payment modal used in the **new order** flow (`PaymentModalEnhanced`) remains the primary UI for initial payment at order creation. The new invoice detail payment form is optimized for counter staff updating existing invoices.

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
