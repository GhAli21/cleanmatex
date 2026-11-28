# CleanMateX Go — Customer App (`apps/customer_app`)

## Current Status

CleanMateX Go v2.0 is implemented across the full customer lifecycle in both English (LTR) and Arabic (RTL), Light and Dark modes, backed by `web-admin`'s public customer gateway (`/api/v1/public/customer/*`).

## Implemented Features

- **4-Tab Persistent Shell (`lib/features/shell/`):** `Home · Orders · Receipts · Account` with connectivity-aware `AppOfflineBannerWidget` and intentional Guest mode panels.
- **My Laundries Switcher (`lib/features/tenant/`):** Active Organization + `last_branch_id` top pill, inline branch switching, reversible Hide & Unhide hidden laundries.
- **Home (`lib/features/home/`):** Active laundry pill, live hero order card, dual launcher (**Fast Quick Drop** & **Detailed Order**), quick actions, and pull-to-refresh.
- **Fast Quick Drop (`lib/features/quick_drop/`):** 3-step unpriced request flow with shared 2×2 Pickup/Delivery selector, optional branch, estimated bags/pieces steppers, optional real catalog search/pick OR free-text item lines, idempotent submit (`REQ-*`).
- **Detailed Order (`lib/features/booking/`):** 6-step POS-parity wizard:
  1. Mandatory Branch + 2×2 Fulfillment
  2. Catalog Items + expandable per-piece preferences (with extra price) + per-item notes
  3. Saved Profile Preferences + 1 master toggle + preferences note
  4. Schedule & Speed + Estimated Ready-By (branch TZ) + sorting variance disclaimer
  5. Promo Code, Gift Card, Payment Notes & General Order Note (save-for-future toggle)
  6. Live POS-parity Server-Priced Review (`POST /api/v1/public/customer/booking/quote`)
- **Orders Hub & Flexible Live Tracker (`lib/features/orders/`):** `Active · Requests · History` segmented hub with 1-tap bridge from `CONVERTED` requests; flexible `N`-stage Horizontal/Vertical `AppProgressStepperWidget` at top of Order Detail; ready pickup QR code.
- **Digital VAT Receipts (`lib/features/receipts/`):** Receipt list + Always-Light paper modal (`AppTheme.paperLight`) with QR verification and copy/share summary.
- **Account Profile (`lib/features/profile/`):** Customer Code, all registered CleanMateX data, dual-scope contact editing & Address CRUD, interactive default care preferences, saved general order note + `auto_apply_order_default_note` toggle, Language (EN/AR), and ThemeMode (System/Light/Dark).

## Commands

```powershell
# Analyze all shared packages + customer_app
cd f:\jhapp\cleanmatex\cmx_mobile_apps
dart analyze packages/mobile_ui packages/mobile_domain packages/mobile_services packages/mobile_l10n packages/mobile_testkit apps/customer_app

# Run tests
cd f:\jhapp\cleanmatex\cmx_mobile_apps\apps\customer_app
flutter test
```

## Canonical Documentation

- Feature Pack: [`docs/features/customer_app_orders/README.md`](../../../docs/features/customer_app_orders/README.md)
- Design Blueprint: [`docs/customer_app_docs/DESIGN_BLUEPRINT.md`](../../docs/customer_app_docs/DESIGN_BLUEPRINT.md)
- Implementation Plan: [`docs/customer_app_docs/IMPLEMENTATION_PLAN.md`](../../docs/customer_app_docs/IMPLEMENTATION_PLAN.md)
- Architecture Decisions: [`docs/MOBILE_FOUNDATION_DECISIONS.md`](../../docs/MOBILE_FOUNDATION_DECISIONS.md)
