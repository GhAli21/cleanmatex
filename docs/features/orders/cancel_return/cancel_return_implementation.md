# Cancel Order and Return Order — Implementation Status

**Last updated:** 2026-03-06

## Implementation Status

- [x] Database schema (cancel/return columns)
- [x] DB functions (canceling, returning)
- [x] Refund voucher service
- [x] Payment integration (cancel + refund)
- [x] Backend services
- [x] API integration
- [x] Frontend UI (dialogs, order-actions)
- [x] i18n (EN/AR)
- [x] Permissions
- [ ] Cancellation policy settings (Phase 2, optional)
- [x] Unit tests (order-cancel-service, order-return-service)
- [x] E2E tests (cancel/return dialogs and flows)

---

## Feature Implementation Checklist

### Security & Access Control

- [x] **Permissions**
  - `orders:cancel` — Cancel orders before customer receives items (super_admin, tenant_admin, operator)
  - `orders:return` — Process customer return for delivered/closed orders (super_admin, tenant_admin, operator)
  - Scope: tenant-level, order resource

### Navigation & UI Structure

- [x] **Navigation Tree**
  - No new menu items. Actions appear on order detail page (`/dashboard/orders/[id]`) within existing OrderActions component.
  - Cancel Order and Customer Return buttons shown based on order status and allowed transitions.

### Configuration & Settings

- [ ] **Tenant Settings** (Phase 2)
  - `ORDER_CANCEL_FREE_HOURS_BEFORE_PICKUP` (number, optional) — Free cancel window
  - `ORDER_CANCEL_FEE_AMOUNT` (number, optional) — Fee for last-minute cancel

- [x] **System Settings** — N/A

### Feature Management

- [x] **Feature Flags** — Uses existing `USE_NEW_WORKFLOW_SYSTEM`; no dedicated flag for cancel/return
- [x] **Plan Limits** — N/A (available to all plans)

### Internationalization

- [x] **i18n Keys**
  - `orders.cancel.*` — title, description, reasonLabel, reasonPlaceholder, reasonHint, reasonMinLength, reasonCodeLabel, reasonCodePlaceholder, reasonCodes.*, confirm, success, error
  - `orders.return.*` — same structure
  - `orders.actions.buttons.cancelOrder`, `orders.actions.buttons.customerReturn`
  - Namespace: `orders` in `messages/en.json`, `messages/ar.json`

### API & Integration

- [x] **API Routes**
  - `POST /api/v1/orders/[id]/transition` — Used for both cancel and return (screen parameter differentiates)
  - Requires: `orders:transition` (route-level); screen contract enforces `orders:cancel` or `orders:return`

- [x] **External Services** — N/A

### Database & Schema

- [x] **Migrations**
  - `0129_add_order_cancel_and_return_columns.sql` — Add cancelled_at, cancelled_by, cancelled_note, cancellation_reason_code, returned_at, returned_by, return_reason, return_reason_code to org_orders_mst
  - `0130_cmx_ord_canceling_returning_functions.sql` — Extend cmx_ord_screen_pre_conditions; create cmx_ord_canceling_pre_conditions, cmx_ord_canceling_transition, cmx_ord_returning_pre_conditions, cmx_ord_returning_transition
  - `0131_add_orders_return_permission.sql` — Add orders:return permission and role assignments
  - `0132_voucher_id_constraint_and_refund_backfill.sql` — Backfill refund rows (paid_amount < 0) with REFUND vouchers; add chk_payments_voucher_required constraint
  - `0133_order_history_action_types_cancel_return.sql` — Add ORDER_CANCELLED, CUSTOMER_RETURN to org_order_history; update cancel/return transitions to use them

- [x] **Constants & Types**
  - `lib/types/voucher.ts` — CreateRefundVoucherForPaymentInput
  - `lib/types/payment.ts` — RefundPaymentInput.reason_code
  - `lib/services/workflow-constants.ts` — WORKFLOW_TRANSITIONS (DELIVERED/CLOSED → CANCELLED)

### Infrastructure & Environment

- [x] **Environment Variables** — N/A
- [x] **Dependencies** — N/A (uses existing packages)

### Monitoring & Observability

- [x] **Logging** — console.warn on payment cancel/refund failures (best-effort after order transition)
- [x] **Metrics** — N/A

---

## File Reference

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/0129_add_order_cancel_and_return_columns.sql` | Cancel/return columns |
| `supabase/migrations/0130_cmx_ord_canceling_returning_functions.sql` | DB functions |
| `supabase/migrations/0131_add_orders_return_permission.sql` | orders:return permission |
| `supabase/migrations/0132_voucher_id_constraint_and_refund_backfill.sql` | voucher_id constraint + refund backfill |
| `supabase/migrations/0133_order_history_action_types_cancel_return.sql` | ORDER_CANCELLED, CUSTOMER_RETURN action types |
| `web-admin/lib/services/refund-voucher-service.ts` | CASH_OUT/REFUND voucher creation |
| `web-admin/lib/services/order-cancel-service.ts` | Cancel orchestration |
| `web-admin/lib/services/order-return-service.ts` | Return orchestration |
| `web-admin/src/features/orders/ui/cancel-order-dialog.tsx` | Cancel dialog |
| `web-admin/src/features/orders/ui/customer-return-order-dialog.tsx` | Return dialog |
| `web-admin/__tests__/services/order-cancel-service.test.ts` | Unit tests for cancel |
| `web-admin/__tests__/services/order-return-service.test.ts` | Unit tests for return |
| `web-admin/e2e/cancel-return-orders.spec.ts` | E2E tests for dialogs and flows |

### Modified Files

| File | Changes |
|------|---------|
| `web-admin/prisma/schema.prisma` | org_orders_mst cancel/return columns |
| `web-admin/lib/services/payment-service.ts` | Voucher-first refund; cancelPayment |
| `web-admin/lib/services/workflow-service-enhanced.ts` | Payment handling after cancel/return RPC |
| `web-admin/lib/types/voucher.ts` | CreateRefundVoucherForPaymentInput |
| `web-admin/lib/types/payment.ts` | RefundPaymentInput.reason_code |
| `web-admin/lib/services/workflow-constants.ts` | DELIVERED/CLOSED → CANCELLED |
| `web-admin/src/features/orders/ui/order-actions.tsx` | Cancel/Return buttons + dialogs |
| `web-admin/messages/en.json`, `ar.json` | orders.cancel.*, orders.return.* |
