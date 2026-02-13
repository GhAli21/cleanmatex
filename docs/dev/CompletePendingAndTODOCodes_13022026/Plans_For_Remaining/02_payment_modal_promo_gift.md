# Plan: Payment Modal Promo/Gift Card (Legacy Migration)

**Status:** ✅ Implemented (2026-02)

## Overview

The **legacy** `payment-modal-enhanced.tsx` was the older payment modal. The canonical version `payment-modal-enhanced-02.tsx` has UI/UX optimizations and uses `validatePromoCodeAction` and `validateGiftCardAction`. Legacy file has been removed; only PaymentModalEnhanced02 is used.

## Current State

- **Legacy file:** `web-admin/app/dashboard/orders/new/components/payment-modal-enhanced.tsx`
  - Uses `validatePromoCodeAction`, `validateGiftCardAction`
  - Older UI/UX; to be deprecated in favor of enhanced-02
- **Current/Canonical file:** `payment-modal-enhanced-02.tsx` (used in new order flow)
  - Mirrors enhanced functionality with UI/UX optimizations
  - Full validation and discount application

## Options

### Option A: Deprecate Legacy Modal (Recommended)

- Confirm `payment-modal-enhanced.tsx` is not imported anywhere
- Remove or mark as deprecated
- Ensure all references use `PaymentModalEnhanced02`

### Option B: Keep Both in Sync

- If both are used: align `payment-modal-enhanced.tsx` with any fixes in enhanced-02
- Prefer consolidating to single modal (enhanced-02) long term

## Prerequisites

- Audit where `PaymentModalEnhanced` (legacy) vs `PaymentModalEnhanced02` is used
- `validatePromoCodeAction` and `validateGiftCardAction` exist in `app/actions/payments/`

## Implementation Steps (Option A)

1. Grep codebase for `payment-modal-enhanced` imports and `PaymentModalEnhanced` usage
2. If legacy unused: Add deprecation comment, or delete `payment-modal-enhanced.tsx`
3. Ensure new order flow uses only `PaymentModalEnhanced02`
4. Update README/plans to note legacy removal

## Implementation Steps (Option B)

1. If both modals remain in use: ensure promo/gift validation is identical in both
2. Port any UI/UX fixes from enhanced-02 back to enhanced when needed
3. Prefer migrating to single modal (enhanced-02) to avoid divergence

## Acceptance Criteria

- [x] No duplicate payment modal code; legacy removed
- [x] Only PaymentModalEnhanced02 used (new-order-modals.tsx)
- [x] Promo and gift card flows work in PaymentModalEnhanced02

## Production Checklist

- [ ] Confirm which modal is used in production flow
- [ ] Test promo/gift card apply in new order
- [ ] i18n keys consistent

## References

- `web-admin/app/dashboard/orders/new/components/payment-modal-enhanced-02.tsx` (canonical; legacy removed)
- `web-admin/app/actions/payments/validate-promo.ts`
- `web-admin/app/actions/payments/validate-gift-card.ts`
- `web-admin/lib/services/discount-service.ts`
- `web-admin/lib/services/gift-card-service.ts`
