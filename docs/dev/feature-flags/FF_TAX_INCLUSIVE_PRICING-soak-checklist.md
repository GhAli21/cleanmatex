# TAX_INCLUSIVE Soak Checklist

**Flag:** `tax_inclusive_pricing`  
**Soak period:** 2 weeks minimum before production compliance claim  
**Prerequisite:** Settings UI live at `/dashboard/settings/tenant` and `/dashboard/settings/branches` (2026-06-05)

---

## Enable

- [ ] Enable `tax_inclusive_pricing` in GrowthBook for test tenant(s) in staging
- [ ] Open `/dashboard/settings/branches` → select test branch → set Tax Pricing Mode to TAX_INCLUSIVE → save
- [ ] Create and submit a test order on the TAX_INCLUSIVE branch

---

## Verify per order (staging)

- [ ] `financial_calculation_snapshot.taxPricingModeAtCalculation === 'TAX_INCLUSIVE'`
- [ ] `total_amount === subtotal_amount + rounding` (tax is extracted from price, not added)
- [ ] `total_tax_amount = total_amount × tax_rate / (1 + tax_rate)` (within rounding tolerance)
- [ ] `subtotal_amount + total_tax_amount ≈ total_amount` (within rounding tolerance)
- [ ] Reconciliation check — zero `ORDER_TOTAL_COMPONENT_MISMATCH` warnings on TAX_INCLUSIVE orders

---

## Regression — TAX_EXCLUSIVE orders unaffected

- [ ] Existing TAX_EXCLUSIVE orders: `total_amount = subtotal + tax + rounding`
- [ ] `financial_calculation_snapshot.taxPricingModeAtCalculation === 'TAX_EXCLUSIVE'` on existing orders
- [ ] `npm run check:legacy` — exit 0
- [ ] `npm run check:i18n` — green
- [ ] `npm run build` — green

---

## Sign-off gate

- [ ] 2 weeks of zero unexpected warnings in staging on TAX_INCLUSIVE orders
- [ ] Finance team has reviewed at least 3 TAX_INCLUSIVE test orders and verified amounts
- [ ] Reconciliation run on staging shows no new warning codes introduced
- [ ] Sign-off date: ________________
- [ ] Signed by: ________________
