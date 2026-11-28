# Testing Guide & QA Scenarios — Customer App Orders

## 1. Automated Verification Commands

### `web-admin` (Backend + Staff POS UI)
```powershell
cd f:\jhapp\cleanmatex\web-admin
$env:NODE_OPTIONS='--max-old-space-size=8192'
npx tsc --noEmit
npm run check:ui
npm run check:i18n
npm run build
```

### Flutter Mobile Packages & `customer_app`
```powershell
cd f:\jhapp\cleanmatex\cmx_mobile_apps
dart analyze packages/mobile_ui packages/mobile_domain packages/mobile_services packages/mobile_l10n packages/mobile_testkit apps/customer_app
cd packages/mobile_ui && flutter test
cd ../mobile_services && flutter test
cd ../../apps/customer_app && flutter test
```

## 2. Critical QA Matrix (EN + AR RTL · Light + Dark)

| # | Scenario | Expected Behavior |
|---|---|---|
| 1 | **My Laundries Switcher** | Top pill shows active Organization + `last_branch_id` branch; Hide moves laundry to recoverable Hidden Laundries section; Unhide restores it immediately. |
| 2 | **Fast Quick Drop (3 Steps)** | Branch optional (`Any / Laundry decides` allowed); 2×2 Pickup & Delivery selector works; optional real catalog search + category filter adds linked `productId` lines alongside free-text lines; unpriced disclaimer shown; submit returns `REQ-*`. |
| 3 | **Staff POS Atomic Conversion** | `/dashboard/orders` shows Quick Drop queue banner; clicking "Convert in POS" opens `/dashboard/orders/new?requestId=<uuid>` with intake banner; submitting locks row (`FOR UPDATE`) and marks `CONVERTED`; second concurrent submit gets `409 REQUEST_ALREADY_CONVERTED`. |
| 4 | **Detailed Order (6 Steps)** | Step 1 mandates branch selection; Step 2 shows expandable per-piece prefs with extra prices + per-item note; Step 3 shows saved profile preferences + 1 master toggle + preferences note; Step 4 shows Estimated Ready-By + sorting variance hint; Step 5 accepts promo, gift card, payment notes & general order note + save-for-future toggle; Step 6 renders live server-priced POS breakdown. |
| 5 | **Live Order Tracker** | `AppProgressStepperWidget` renders at top of Order Detail for any `N` timeline stages; user can toggle Horizontal ↔ Vertical seamlessly in both LTR (EN) and RTL (AR). |
| 6 | **Always-Light Digital Receipt** | Switching app to Dark Mode and opening a digital receipt sheet still renders crisp white paper with dark ink (`Brightness.light`) and high-contrast QR code. |
| 7 | **Account Profile Dual-Scope** | Displays Customer Code and all registered data; editing email/mobile updates `sys_customers_mst` (when global) or `org_customers_mst` (when tenant-local); adding address saves to `sys_customer_addresses_dtl` or `org_customer_addresses`; toggling `auto_apply_order_default_note` off stops pre-filling future orders. |
