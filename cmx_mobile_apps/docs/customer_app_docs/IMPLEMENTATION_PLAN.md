# CleanMateX Go — Production File-by-File Implementation Plan (v3 · Audited)

> **Status:** ✅ Implemented & Verified (Phases 1–6 Complete)  
> **Governing Standards:** [AGENTS.md](file:///f:/jhapp/cleanmatex/AGENTS.md), [CLAUDE.md](file:///f:/jhapp/cleanmatex/CLAUDE.md), [cmx_mobile_apps/AGENTS.md](file:///f:/jhapp/cleanmatex/cmx_mobile_apps/AGENTS.md), [cmx_mobile_apps/CLAUDE.md](file:///f:/jhapp/cleanmatex/cmx_mobile_apps/CLAUDE.md), and all 6 mobile skills  
> **Approved UX Reference:** [interactive_mockup_v2.html](file:///f:/jhapp/cleanmatex/cmx_mobile_apps/docs/customer_app_docs/interactive_mockup_v2.html) & [DESIGN_BLUEPRINT.md](file:///f:/jhapp/cleanmatex/cmx_mobile_apps/docs/customer_app_docs/DESIGN_BLUEPRINT.md)  
> **Approved Decisions:**  
> 1. Active Customer API Gateway: `web-admin/app/api/v1/public/customer/*` (100% POS service reuse, $0 extra infra; scale-out target: `cmx-api`).  
> 2. Staff Requests & POS Conversion Permissions: **Option 1** — gate under existing `orders:read` + `orders:create` (zero extra tenant RBAC setup).  
> 3. Live Order Tracker: Flexible data-driven `N`-stage `AppProgressStepperWidget` with **both** Horizontal (wide default) and Vertical (compact default) toggleable modes.  
> 4. Nothing artificially locked — adopt the best reusable patterns and proven packages wherever they genuinely elevate quality.

---

## Live Execution Progress Tracker (Updated After Every Phase)

| Phase | Scope | Status | QA Gate | Docs Synced |
|---|---|---|---|---|
| **Phase 1** | Workspace Docs Export + Migration `0859` Draft + ADR Update | ✅ Done | ✅ SQL rules & `0854` verified | ✅ Synced |
| **Checkpoint** | User applied `0859` (local & remote) + regenerated types & Prisma | ✅ Done | ✅ `schema.prisma` & TS types synced | ✅ Synced |
| **Phase 2A** | `web-admin` Public Customer APIs & Dual-Scope Services | ✅ Done | ✅ `tsc --noEmit` 0 errors · `eslint --quiet` 0 errors | ✅ Synced |
| **Phase 2B** | `web-admin` Staff Quick-Drop Queue & Atomic POS Conversion | ✅ Done | ✅ `check:ui` 0 errors · `check:i18n` passed | ✅ Synced |
| **Phase 3** | Shared Melos Packages (`mobile_ui` v1.1 + `domain` + `services` + `l10n`) | ✅ Done | ✅ `dart analyze` 0 issues · package tests passed | ✅ Synced |
| **Phase 4** | `apps/customer_app` Full Screens & Premium Journeys (Mockup v2 Parity) | ✅ Done | ✅ `dart analyze` 0 issues · 0 missing EN/AR keys | ✅ Synced |
| **Phase 5** | End-to-End QA, Accessibility, Performance & Release Hardening | ✅ Done | ✅ Flutter test suite + `web-admin` build verified | ✅ Synced |
| **Phase 6** | Canonical Documentation Pack Generation (`/documentation` skill) | ✅ Done | ✅ `docs/features/customer_app_orders/` + mobile docs synced | ✅ Synced |

---

## 0. Audit Findings & Edge Cases Hardened Before Coding

Before writing any code, 9 real-world gaps/bugs were identified and designed out up front:

| # | Potential Bug / Gap | Hardened Solution Built Into This Plan |
|---|---|---|
| **1** | **Stale / Disabled `last_branch_id`** (branch later disabled or `is_customer_app_enabled = false`) | `GET /tenants` & `GET /booking` validate `last_branch_id` against active customer-app-enabled branches; if ineligible, fall back cleanly to first eligible branch (or `null` for selection) without crashing. |
| **2** | **`sys_customer_addresses_dtl` vs `org_customer_addresses` UUID mismatch** on orders/requests | `resolveCustomerAddress()` resolves addresses across both scopes (`source: 'SYS' | 'ORG'`). `org_ord_requests_mst` stores address snapshots + `pickup_address_source`/`delivery_address_source` (no single-table FK clash). For `org_orders_mst`, verify FK before Phase 2A and snapshot/mirror safely if an org FK exists. |
| **3** | **Duplicate Mobile / Email on Profile Edit** (`uq_sys_cust_mobile_e164` / `uq_sys_cust_email_norm`) | `PATCH /profile` normalizes E.164/lowercase, returns typed `409 CONTACT_ALREADY_IN_USE` (localized `AppException`, zero raw SQL errors), and resets `phone_verified`/`email_verified = false` on change. |
| **4** | **Gift Card Credit vs. Unpaid Mobile Checkout** | Gift cards are settlement credits (never lower `saleTotal`). When applied on Step 5, `POST /booking` passes the validated gift card leg into `settleOrderTx()` inside the order transaction with `Idempotency-Key` so retries never double-debit. |
| **5** | **Mid-Draft Branch Switch in Detailed Order** (stale items/prices/delivery fee) | Switching `branchId` on Step 1 clears cached quote, reloads Branch B catalog/speeds, surfaces a clear localized banner if any cart item is unavailable at Branch B (zero silent money mutation), and triggers a fresh `POST /booking/quote`. |
| **6** | **Double Conversion Race Condition in POS** (2 cashiers clicking same `REQ-*`) | `lockAndMarkRequestConvertedTx` runs `SELECT ... FOR UPDATE` (`WHERE id = $1 AND tenant_org_id = $2`) inside the POS order transaction + DB partial unique index `uq_ord_source_request`, returning clean `409 REQUEST_ALREADY_CONVERTED` + link to existing order. |
| **7** | **Prisma Drift After `0859`** | Mandatory **Checkpoint** after user applies `0859`: run `npm run prisma:pull` from repo root (`/pull-prisma` skill) before compiling Phase 2A/2B TypeScript against new columns/tables. |
| **8** | **Guest & Offline UX Across All 4 Tabs** | Guest tapping Orders/Receipts/Account gets an intentional welcoming Guest panel + Sign-In CTA (never a 401 error). Offline users see cached read-only views + `AppOfflineBannerWidget`, while mutating submit actions disable with clear offline guidance. |
| **9** | **Real Scannable QR & Offline Typography** | Add `qr_flutter` to `packages/mobile_ui` for real scannable Pickup & ZATCA receipt QRs (no fake mock graphics) and bundle/configure `Poppins` + `Tajawal` with clean fallbacks for deterministic offline rendering & widget tests. |

---

## 1. Premium Mobile Craft & Reusability Standards

- **Domain-Agnostic Reusable First:** Generic UI primitives live in `packages/mobile_ui` (zero feature/domain imports, reusable by `customer_app`, `driver_app`, `staff_app`); reusable backend logic lives in `web-admin/lib/services/` with thin route handlers.
- **Tactile Consumer Craft (Uber / Deliveroo / Apple Wallet / Linear Bar):**
  - `HapticFeedback.selectionClick()` / `lightImpact()` / `mediumImpact()` on tabs, steppers, code copy, and order confirmation.
  - RTL-aware `AnimatedSwitcher` step transitions, animated progress bars, pulse halo on active live-tracking node, `RefreshIndicator.adaptive`, and translucent sticky checkout docks.
  - Shaped animated skeletons (`AppSkeletonWidget`) everywhere — zero blank screens or full-page spinners on open views.
  - 350ms debounced POS-parity `POST /booking/quote` with inline skeleton only on recalculating tax/total rows.
  - Runtime WCAG AA contrast guard on per-Organization accent overrides (`CmxOrgThemeOverride`), while keeping semantic status tones and Always-Light receipt paper locked.
  - Local booking draft retention across app backgrounding + 1-tap **Reorder Last** (always re-priced live on server).

---

## Phase 1 — Workspace Docs Export, DB Migration Draft (`0859`) & Architecture Amendment

> **Hard Rules ([CLAUDE.md](file:///f:/jhapp/cleanmatex/CLAUDE.md)):** Load `/database` & `/code-documentation` before authoring SQL. Never modify existing migrations; never apply migrations via CLI/MCP — create `0859` and STOP for user review/apply. Max 30 chars per DB object, `TEXT` not `VARCHAR`, no locale/country defaults, full `COMMENT ON` metadata, Prisma-safe composite FKs, no default `anon`/`authenticated` grants.

### Tasks
1. **Export Approved Docs Into Workspace (`cmx_mobile_apps/docs/customer_app_docs/`):**
   - `[NEW] cmx_mobile_apps/docs/customer_app_docs/DESIGN_BLUEPRINT.md`
   - `[NEW] cmx_mobile_apps/docs/customer_app_docs/IMPLEMENTATION_PLAN.md` *(live progress tracker)*
   - `[NEW] cmx_mobile_apps/docs/customer_app_docs/interactive_mockup_v2.html`
2. **Draft Migration `[NEW] supabase/migrations/0859_customer_app_branch_prefs_addresses.sql`** (extends `0854`, zero duplicate columns):
   - `org_customers_mst`: add `last_branch_id UUID NULL` with Prisma-safe composite FK `(last_branch_id, tenant_org_id)` → `org_branches_mst(id, tenant_org_id) ON DELETE RESTRICT`, index `ix_ocm_tenant_last_branch`, plus `default_order_note TEXT NULL` and `auto_apply_order_default_note BOOLEAN NOT NULL DEFAULT false` *(29 chars ≤ 30)*.
   - `sys_customers_mst`: add `default_order_note TEXT NULL` and `auto_apply_order_default_note BOOLEAN NOT NULL DEFAULT false`.
   - `sys_customer_addresses_dtl`: global customer addresses table (`id`, `customer_id FK → sys_customers_mst(id) ON DELETE RESTRICT`, `address_type`, `label`, `building`, `floor`, `apartment`, `street`, `area`, `city`, `country` *[no default]*, `postal_code`, `latitude DECIMAL(10,8)`, `longitude DECIMAL(11,8)`, `delivery_notes`, `is_default`, `is_active`, `rec_status`, `rec_order`, `rec_notes`, audit columns, partial unique default index per `customer_id`, lookup index `(customer_id, is_active)`, `REVOKE ALL FROM PUBLIC, anon, authenticated` + explicit `service_role` grant, full `COMMENT ON`).
   - `org_ord_requests_mst`: add `delivery_mode_code TEXT NOT NULL DEFAULT 'STORE_PICKUP'` (`CHECK IN ('DELIVER_ADDRESS', 'STORE_PICKUP')`), `pickup_address_id UUID NULL`, `pickup_address_source TEXT NULL` (`CHECK IN ('SYS', 'ORG')`), `delivery_address_id UUID NULL`, `delivery_address_source TEXT NULL` (`CHECK IN ('SYS', 'ORG')`), `delivery_address_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb`, `estimated_total_bags INTEGER NOT NULL DEFAULT 0` (`CHECK >= 0`).
3. **Update `[MODIFY] cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md`** (v2.3.0): record approved `web-admin` active customer gateway (scale-out target `cmx-api`) and pragmatic non-blocking evolution policy.

### Phase 1 Exit Gate (QA + Docs + Progress)
- [ ] Verify every DB identifier ≤ 30 chars, every object has `COMMENT ON`, zero `VARCHAR`, zero locale defaults, zero `CASCADE`, zero `anon`/`authenticated` grants.
- [ ] Update Progress Tracker in `cmx_mobile_apps/docs/customer_app_docs/IMPLEMENTATION_PLAN.md` + `docs/features/customer_app_orders/STATUS.md`.
- [ ] **STOP & hand `0859` to user for review & manual Supabase execution** *(can run Phase 3 `mobile_ui` in parallel while awaiting DB apply!)*.

---

## Checkpoint — Prisma Schema Sync (After User Applies `0859`)

1. Run `npm run prisma:pull` from repo root (per `/pull-prisma` skill).
2. Verify `sys_customer_addresses_dtl`, `org_customers_mst.last_branch_id`, `default_order_note`, `auto_apply_order_default_note`, and new `org_ord_requests_mst` columns exist cleanly with zero P1012 warnings.
3. Update Progress Tracker.

---

## Phase 2A — `web-admin` Public Customer APIs & Reusable Services

> **Hard Rules:** Load `/backend`, `/multitenancy`, `/order-fin`. Explicit `tenant_org_id` filter on EVERY `org_*` read/write; strict TS (no `any`); UTC RFC 3339 timestamps + authoritative branch IANA timezone; rate limiting & `Idempotency-Key`; zero PII/token logging.

### Reusable Services & Routes (`web-admin/`)
1. **`[NEW] web-admin/lib/services/customer-app-profile.service.ts`**
   - Full profile read (`customerCode`, `name`/`name2`, `mobile`/`mobileVerified`, `email`/`emailVerified`, `profileStatus`, `loyaltyPoints`, `memberSince`, `preferredLanguage`, `preferences`, `defaultOrderNote`, `autoApplyOrderDefaultNote`, `lastBranchId` *[validated active & customer-app-enabled]*, `hasSysCustomerId`).
   - Dual-scope contact & prefs update (`sys_customers_mst` if `hasSysCustomerId`, else `org_customers_mst` with explicit `tenant_org_id`; clean `409 CONTACT_ALREADY_IN_USE` + verification reset on contact change).
   - Dual-scope Address CRUD (`sys_customer_addresses_dtl` if `hasSysCustomerId` + merged legacy org addresses on read; else `org_customer_addresses` with explicit `tenant_org_id`) + `resolveCustomerAddress()`.
   - Reusable `syncCustomerLastBranch(tenantOrgId, orgCustomerId, branchId)` (updates only when changed).
2. **`[NEW] web-admin/lib/services/customer-app-requests.service.ts`**
   - Fast Quick Drop intake (`org_ord_requests_mst` + `org_ord_request_lines_dtl`), DB `REQ-*` numbering (`doc-seq-config.service.ts`), `Idempotency-Key`, 2×2 `collection_method_code` + `delivery_mode_code`, optional real catalog (`product_id` + `service_category_code` + `item_name` snapshot) OR free-text (`product_id = NULL`) lines, `syncCustomerLastBranch`, customer-safe status projection. Never touches commercial/tax/payment tables.
3. **`[MODIFY] web-admin/app/api/v1/public/customer/tenants/route.ts`** (`GET`, `PATCH`)
   - Returns `activeTenants[]` AND `hiddenTenants[]` (so hidden laundries can **always be unhidden later**!), each with validated `lastBranchId`, eligible `branches[]` (`is_active AND is_customer_app_enabled`, `timeZone`, `deliveryFee`), `brandPrimaryHex`, `logoLightUrl`, `logoDarkUrl`, `isHiddenByCustomer`.
   - `PATCH`: toggle `is_hidden_by_customer` (`true` ↔ `false`) or update `last_branch_id`.
4. **`[NEW] web-admin/app/api/v1/public/customer/profile/route.ts`** (`GET`, `PATCH`)
5. **`[MODIFY] web-admin/app/api/v1/public/customer/addresses/route.ts`** (`GET`, `POST`, `PATCH`, `DELETE`)
6. **`[NEW] web-admin/app/api/v1/public/customer/requests/route.ts`** & **`requests/[id]/route.ts`** (`GET`, `POST`, `PATCH`)
7. **`[NEW] web-admin/app/api/v1/public/customer/booking/quote/route.ts`** (`POST`)
   - Calls `quoteCheckout()` ([commercial-checkout.service.ts](file:///f:/jhapp/cleanmatex/web-admin/lib/services/commercial/commercial-checkout.service.ts)) + `validatePromoCode()` + `validateGiftCard()` + `service-speed-lookup.service.ts` to return POS-parity `grossRows`, `discountRows`, `afterDiscounts`, `taxRows`, `giftCardApplied`, `orderTotal`, `balanceDue`, `balanceStatusCode`, `estimatedReadyByUtc`, `branchTimeZone`, `readyByMayVaryHint: true`.
8. **`[MODIFY] web-admin/app/api/v1/public/customer/booking/route.ts`** (`GET`, `POST`)
   - `GET`: Branch-scoped catalog, per-piece preferences with `extraPrice`, service speeds, customer default prefs + `defaultOrderNote`/`autoApplyOrderDefaultNote`.
   - `POST`: Mandatory `branchId`, 2×2 pickup/delivery → exact `ORDER_TYPE_IDS` (`COLLECTION_AND_DELIVERY`, `HOME_COLLECTION`, `DELIVERY`, `PICKUP`), `orderSourceCode = 'customer_mobile_app'` validated via `validateOrderSourceForCreation()`, per-piece preferences + item notes, `applyProfilePrefsToAll`, `preferencesNote`, `promoCode`, `giftCardCode` (applied via settlement credit leg in `settleOrderTx()` with `Idempotency-Key`), `paymentNotes`, `generalOrderNote`, `saveGeneralNoteForFuture` (updates `default_order_note` + `auto_apply_order_default_note`), calls `syncCustomerLastBranch()`.
9. **`[NEW] web-admin/app/api/v1/public/customer/receipts/route.ts`** & **`receipts/[orderNo]/route.ts`** (`GET`)
   - Uses `order-fin-view/public-view.service.ts` + `receipt-service.ts` for bilingual VAT receipt & ZATCA/GCC QR payload.

### Phase 2A Exit Gate (QA + Docs + Progress)
- [ ] Audit every new/edited `org_*` query for explicit `tenant_org_id` predicate & zero PII logs.
- [ ] Run `cd web-admin && npx eslint . --quiet && npm run build` (must be green).
- [ ] Update API contract docs (`docs/features/customer_app_orders/DESIGN.md`, `STATUS.md`) & Progress Tracker.

---

## Phase 2B — `web-admin` Staff Fast Quick Drop Queue & Atomic POS New Order Conversion

> **Hard Rules:** Load `/frontend`, `/i18n`, `/cmx-ui-design-review`. Cmx components only, theme tokens only, logical RTL classes, `cmxMessage`/`useMessage()`, EN/AR keys aligned with `GLOSSARY.md`. **Permissions (Option 1):** Gate under existing `orders:read` + `orders:create`.

### Staff Backend & UI (`web-admin/`)
1. **`[NEW] web-admin/lib/services/order-request-conversion.service.ts`**
   - `listOrderRequests`, `getOrderRequestDetail`, `triageOrderRequest` (`IN_REVIEW`, `AWAITING_CUSTOMER`, `DECLINED`, `CANCELLED`, `branch_verification_status`), and `lockAndMarkRequestConvertedTx(tx, tenantOrgId, requestId, staffUserId)` (`SELECT ... FOR UPDATE`, explicit `tenant_org_id`, `409 REQUEST_ALREADY_CONVERTED` guard).
2. **`[NEW] web-admin/app/api/v1/order-requests/route.ts`** (`GET`) & **`order-requests/[id]/route.ts`** (`GET`, `PATCH`) — tenant derived strictly from authenticated staff session; guarded by `orders:read` / `orders:create`.
3. **`[MODIFY] web-admin/lib/services/order-submit-orchestrator.service.ts` & `order-create-from-checkout.service.ts`** + POS submit route:
   - Accept optional `sourceRequestId`; atomically lock `org_ord_requests_mst`, write `org_orders_mst.source_request_id` + `source_request_no` with `order_source_code = 'customer_mobile_app'`, set `request_status_code = 'CONVERTED'` + `converted_at = now()`, and call `syncCustomerLastBranch()`.
4. **`[NEW] web-admin/src/features/orders/ui/order-requests-queue-panel.tsx`** (integrated as **"Customer Requests"** tab on `/dashboard/orders` with live pending badge)
   - `CmxDataTable`, `CmxStatusBadge`, `CmxCodeChip`, `CmxConfirmDialog`, `cmxMessage`; triage actions + primary **Convert in POS New Order** (`/dashboard/orders/new?requestId=<uuid>`).
5. **`[MODIFY] web-admin/src/features/orders/hooks/use-new-order-state.ts`** + POS New Order screen:
   - When `?requestId=<uuid>` is present: renders **Customer Request Intake Strip** (code, pickup/delivery mode, address snapshot, branch verification, estimated bags/pieces, notes, and free-text declared items checklist); pre-fills customer, branch, fulfillment, speed, notes, and catalog-linked declared items (`product_id IS NOT NULL`) flagged *"Verify count after inspection"* (priced live via `quoteCheckout()`); passes `sourceRequestId` on submit; handles already-converted state cleanly.
6. **i18n:** Add matching EN/AR keys in `web-admin/messages/en/**` + `web-admin/messages/ar/**`.

### Phase 2B Exit Gate (QA + Docs + Progress)
- [ ] Run `cd web-admin && npm run check:i18n && npm run check:ui && npx eslint . --quiet && npm run build`.
- [ ] Run `/cmx-ui-design-review` checklist on new/modified `web-admin` UI files.
- [ ] Update Progress Tracker & `docs/features/customer_app_orders/STATUS.md`.

---

## Phase 3 — Shared Reusable Flutter Packages (`packages/mobile_*`)

> **Hard Rules:** Load all 6 mobile skills (`mobile-architecture`, `flutter-foundation`, `mobile-ui-system`, `mobile-customer-ux`, `mobile-i18n-rtl`, `mobile-testing`). Strict one-way package dependencies; `AppLogger` only; zero hardcoded strings/colors/spacing.

### 3.1 `packages/mobile_ui/` — Brand Spec v1.1 + Domain-Agnostic Reusable Kit
- Add `qr_flutter` to `packages/mobile_ui/pubspec.yaml` (real Pickup & ZATCA QR rendering) and run `melos bootstrap`.
- `[MODIFY] src/app_colors.dart` — Brand Spec v1.1 tokens (Aqua `#0AB6D8`, accessible Aqua-text `#0888A3` / `#38D1EE`, Deep Navy `#0E2A47`, Emerald `#1DBF73`, Amber `#FFB100`, Teal `#14B8A6`, Coral `#E44D4D`, Light `#F8FAFC` / Dark `#0B111A`).
- `[NEW] src/cmx_theme_extension.dart` — `CmxStatusThemeExtension` (6 tones × bg/text/border) + `CmxOrgThemeOverride` with runtime WCAG AA luminance contrast guard.
- `[MODIFY] src/app_text_styles.dart` & `src/app_theme.dart` — `AppTheme.light(locale:, orgOverride:)`, `AppTheme.dark(locale:, orgOverride:)`, `AppTheme.paperLight()` (always-light receipt surface), `Poppins` (EN) + `Tajawal` (AR) scale with `tabularFigures`, 48dp minimum touch targets.
- `[NEW] src/app_radii.dart`, `src/app_breakpoints.dart` (`compact < 380`, `mobile < 600`, `tablet < 1024`, `ResponsiveLayoutBuilder`).
- `[NEW] Canonical Reusable Widgets (exported via mobile_ui.dart):`
  - **`src/app_progress_stepper_widget.dart`** — Flexible, domain-agnostic **`N`-stage** progress stepper (`List<AppProgressStepItem>`) for any number of stages (3, 4, 5, 7, 10+), supporting **Horizontal** (evenly spaced `<= 5`, horizontally scrollable + auto-scroll to active when `> 5`) AND **Vertical** timeline modes, optional built-in layout toggle + responsive default, animated active pulse halo, RTL mirroring, and icon/number states (never color-only).
  - `src/app_status_badge_widget.dart`, `src/app_empty_state_widget.dart`, `src/app_skeleton_widget.dart`, `src/app_code_chip_widget.dart`, `src/app_money_text_widget.dart`, `src/app_offline_banner_widget.dart`, `src/app_bottom_sheet_shell_widget.dart`, `src/app_segmented_control_widget.dart`, `src/app_quantity_stepper_widget.dart`, `src/app_text_field_widget.dart`, `src/app_switch_list_tile_widget.dart`, `src/app_error_widget.dart`, `src/app_qr_card_widget.dart`.

### 3.2 `packages/mobile_domain/`, `mobile_services/`, `mobile_l10n/`
- `mobile_domain`: extend `tenant_model.dart` & `branch_option_model.dart`; add `customer_profile_model.dart` (`defaultOrderNote`, `autoApplyOrderDefaultNote`, `hasSysCustomerId`), `quick_drop_request_model.dart` (with catalog-linked & free-text declared lines), `pos_quote_breakdown_model.dart`, `digital_receipt_model.dart`; extend `order_booking_draft_model.dart` & `booking_preference_option_model.dart`.
- `mobile_services`: add `customer_profile_service.dart`, `quick_drop_service.dart`, `digital_receipt_service.dart`; extend `order_booking_service.dart` (`fetchServerQuote`) & `tenant_service.dart` (`hide`/`unhide` + `lastBranchId`).
- `mobile_l10n`: add full EN + AR keys in `app_localizations.dart` aligned with [GLOSSARY.md](file:///f:/jhapp/cleanmatex/docs/dev/i18n_docs/GLOSSARY.md).

### Phase 3 Exit Gate (QA + Docs + Progress)
- [ ] Add unit & widget tests in `packages/mobile_ui/test/` (flexible 3/5/8-stage `AppProgressStepperWidget` Horizontal & Vertical in EN/AR & Light/Dark, `CmxOrgThemeOverride` contrast guard, `AppCodeChipWidget`, `AppStatusBadgeWidget`) and `packages/mobile_services/test/`.
- [ ] Run `cd cmx_mobile_apps && melos bootstrap && melos analyze && melos format --check && melos test`.
- [ ] Update Progress Tracker & `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md` package inventory.

---

## Phase 4 — `apps/customer_app` Complete Customer Experience (Mockup v2 + Premium Craft)

1. **Shell, Routing & Theme (`core/` + `features/shell/`):**
   - `AppRoute.quickDrop`, `AppRoute.quickDropDetail`, `AppRoute.receipts`; RTL-aware route transitions; `theme_mode_provider.dart` (`Light`/`Dark`/`System` + Org accent override); `CustomerShellScreen` (4-Tab Material 3 `NavigationBar`: Home · Orders · Receipts · Account + `AppOfflineBannerWidget` + intentional Guest tab states).
2. **Onboarding & My Laundries Switcher (`features/entry/`, `features/tenant/`):**
   - Branded Aqua-to-Navy `CustomerEntryScreen` (OTP vs Email/Password, Guest Mode, QR Scan, instant EN/AR switch).
   - `CustomerTenantSwitcherSheetWidget`: active Org + `last_branch_id` branch chips, Hide toggle, collapsible **Hidden Laundries** section with 1-tap **Unhide**, and Link New Laundry (QR/Code).
3. **Track-First Home (`features/home/`):**
   - Top **Active Org + Last Branch Pill**, greeting, Live Active Order Hero Card, Dual Launcher (Aqua Fast Quick Drop + Navy Detailed Order), conditional Urgent Action Banner (`AWAITING_CUSTOMER` / pending payment), Quick Actions (`Reorder Last`, `Receipts`, `Addresses`), pull-to-refresh, full 5 states.
4. **Shared Fulfillment & 3-Step Fast Quick Drop (`features/quick_drop/`):**
   - Shared `CustomerFulfillmentBranchWidget` (2×2 Pickup & Delivery + Address mini-picker + Branch selector with `isBranchMandatory`).
   - 3-step `CustomerQuickDropScreen`: Fulfillment/Optional Branch → Speed/Bags/Pieces + **Optional Real Catalog Item & Service Category Search Picker OR Free-Text Declaration** (`org_ord_request_lines_dtl`) → Unpriced Review (`Confirmed after inspection`) + locked submit (`Idempotency-Key`) → `REQ-*` Confirmation.
5. **6-Step POS-Parity Detailed Order (`features/booking/`):**
   - Step 1: Mandatory Branch (`last_branch_id` default + mid-draft branch-switch re-quote guard) + 2×2 Pickup/Delivery.
   - Step 2: Catalog categories, search, `AppQuantityStepperWidget`, expandable **per-piece preferences (with extra price)** + **per-item note**.
   - Step 3: Predefined profile prefs card + **1 master toggle** (*Apply to all pieces*) + Preferences Notes.
   - Step 4: Service Speed, slots, **Estimated Ready-By (Branch TZ)** + sorting variance hint.
   - Step 5: Promo Code, Gift Card Code, Payment Notes, General Order Note + **"Save for all upcoming orders"** toggle (`auto_apply_order_default_note`).
   - Step 6: **POS-Parity Review** (Order Context, Itemized lines/add-ons/notes, 3 grouped POS Value Breakdown cards: Gross · Discounts/Gift Card · VAT, Order Total & Balance) + locked submit (`Idempotency-Key`) + Confirmation.
   - Sticky bottom total/CTA dock with 350ms debounced server quote + draft auto-save.
6. **Orders Hub, Flexible Horizontal/Vertical Live Tracker & Always-Light Receipts (`features/orders/`, `features/receipts/`):**
   - `CustomerOrdersScreen` (`Active` · `Requests` · `History` segmented control; 1-tap bridge from `CONVERTED` request → linked order).
   - `CustomerOrderDetailScreen`: `AppProgressStepperWidget` (flexible `N` stages from live status or full order history, Horizontal/Vertical header toggle + responsive default), Pickup QR (`AppQrCardWidget`), Garments summary, POS-parity Financial Card, WhatsApp/Call footer.
   - `CustomerReceiptsScreen` + `CustomerAlwaysLightReceiptSheetWidget` (`Theme(data: AppTheme.paperLight(), ...)` even in Dark Mode!) with ZATCA QR & Share/PDF.
7. **Full Account Profile (`features/profile/`):**
   - Customer Code copy pill + all registered CleanMateX data, `CustomerEditContactSheetWidget` (`sys_customers_mst` vs `org_customers_mst`), `CustomerAddAddressSheetWidget` (`sys_customer_addresses_dtl` vs `org_customer_addresses`), Default Care Preferences, Saved `default_order_note` + `auto_apply_order_default_note` toggle, My Laundries (including Hidden Laundries unhide), Language & Theme Mode.

### Phase 4 Exit Gate (QA + Docs + Progress)
- [ ] Add/update widget & provider tests across `apps/customer_app/test/` (`booking/`, `quick_drop/`, `orders/`, `receipts/`, `profile/`, `tenant/`) using `TestAppWrapper` (EN + AR, Light + Dark) and `ProviderContainer`.
- [ ] Run `cd cmx_mobile_apps && melos analyze && melos format --check && melos test`.
- [ ] Update Progress Tracker & `cmx_mobile_apps/apps/customer_app/README.md`.

---

## Phase 5 — End-to-End QA, Accessibility & Release Hardening

1. **Full Automated Verification Matrix:**
   - `cd cmx_mobile_apps && melos bootstrap && melos analyze && melos format --check && melos test`
   - `cd web-admin && npm run check:i18n && npm run check:ui && npx eslint . --quiet && npm run build`
2. **Manual / Structured QA Sign-Off Checklist (recorded in `TESTING.md`):**
   - EN (LTR) & AR (RTL) at 1.0× and 1.5×–2.0× text scale across all 8 screens.
   - Light Mode, Dark Mode, Org Brand Override contrast, and Always-Light Receipt paper inside Dark Mode.
   - All 5 states (Skeleton Loading, Success, Empty, Error + Retry, Offline Cached) + Guest Mode across all 4 tabs.
   - End-to-end loop: Customer submits Fast Quick Drop (`REQ-*`) → Staff sees in `/dashboard/orders` → Staff converts in `/dashboard/orders/new?requestId=...` → Customer immediately sees linked `ORD-*` live tracker + receipt.
   - Detailed Order with per-piece add-ons, Promo Code, Gift Card, `auto_apply_order_default_note`, and double-tap submit lock.
   - Hide Laundry → Unhide Laundry recovery + `last_branch_id` auto-update.
   - Android debug/release build smoke check (`flutter build apk --debug` / release sanity).
3. Update Progress Tracker to mark QA Passed.

---

## Phase 6 — Final Documentation Pack Generation (`/documentation` Skill)

Invoke the repo's **`/documentation`** skill (and follow `cmx_mobile_apps/AGENTS.md` doc governance) to generate, audit, and finalize all related documentation so nothing is stale or missing:
1. Complete/update canonical feature pack in `docs/features/customer_app_orders/` (`README.md`, `DESIGN.md`, `PLAN.md`, `STATUS.md`, `TESTING.md`) documenting: API routes, DB migrations (`0854` + `0859`), permissions (`orders:read` / `orders:create`), i18n keys, timezone scopes, and POS conversion invariants.
2. Update `cmx_mobile_apps/docs/customer_app_docs/` (`DESIGN_BLUEPRINT.md`, `IMPLEMENTATION_PLAN.md` final status, `README_AI.md`).
3. Update `cmx_mobile_apps/docs/MOBILE_FOUNDATION_DECISIONS.md` & `cmx_mobile_apps/apps/customer_app/README.md` with current-state inventory, shared `mobile_ui` catalog, and test commands.
4. Mark all phases `✅ Done` in the Live Execution Progress Tracker.

---

### Click **Proceed** (or say **"Go"**) to Execute Phase 1
I will immediately export the 3 docs into `cmx_mobile_apps/docs/customer_app_docs/`, draft `supabase/migrations/0859_customer_app_branch_prefs_addresses.sql` for your review/apply, update `MOBILE_FOUNDATION_DECISIONS.md`, and update the Progress Tracker (and optionally begin Phase 3 `mobile_ui` in parallel while you review `0859`).
