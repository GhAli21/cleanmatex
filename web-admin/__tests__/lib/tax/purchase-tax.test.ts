/** Purchase and withholding tax: rules pick the code; a typed amount is checked, never rewritten. */
import { CommercialRuleError } from '@/lib/commercial/errors';
import { toMoney } from '@/lib/commercial/money';
import { decidePurchaseTax, type PurchaseTaxCode, type PurchaseTaxFacts, type PurchaseTaxRule } from '@/lib/tax/purchase-tax';

const rule = (id: string, itemClass: string | null, codes: string[], priority = 100, flow = 'INPUT'): PurchaseTaxRule => ({
  id, doc_type_code: null, tax_flow_code: flow, branch_id: null, place_of_supply_country: null, tax_item_class_code: itemClass,
  party_tax_class_code: null, party_country_scope: null, service_category_code: null, priority,
  effective_from: '2020-01-01', effective_to: null, tax_codes: codes,
});
const code = (taxCode: string, rate: string | null, recoverablePct = '100', categoryCode = 'STANDARD'): PurchaseTaxCode => ({
  id: `p-${taxCode}`, taxCode, versionNo: 1, effectiveFrom: '2020-01-01', effectiveTo: null, ratePercent: rate,
  amountKind: 'PERCENT', calcLevel: 'LINE', categoryCode, exemptReasonCode: null, recoverablePct,
});

const RULES = [
  rule('r-std', 'PURCHASE_STANDARD', ['VAT_IN_STD']),
  rule('r-nonrec', 'PURCHASE_NON_REC', ['VAT_IN_NONREC']),
  rule('r-any', null, ['VAT_IN_STD'], 900),
  rule('r-wht', null, ['WHT_NONE'], 900, 'WITHHOLDING'),
];
const CODES = [code('VAT_IN_STD', '5.00'), code('VAT_IN_NONREC', '5.00', '0'), code('WHT_NONE', '0.00', '0', 'OUT_OF_SCOPE')];
const facts = (over: Partial<PurchaseTaxFacts> = {}): PurchaseTaxFacts => ({
  flow: 'INPUT', docTypeCode: 'ERP_AP_INVOICE', date: '2026-11-10', branchId: null, placeOfSupplyCountry: 'OM',
  itemClass: 'PURCHASE_STANDARD', partyTaxClass: 'BUSINESS_REGISTERED', partyCountryScope: 'DOMESTIC',
  net: toMoney('100.000'), enteredTax: null, decimals: 3, ...over,
});
const codeOf = (fn: () => unknown) => {
  try { fn(); } catch (e) { return (e as CommercialRuleError).code; }
  return null;
};

describe('decidePurchaseTax', () => {
  it('a blank tax takes the code: 5% of 100.000, fully recoverable', () => {
    const r = decidePurchaseTax(RULES, CODES, facts());
    expect(r.ruleId).toBe('r-std');
    expect(r.taxAmount.toFixed(3)).toBe('5.000');
    expect(r.parts[0].recoverable.toFixed(3)).toBe('5.000');
  });

  it('a non-recoverable class charges the same tax but reclaims nothing', () => {
    const r = decidePurchaseTax(RULES, CODES, facts({ itemClass: 'PURCHASE_NON_REC' }));
    expect(r.taxAmount.toFixed(3)).toBe('5.000');
    expect(r.parts[0].recoverable.toFixed(3)).toBe('0.000');
  });

  it("keeps the supplier's rounding within one minor unit", () => {
    const r = decidePurchaseTax(RULES, CODES, facts({ net: toMoney('10.010'), enteredTax: toMoney('0.501') }));
    expect(r.taxAmount.toFixed(3)).toBe('0.501');
  });

  it('refuses a typed tax that does not match the code, and does not rewrite it', () => {
    expect(codeOf(() => decidePurchaseTax(RULES, CODES, facts({ enteredTax: toMoney('7.000') })))).toBe('PURCHASE_TAX_MISMATCH');
  });

  it('no rule for the flow is refused, never a silent zero', () => {
    expect(codeOf(() => decidePurchaseTax(RULES.slice(0, 2), CODES, facts({ itemClass: 'OTHER' })))).toBe('NO_TAX_RULE');
  });

  it('withholding at 0% gives no tax and nothing recoverable', () => {
    const r = decidePurchaseTax(RULES, CODES, facts({ flow: 'WITHHOLDING', itemClass: null, docTypeCode: 'ERP_AP_PAYMENT' }));
    expect(r.ruleId).toBe('r-wht');
    expect(r.taxAmount.isZero()).toBe(true);
    expect(r.parts[0].recoverable.isZero()).toBe(true);
  });
});
