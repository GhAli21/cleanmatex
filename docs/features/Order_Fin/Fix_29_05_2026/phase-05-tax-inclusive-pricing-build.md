# Phase 05 — Tax-Inclusive Pricing (ADR-017 build)

**Status:** Done  
**Date:** 2026-06-05  
**Migration:** `supabase/migrations/0339_tax_pricing_mode_config.sql` — applied by user  
**ADR:** ADR-017 → status updated to **Implemented**

---

## What was built

### Database (migration 0339 — applied)

- `org_tenants_mst.tax_pricing_mode TEXT NOT NULL DEFAULT 'TAX_EXCLUSIVE'` — tenant default.
- `org_tenants_mst.extra_price_pricing_mode TEXT NOT NULL DEFAULT 'INCLUDED_IN_ITEM_PRICE'`.
- `org_branches_mst.tax_pricing_mode TEXT NULL` — branch override (NULL = inherit tenant).
- `org_branches_mst.extra_price_pricing_mode TEXT NULL`.
- Settings catalog entries: `TAX_PRICING_MODE`, `EXTRA_PRICE_PRICING_MODE` seeded into `sys_tenant_settings_cd` + `GENERAL_MAIN_PROFILE`.
- Permissions seeded: `tenant_settings:update_pricing_mode`, `branch_settings:update_pricing_mode`.

### Constants (`lib/constants/order-financial.ts`)

- `TAX_PRICING_MODES` — `TAX_EXCLUSIVE | TAX_INCLUSIVE`
- `EXTRA_PRICE_PRICING_MODES` — `INCLUDED_IN_ITEM_PRICE | SEPARATE_CHARGE`
- `RECONCILIATION_CHECK_NAMES.PRICING_MODE_CONSISTENCY`

### Types (`lib/types/order-financial.ts`)

- `TaxPricingMode` and `ExtraPricePricingMode` union types (re-exported from constants).
- `OrderFinancialCalculationSnapshot.taxPricingModeAtCalculation: TaxPricingMode` — new audit field.

### New service (`lib/services/pricing-mode-resolver.service.ts`)

- `resolveTaxPricingMode(client, tenantId, branchId)` — resolves branch → tenant → default.
- `resolveExtraPricePricingMode(client, tenantId, branchId)` — same pattern.
- Both accept a Prisma transaction client or the global client, so they work inside `recalculateOrderFinancialSnapshotTx`.

### Write service (`lib/services/order-financial-write.service.ts`)

- `extractTaxFromInclusive(inclusiveAmount, taxRate)` — new exported pure function.
  - Formula: `taxableAmount = inclusiveAmount / (1 + taxRate)`, `taxAmount = inclusiveAmount − taxableAmount`.
- `recalculateOrderFinancialSnapshotTx` now:
  1. Reads `branch_id` from the order header.
  2. Calls `resolveTaxPricingMode` inside the transaction.
  3. Passes `taxPricingMode` to `resolveCanonicalTotalAmount`.
  4. TAX_INCLUSIVE path: `taxAddend = 0` — tax is NOT added to total (it is already embedded in item prices).
  5. TAX_EXCLUSIVE path (default): unchanged — `taxAddend = totalTaxAmount`.
  6. Persists `taxPricingModeAtCalculation` in `financial_calculation_snapshot` JSON.
  7. `financial_engine_version` bumped from 4 → 5.
  8. `buildFinancialCalculationSnapshot.version` bumped to 5.

### Reconciliation (`lib/services/reconciliation/order-checks.ts`)

- `checkPricingModeConsistency(tenantId, window)` — compares `taxPricingModeAtCalculation` in the stored snapshot against current branch/tenant config. Emits `PRICING_MODE_CONSISTENCY` WARNING when there is a drift.

### Prisma schema (`web-admin/prisma/schema.prisma`)

- `org_tenants_mst`: `tax_pricing_mode String @default("TAX_EXCLUSIVE")`, `extra_price_pricing_mode String @default("INCLUDED_IN_ITEM_PRICE")`.
- `org_branches_mst`: `tax_pricing_mode String?`, `extra_price_pricing_mode String?`.

### i18n (EN + AR)

Keys added under the `OrderFinancial` namespace:
- `pricingMode.label`, `pricingMode.taxExclusive`, `pricingMode.taxInclusive`, `pricingMode.atCalculation`
- `extraPriceMode.label`, `extraPriceMode.includedInItemPrice`, `extraPriceMode.separateCharge`

### Tests

`__tests__/utils/order-financial-pricing-mode.test.ts` — 12 cases:
- Spec worked example: 105 @ 5% VAT → taxable 100, tax 5.
- Various rates: 15% (Saudi), 10%.
- Fractional cents with rounding to 4dp.
- Edge cases: zero rate, negative rate, zero amount.
- Multi-rate combined 15% scenario.
- TAX_EXCLUSIVE regression documentation test.

---

## Formula identities (locked)

```
TAX_EXCLUSIVE (default, unchanged):
  total = items_base + charges − discounts + tax + rounding

TAX_INCLUSIVE (new):
  total = items_base + charges − discounts + rounding
  (tax is extracted from inclusive item prices; NOT added again)
  
  extraction: taxable = inclusive / (1 + rate)
              tax     = inclusive − taxable
```

---

## Feature flag

`FF_TAX_INCLUSIVE_PRICING` — gates Settings UI exposure for 2-week soak.  
The calculator handles both modes regardless of the flag; the flag only controls whether the settings UI page is visible.  
> Flag is **not wired in this phase** (Phase 8 UI consolidation handles the settings page). The calculator is live for all tenants but defaults to `TAX_EXCLUSIVE`, so no behavior changes until a tenant/branch is explicitly configured.

---

## Validation gates (all green)

| Gate | Result |
|---|---|
| `prisma generate` | ✅ |
| `npx tsc --noEmit` | ✅ |
| `npm run check:i18n` | ✅ |
| Jest `order-financial-pricing-mode` (12 tests) | ✅ |
| Jest `order-financial-effective-snapshot` (4 tests) | ✅ |
| Jest `order-financial-tax-document-mismatch` (8 tests) | ✅ |
| `npm run build` | ✅ |

---

## ADR-017 status

**Implemented** — 2026-06-05.
