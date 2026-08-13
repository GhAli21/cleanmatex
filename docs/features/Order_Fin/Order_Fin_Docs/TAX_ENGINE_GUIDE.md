# Tax Engine Guide — Profile Config, Compound Tax, Exemptions

## How Tax Profiles Work

Tax profiles in `org_tax_profiles_cf` define the applicable rate for an order. The tenant configures one or more profiles, one of which is marked `is_default = true`.

`TaxService.getTaxRate(tenantId, branchId?, userId?)` resolves the rate:
1. Looks up the default (or branch-specific) profile for the tenant
2. Returns the rate as a decimal (0.05 = 5%)
3. Returns 0 if no active profile found

## Compound Tax

If `compound = true` on a profile, it applies on top of any already-applied VAT:

```
base = afterDiscounts + previousTaxAmount
compoundTax = base × compoundRate
```

In V1, compound tax is a config flag — the engine handles one compound layer.

## Tax Exemptions

`org_tax_exemptions_cf` maps exemptions by customer or service category:

```typescript
// Check exemption before calculating tax
const exempt = await tx.org_tax_exemptions_cf.findFirst({
  where: {
    tenant_org_id: tenantId,
    OR: [
      { customer_id: customerId },
      { service_category: { in: serviceCategories } }
    ],
    is_active: true,
  }
});
if (exempt) return []; // zero tax
```

Customer-level exemptions take priority over category-level. A customer marked exempt pays no tax regardless of service category.

## `calculateTax` vs `calculateTaxInTx`

- `calculateTax(tenantId, params)` — standalone, for preview/calculation
- `calculateTaxInTx(tx, tenantId, params)` — uses transaction client (inside settlement)

Both return `TaxLineItem[]`:
```typescript
type TaxLineItem = {
  taxType:    string; // 'VAT' | 'CUSTOM'
  label:      string;
  label2:     string | null;
  rate:       number;
  baseAmount: number;
  taxAmount:  number;
};
```

## Additional Tax (CUSTOM tax lines)

`calculateOrderTotals` reports `additionalTaxAmount` — the sum of `CUSTOM`-type
lines from the resolved tax breakdown, kept separate from VAT/GST (`vatValue`)
for display and reporting. Stored in `org_order_taxes_dtl` as its own row
(`taxType='CUSTOM'`).

CUSTOM lines come from configured **tax profiles** only, exactly like VAT/GST —
same resolution mechanism, same compounding rules, same TAX_INCLUSIVE handling.
When no tax profile applies, `additionalTaxAmount` is `0`.

> **Removed 2026-08-13 (B28 follow-up #4):** the ad-hoc, client-supplied
> `additionalTaxRate` / `additionalTaxAmount` request params previously
> documented here. They were accepted on the submit path but had no equivalent
> on the preview routes, so a non-zero value would have made the payment-modal
> preview disagree with the amount actually charged. Verified dead in practice
> before removal (no caller could send a non-zero value). Tax now has exactly
> two authoritative sources: configured tax profiles, and the server-resolved
> `TENANT_VAT_RATE` fallback (zero by default per B15). Regression guard:
> `__tests__/validations/preview-submit-param-parity.test.ts`.

---

## Fiscal-total check live (Remediation 2026-07 Phase 6 — FN-03)

The snapshot recalc now reads the linked `org_tax_documents_mst.total_amount` and fires `TAX_DOCUMENT_TOTAL_MISMATCH` when it differs from the recomputed order total by more than 0.001 (spec §16.1). No linked document → no check, no false positives. Per-category tax-base decomposition remains a separate, still-open e-invoicing work item (ADR-052).
