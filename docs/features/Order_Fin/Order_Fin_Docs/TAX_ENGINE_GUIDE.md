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

## Additional Tax (Order Tax)

Separate from VAT — applied as a fixed rate or amount on top of the VAT-inclusive total:

```
additionalTax = additionalTaxAmountParam  // if provided
              || (afterDiscounts × additionalTaxRate / 100)  // if rate given
              || 0
```

Stored in `org_order_taxes_dtl` with a separate row (taxType='CUSTOM').
