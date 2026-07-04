# 08 — Permissions and Tenant Isolation

## RBAC — route-level inventory (from `requirePermission`/`requireAnyPermission` literals in `app/api/v1`)

Money-action granularity is **strong** and follows worldwide separation-of-duties practice:

| Domain | Codes in use (count of gated routes) |
|---|---|
| Orders core | `orders:read` (16) · `orders:update` (13) · `orders:create` (5) · `orders:transition` (3) · `orders:delete` (1) |
| Order money actions | `orders:collect_payment` (2) · `orders:process_refund` (3) · `orders:approve_refund` (1) · `orders:create_adjustment` (1) · `orders:apply_credit` (1) · `orders:verify_payment` (1) · `orders:overpayment_allocate` (1) · `orders:view_financial_breakdown` (2) |
| Finance docs | `fin_vouchers:view` (5) · `fin_vouchers:view_effects` (2) · `finance_reports:view` (7) |
| AR | `invoices:read/create/update/void/write_off/print/allocate_payment` · `ar_ledger:view` (2) · `ar_stmt_cycles:view` (2) · `customer_statements:view` (2) |
| B2B | `b2b_statements:view/create` · `b2b_contracts:*` · `b2b_contacts:*` |
| Stored value / cash | `stored_value:issue_credit_note` (1) · `cash_drawer:view` (2) · `gift_cards:view` (2) · `payment_config:view/manage` (3+3) |
| Customer receipts | `requireAnyPermission` on allocation preview/post routes; `customers:receipt_allocate` in UI (`useHasPermissionCode`) |

Notable good separations: process vs approve refund; void vs write-off on invoices; view vs view_effects on vouchers; config view vs manage.

## RBAC — gaps (FN-04 + FN-12)

1. **Ungated money reads:** `app/api/v1/orders/[id]/report/payments-rprt/route.ts` and `…/report/invoices-payments-rprt/route.ts` authenticate but check **no permission code** (local `getAuthContext`, :13-20). Any tenant user of any role can read full payment history + discounts for any order of their tenant. Should be `orders:read` + (arguably) `orders:view_financial_breakdown`.
2. **Same ad-hoc pattern** on several order sub-reads (`orders/[id]/route.ts`, `discounts`, `history`, `state`, `transitions`, `editability`, `lock/unlock`, `split`, `issue`) — sweep found them missing the standard middleware import. Some are legitimately session-level reads; the *financial* ones deserve explicit codes. Public routes (`app/api/v1/public/...`) are separately token-scoped by design.
3. **No `{domain}-perm.ts` constants** for finance/orders codes (`lib/constants/permissions/` = `admin-perm.ts`, `help.ts` only) — codes are route literals, so no compile-time registry ↔ route parity and harder inventory rebuilds (FN-12). All observed codes do follow the `resource:action` format rule.
4. Per prior-pass decision D-01/ADR-051, feature-flag kill-switches for overpayment/allocation are intentionally absent (RBAC is the control) — unchanged, accepted.

## Tenant isolation

**Verified holding on every inspected financial path:**

- Services: `withTenantContext(tenantId, …)` + explicit `tenant_org_id` WHERE on every canonical read/write inspected (`order-financial-write` :612/:622/:627/:731, `payment-service.getPaymentsForOrder` :1301, `report-service` :246-250, recon reports, refunds, settlement).
- Routes: explicit `.eq('tenant_org_id', tenantId)` on Supabase reads (e.g. payments-rprt route :66).
- RLS: all finance `org_*` tables have RLS + tenant policies — the last gap (`org_tax_doc_seq_counters`) closed by `0379` and locked by DB-integration test T-6 (baseline, live-verified 2026-06-20).
- Composite tenant-scoped FKs on B2B payment detail (0380/0381), no CASCADE.
- DB-truth harness (`__tests__/db-integration/`) asserts cross-tenant invisibility under a tenant JWT and ghost-tenant → 0 rows for the recon SQL.

**Isolation weaknesses (not leaks):**

- **`tenants[0]` active-tenant pick** in the two print routes (FN-04): a multi-tenant user's print may resolve a different tenant than their session tenant (used by the payments service in the same request) — both are tenants the user belongs to, so no cross-tenant exposure, but the output can be internally inconsistent. Use the centralized tenant-context helper.
- The `getPaymentsForOrder` service derives tenant from session internally while the caller passes none — a benign-today pattern that hides the tenant parameter from review; prefer explicit tenant args at service boundaries (consistent with the rest of the finance services).

## Conclusion

Tenant isolation: ✅ sound (structural + tested). RBAC: ✅ strong model with two concrete gaps to close (print routes; permission-constants registry). No cross-tenant read/write path was found in any inspected financial code.
