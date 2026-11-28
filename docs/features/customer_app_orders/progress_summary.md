# Progress Summary — Customer App Orders (`customer_app_orders`)

## Delivered Milestones

### Phase 1 — Schema, ADR & Design Grounding
- Exported approved design blueprint, implementation plan, and interactive HTML mockup v2 into `cmx_mobile_apps/docs/customer_app_docs/`.
- Created migration [`0859_customer_app_branch_prefs_addresses.sql`](file:///f:/jhapp/cleanmatex/supabase/migrations/0859_customer_app_branch_prefs_addresses.sql):
  - `org_customers_mst`: `last_branch_id` (Prisma-safe composite FK `(last_branch_id, tenant_org_id)` → `org_branches_mst(id, tenant_org_id)`), `default_order_note`, `auto_apply_order_default_note`.
  - `sys_customers_mst`: `default_order_note`, `auto_apply_order_default_note`.
  - `sys_customer_addresses_dtl`: global customer addresses table with RLS and service-role-only grants.
  - `org_ord_requests_mst`: `delivery_mode_code`, `pickup_address_id`/`source`, `delivery_address_id`/`source`, `delivery_address_snapshot`, `estimated_total_bags`.
- Amended [`MOBILE_FOUNDATION_DECISIONS.md`](file:///f:/jhapp/cleanmatex/cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md) to v2.3.0.
- Applied migration `0859` to local and remote databases; regenerated TypeScript database types and Prisma schema (`web-admin/prisma/schema.prisma`).

### Phase 2A — `web-admin` Public Customer APIs & Services
- Upgraded [`customer-mobile-session.service.ts`](file:///f:/jhapp/cleanmatex/web-admin/lib/services/customer-mobile-session.service.ts) to support both opaque global `0854` sessions and legacy OTP tokens.
- Added [`customer-app-profile.service.ts`](file:///f:/jhapp/cleanmatex/web-admin/lib/services/customer-app-profile.service.ts) and [`customer-app-requests.service.ts`](file:///f:/jhapp/cleanmatex/web-admin/lib/services/customer-app-requests.service.ts).
- Shipped/upgraded public customer routes under `web-admin/app/api/v1/public/customer/`:
  - `tenants` (`GET` active + recoverable hidden + `PATCH` hide/unhide/`lastBranchId`)
  - `profile` (`GET` + `PATCH` dual-scope `sys`/`org`)
  - `addresses` (`GET` + `POST` dual-scope `sys`/`org`)
  - `requests` & `requests/[id]` (`GET`/`POST`/`PATCH` Fast Quick Drop)
  - `booking/quote` (`POST` live POS-parity `quoteCheckout()` breakdown + branch TZ Ready-By)
  - `booking` (`GET` + `POST` 2×2 fulfillment, per-item notes, profile prefs toggle, promo/gift card, general order note + save-for-future)
  - `receipts` & `receipts/[orderNo]` (`GET` customer-safe VAT digital receipts)

### Phase 2B — Staff Quick-Drop Queue & Atomic POS Conversion
- Added [`order-request-conversion.service.ts`](file:///f:/jhapp/cleanmatex/web-admin/lib/services/order-request-conversion.service.ts) with `SELECT ... FOR UPDATE` row locking and `409 REQUEST_ALREADY_CONVERTED` protection.
- Added staff API routes `app/api/v1/order-requests/route.ts` and `app/api/v1/order-requests/[id]/route.ts` gated by `orders:read` / `orders:create`.
- Wired `sourceRequestId` through `new-order-payment-schemas.ts`, `order-submit-orchestrator.service.ts`, `submit-order/route.ts`, and `use-order-submission.ts`.
- Built Cmx-compliant staff UI components `OrderRequestsQueuePanel` (on `/dashboard/orders`) and `CustomerRequestIntakeBanner` (on `/dashboard/orders/new?requestId=...`), with full EN/AR i18n catalogs (`orders/customerRequests.json`).

### Phase 3 — Shared Flutter Packages
- Upgraded `packages/mobile_ui` to Brand Spec v1.1 (`AppColors`, `AppTheme.light/dark/paperLight`, `CmxStatusThemeExtension` + `CmxOrgThemeOverride` WCAG AA guard, flexible `N`-stage `AppProgressStepperWidget`, `AppStatusBadgeWidget`, `AppCodeChipWidget`, `AppMoneyTextWidget`, `AppEmptyStateWidget`, `AppSkeletonBoxWidget`, `AppOfflineBannerWidget`, `AppBottomSheetShellWidget`, `AppSegmentedControlWidget`, `AppQuantityStepperWidget`, `AppErrorWidget`, `AppQrCardWidget`).
- Expanded `packages/mobile_domain`, `packages/mobile_services`, `packages/mobile_l10n` (complete EN + AR parity), and `packages/mobile_testkit`.

### Phase 4 & 5 — `apps/customer_app` & QA Verification
- Built 4-Tab persistent `CustomerShellScreen` (`Home · Orders · Receipts · Account`) with offline banner and guest tab prompts.
- Upgraded Home with active Organization + `last_branch_id` top pill, `CustomerTenantSwitcherSheetWidget` (active + unhide hidden), live hero card, and dual order launcher.
- Built shared `CustomerFulfillmentBranchWidget`, 3-step `CustomerQuickDropScreen`, 6-step POS-parity `CustomerOrderBookingScreen`, upgraded `CustomerOrdersScreen` (`Active · Requests · History`), upgraded `CustomerOrderDetailScreen` (top flexible Horizontal/Vertical `AppProgressStepperWidget` + pickup QR + receipt sheet), `CustomerReceiptsScreen` + Always-Light receipt sheet, and full `CustomerProfileScreen`.
- Added/updated Flutter unit and widget tests across `mobile_ui`, `mobile_services`, and `customer_app`.
