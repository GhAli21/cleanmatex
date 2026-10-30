# Retire the `TENANT_VAT_RATE` Settings Fallback

**Date:** 2026-10-28 · **Status:** PLAN, approved in principle by owner ("retire all") · awaiting go on the steps below
**Origin:** `docs/features/Order_Fin/Performance_Enhance/Settings_Resolver_Remediation_Plan.md` (tracked gap)

## 1. Current behavior (verified)

- Tax comes from **tenant tax profiles** (`org_tax_profiles_cf`). `lib/commercial/tax.ts` picks the special profiles that match a line's supply code, otherwise the tenant's **default** profiles (`is_default`, `applies_to` NULL or empty).
- **Only when the tenant has no default profile** does the calculator use the settings value `TENANT_VAT_RATE` (`isTenantRateFallback`, `TENANT_RATE_PROFILE_ID`). `TaxService.getTaxRate` reads it through the settings resolver and caches it **in memory for 5 minutes** (a stale-rate risk after a change).
- Remote data (2026-10-28):

| Tenant | Default VAT profile | `TENANT_VAT_RATE` | Effect of removing the fallback without a backfill |
|---|---|---|---|
| Demo Laundry LLC | VAT 5% ✅ | 0.05 | none |
| Demo Saudi Riyadh Dry Clean | VAT 15% ✅ | 0.15 | none |
| **BlueWave Laundry Co.** | **none** | 0.05 | **VAT drops from 5% to 0%** ❌ |

## 2. Target

One tax source: **tax profiles only.** No settings-based rate and no TaxService rate cache. If a tenant has no applicable profile, there is no tax line. That is the existing B15 rule ("never an assumed positive rate"), now applied without the fallback. Tax readiness surfaces the missing default profile; tax is never invented.

## 3. Steps

| # | Change | Files |
|---|---|---|
| R1 | **Migration:** create a default `VAT` profile for every active tenant that has no default VAT/GST profile, from its resolved `TENANT_VAT_RATE` (BlueWave → 5%). Rounding fields copied from the platform defaults used by the existing profiles. Skip tenants whose rate is 0 or unset. Idempotent. | `supabase/migrations/06xx_tax_profile_backfill.sql` |
| R2 | Calculator: delete the tenant-rate fallback profile path (`isTenantRateFallback`, `TENANT_RATE_PROFILE_ID`, `getTenantVatRate`). | `lib/commercial/tax.ts`, `lib/services/commercial/commercial-{quote.service,context.loader,edit.loader,line.writer,checkout.service}.ts` |
| R3 | Legacy calculator and readers: remove the `tax_fallback` branch and `TaxService.getTaxRate` callers; read the default profile instead. | `lib/services/order-calculation.service.ts:349`, `lib/services/pricing.service.ts:275,393`, `lib/services/order-change/order-change-preview-reads.ts:262`, `app/api/v1/public/customer/booking/route.ts` GET bootstrap `vatRate` (display only; the submit is priced by the calculator since 2026-10-28), `app/api/v1/public/customer/booking/route.ts:415,865`, `app/api/v1/preparation/[id]/preview/route.ts` |
| R4 | Remove `TaxService.getTaxRate`, its 5-minute cache and `clearAllCache`. | `lib/services/tax.service.ts` |
| R5 | UI: the Finance settings page edits `TENANT_VAT_RATE`. Replace that section with a link to the tax profiles screen (`/dashboard/settings/tax`), EN/AR, Cmx components, `cmxMessage`. | `app/dashboard/settings/finance/page.tsx`, `messages/{en,ar}/…` |
| R6 | **Migration:** deactivate catalog settings `TENANT_VAT_RATE`, `TAX_RATE`, `TENANT_VAT_ENABLED` and their profile values (`is_active=false`, kept for history). Remove `SETTING_CODES.TENANT_VAT_RATE`. `TAX_PRICING_MODE` stays (inclusive/exclusive is still used). | migration + `lib/services/tenant-settings.service.ts` |
| R7 | Tests: update the characterization/golden tests that use the fallback; add a test that a tenant with no default profile gets no tax line and a readiness warning. | `__tests__/commercial/tax.test.ts`, `__tests__/services/commercial/*`, `__tests__/db-integration/order-change-reviewed-snapshots.db.test.ts` |
| R8 | Gates: `npx tsc`, `npx eslint . --quiet`, jest (commercial + money goldens), `npm run build`, `npm run check:i18n`. | — |

**Order:** R1 applied and verified (BlueWave quote unchanged at 5%) → R2–R5 + R7 → R6 last, so a rollback of code never meets a deactivated setting.

## 4. Risks

- **Money:** R1 must land first. The R7 golden tests must show **no amount change** for the two tenants with profiles, and BlueWave's quote must stay at 5% after R1.
- **Coordination:** this edits Line-Level calculator files. Sequence it with the Line-Level `STATUS.md` execution order (P5-03d in flight) to avoid merge conflicts.
- **HQ:** the settings catalog is HQ-managed. R6 deactivation is a migration here, but HQ screens that list these codes should be checked.
