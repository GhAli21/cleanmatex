# Developer Guide — Customer App Orders (`customer_app_orders`)

## 1. Database Schema (`0859_customer_app_branch_prefs_addresses.sql`)

| Object | Change | Invariants |
|---|---|---|
| `org_customers_mst` | Added `last_branch_id UUID`, `default_order_note TEXT`, `auto_apply_order_default_note BOOLEAN NOT NULL DEFAULT false` | Composite FK `fk_ocm_last_branch_tenant (last_branch_id, tenant_org_id)` → `org_branches_mst(id, tenant_org_id) ON DELETE RESTRICT` (Prisma-safe tenant-second order) |
| `sys_customers_mst` | Added `default_order_note TEXT`, `auto_apply_order_default_note BOOLEAN NOT NULL DEFAULT false` | Global fallback for customer-owned recurring order note |
| `sys_customer_addresses_dtl` | New global customer addresses table | RLS enabled; `REVOKE ALL FROM PUBLIC, anon, authenticated`; `GRANT ALL TO service_role`; accessed only via authenticated `web-admin` service |
| `org_ord_requests_mst` | Added `delivery_mode_code`, `pickup_address_id`/`source`, `delivery_address_id`/`source`, `delivery_address_snapshot`, `estimated_total_bags` | `request_type_code = 'FAST_QUICK_DROP'`, `request_source_code = 'CUSTOMER_APP'`, `collection_method_code IN ('DROP_OFF', 'COLLECT_FROM_ADDRESS')` |

## 2. Backend API Surface (`web-admin`)

### Public Customer Gateway (`/api/v1/public/customer/*`)
Authenticated via `Authorization: Bearer <token>` resolved by `resolveCustomerMobileSession()` (supports both `0854` opaque global sessions and legacy OTP tokens).

- `GET /api/v1/public/customer/tenants` — Returns `{ activeTenants, hiddenTenants }` including active customer-app-enabled branches (`timezone_code`, `is_main`) and validated `lastBranchId`.
- `PATCH /api/v1/public/customer/tenants` — Updates `isHiddenByCustomer` (reversible Hide/Unhide) or `lastBranchId`.
- `GET /api/v1/public/customer/profile` — Full registered CleanMateX profile (`customerCode`, `mobile`, `email`, verified flags, `loyaltyPoints`, `preferences`, `defaultOrderNote`, `autoApplyOrderDefaultNote`, `lastBranch*`, merged `SYS` + `ORG` addresses).
- `PATCH /api/v1/public/customer/profile` — Dual-scope profile update (`sys_customers_mst` when linked to global `sys_customer_id`, otherwise `org_customers_mst`). Returns `409 CONTACT_ALREADY_IN_USE` on duplicate E.164 mobile or email.
- `GET / POST /api/v1/public/customer/addresses` — Dual-scope address list and creation (`sys_customer_addresses_dtl` if `sys_customer_id` exists, else `org_customer_addresses`).
- `GET / POST /api/v1/public/customer/requests` & `GET / PATCH /api/v1/public/customer/requests/[id]` — Fast Quick Drop CRUD with `Idempotency-Key` support, optional real catalog item & service category validation, address snapshots, and `last_branch_id` sync.
- `POST /api/v1/public/customer/booking/quote` — Live POS-parity breakdown via `quoteCheckout()`, returning 3 pre-grouped sections (`grossRows`, `discountRows`, `taxRows`), totals, gift card settlement, and branch-timezone Ready-By estimate.
- `GET / POST /api/v1/public/customer/booking` — 6-step Detailed Order bootstrap and server-priced order creation (`order_source_code = 'customer_mobile_app'`, 2×2 `order_type_id` mapping, per-item notes, profile prefs, promo/gift card, general order note + `saveGeneralNoteForFuture`, `last_branch_id` sync).
- `GET /api/v1/public/customer/receipts` & `GET /api/v1/public/customer/receipts/[orderNo]` — Customer-safe digital VAT receipts (`subtotal_amount`, `total_discount_amount`, `total_tax_amount`, `total_amount`, `total_paid_amount`, `tax_registration_no`, QR payload).

### Staff POS Quick-Drop Conversion (`/api/v1/order-requests/*`)
- `GET /api/v1/order-requests` — Permission: `orders:read` (tenant-scoped via `getAuthContext()`).
- `GET /api/v1/order-requests/[id]` — Permission: `orders:read`.
- `PATCH /api/v1/order-requests/[id]` — Permission: `orders:create` (staff triage: `IN_REVIEW`, `AWAITING_CUSTOMER`, `DECLINED`).
- `POST /api/v1/orders/submit-order` — Accepts optional `sourceRequestId`; executes `linkAndConvertOrderRequestTx()` inside the order transaction (`SELECT ... FOR UPDATE` + `409 REQUEST_ALREADY_CONVERTED`).

## 3. Permissions & i18n Catalogs

- **Permissions Reused:** `orders:read`, `orders:create` (Option 1 — no new permission migration needed).
- **`web-admin` i18n:** `web-admin/messages/en/orders/customerRequests.json` & `web-admin/messages/ar/orders/customerRequests.json`.
- **Flutter Mobile i18n:** `cmx_mobile_apps/packages/mobile_l10n/lib/src/app_localizations.dart` (100% EN/AR key parity).

## 4. Mobile App Architecture (`cmx_mobile_apps/apps/customer_app`)

- **Shell:** `CustomerShellScreen` (4-tab `NavigationBar`: Home · Orders · Receipts · Account) + `AppOfflineBannerWidget` + intentional Guest tab prompts.
- **Navigation:** `AppRoute` constants (`home`, `quickDrop`, `booking`, `orders`, `orderDetail`, `receipts`, `profile`, etc.) wired in `app_router.dart`.
- **State:** Riverpod `NotifierProvider` / `AsyncNotifierProvider` / `FutureProvider` exclusively.
- **Theming:** `AppTheme.light`, `AppTheme.dark`, `AppTheme.paperLight` (Always-Light receipts), `CmxStatusThemeExtension`, and `CmxOrgThemeOverride` (WCAG AA contrast guard).
