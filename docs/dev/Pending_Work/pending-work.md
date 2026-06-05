# CleanMateX — Pending Work

**Last updated:** 2026-06-05  
**Source programs:** Order Fin v1.1 Full Alignment (0333–0341) + Post-v1.1 Hardening (0342) + Settings UI (0343)

---

## Process Gates (no code required — finance/QA action needed)

### 1. Tax-Document Compliance Sign-Off
**Owner:** Finance Lead  
**Blocker for:** ZATCA / UAE VAT production compliance claim  
**Checklist:** `docs/features/Order_Fin/Fix_29_05_2026/tax-doc-finance-signoff-checklist.md`  
**Query pack:** `docs/features/Order_Fin/Fix_29_05_2026/tax-doc-compliance-query-pack.sql`

Steps:
- Run 6 SQL queries on staging via Supabase SQL editor
- Confirm sequence gap-free, no duplicates, immutability trigger works, credit note chain intact
- Complete 2-week soak period with zero unexpected warnings
- Finance lead signs off in the checklist

### 2. TAX_INCLUSIVE Pricing Staging Soak
**Owner:** Finance Team + Dev  
**Blocker for:** Enabling TAX_INCLUSIVE mode in production for any tenant  
**Checklist:** `docs/dev/feature-flags/FF_TAX_INCLUSIVE_PRICING-soak-checklist.md`  
**Flag doc:** `docs/dev/feature-flags/FF_TAX_INCLUSIVE_PRICING.md`

Steps:
- Enable `tax_inclusive_pricing` flag in GrowthBook for test tenant(s) in staging
- Set `TAX_PRICING_MODE = TAX_INCLUSIVE` on the branch DB row directly (until Settings UI is live)
- Run through the verification checklist (financial snapshot fields, reconciliation zero-warning)
- Complete 2-week soak period
- Finance team reviews 3+ TAX_INCLUSIVE test orders

---

## Completed — This Session

### 3. Settings UI — Tenant Settings Page + Branch Settings Page
**Status:** DONE (2026-06-05)  
**Migration:** 0343 (`0343_nav_settings_tenant_branch_pages.sql`) — applied

New dedicated pages:
- `/dashboard/settings/tenant` — Tenant-level configuration including `tax_pricing_mode` and `extra_price_pricing_mode`
- `/dashboard/settings/branches` — Per-branch configuration with branch selector and pricing mode overrides

### 4. FF_TAX_INCLUSIVE_PRICING Access Contract Wiring
**Status:** DONE (2026-06-05)  
**Wired in:**
- `src/features/settings/ui/tenant-settings-screen.tsx` — `useFeature(FEATURE_FLAG_KEYS.TAX_INCLUSIVE_PRICING)` gates the TAX_INCLUSIVE option in the Tax Pricing Mode dropdown
- `src/features/settings/ui/branch-settings-screen.tsx` — same pattern

All three layers wired: Settings UI (tenant + branch) + calculator (`pricing-mode-resolver.service.ts`).  
Reference: `docs/dev/feature-flags/FF_TAX_INCLUSIVE_PRICING.md`

---

## Pre-Existing Issues (not introduced by recent programs)

### 6. 27 Failing Test Suites
**Nature:** Pre-existing failures unrelated to Order Fin or BVM work  
**Confirmed:** Failures exist on commit prior to current work (verified via `git stash`).  
**Example failures:**
- `ready-by-calculator.test.ts` — `TypeError: Cannot read properties of undefined (reading 'workingDays')`
- `workflow-service.test.ts`, `auth/validation.test.ts`, `db/prisma-middleware.test.ts`
- `order-cancel-service.test.ts`, `catalog.service.test.ts`, `settlement.service.test.ts`

**Recommendation:** Fix in a dedicated test-stabilization sprint before next release.

---

## Payment Modal V3 — QA Checklist
**Status:** Shipped 2026-05-19. Pending manual QA.  
**File:** `web-admin/src/features/orders/ui/payment-modal-v3.tsx`

- [ ] Open `/dashboard/orders/new` → payment modal renders correctly
- [ ] Test each conditional card: CHECK, B2B, partial payment, split legs
- [ ] Test RTL by switching locale to AR
- [ ] Test slow network simulation (hero skeleton visible)
- [ ] Submit an order → verify payload fires correctly to backend
