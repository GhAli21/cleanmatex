import { CommercialRuleError } from '@/lib/commercial/errors';
import { decideOrderLineTax, taxPartyScope, type OrderTaxCode, type OrderTaxEngine, type OrderTaxRule } from '@/lib/tax/order-line-tax';

const code = (taxCode: string, categoryCode: string, ratePercent: string, over: Partial<OrderTaxCode> = {}): OrderTaxCode => ({
  id: `${taxCode}-1`, taxCode, taxType: 'VAT', ratePercent, rateMissing: false, isCompound: false, isDefault: false,
  roundingLevel: 'LINE', rounding: { decimalPlaces: 3, mode: 'HALF_UP' }, versionNo: 1, effectiveFrom: '2020-01-01', effectiveTo: null,
  amountKind: 'PERCENT', calcLevel: 'LINE', categoryCode, exemptReasonCode: null, ...over,
});

const rule = (id: string, tax_codes: string[], over: Partial<OrderTaxRule> = {}): OrderTaxRule => ({
  id, tax_codes, priority: 100, effective_from: '2020-01-01', effective_to: null, doc_type_code: null, tax_flow_code: 'OUTPUT', branch_id: null,
  place_of_supply_country: null, tax_item_class_code: null, party_tax_class_code: null, party_country_scope: null, service_category_code: null, ...over,
});

const engine = (rules: OrderTaxRule[], over: Partial<OrderTaxEngine> = {}): OrderTaxEngine => ({
  rules, codes: [code('VAT_STD', 'STANDARD', '5'), code('VAT_ZERO', 'ZERO_RATED', '0'), code('VAT_EXEMPT', 'EXEMPT', '0')],
  date: '2026-11-09', branchId: null, placeOfSupplyCountry: 'OM', defaultItemClass: 'LAUNDRY', partyTaxClass: 'CONSUMER', partyCountryScope: 'DOMESTIC', ...over,
});

const line = { itemClass: null, serviceCategory: null, customerExempt: false, serviceExempt: false };
const errorCode = (fn: () => unknown) => {
  try { fn(); } catch (e) { return e instanceof CommercialRuleError ? e.code : String(e); }
  return 'no error';
};

describe('decideOrderLineTax', () => {
  it('charges the STANDARD codes of the matching rule and records the rule', () => {
    const decided = decideOrderLineTax(engine([rule('any', ['VAT_STD'])]), line);
    expect(decided.taxCategoryCode).toBe('STANDARD');
    expect(decided.profiles.map((p) => p.id)).toEqual(['VAT_STD-1']);
    expect(decided.record).toEqual({ ruleId: 'any', zeroCode: null });
  });

  it('a line with no class uses the default class, so the class rule wins over the catch-all', () => {
    const rules = [rule('any', ['VAT_STD'], { priority: 900 }), rule('laundry', ['VAT_ZERO'], { tax_item_class_code: 'LAUNDRY' })];
    expect(decideOrderLineTax(engine(rules), line).record.ruleId).toBe('laundry');
  });

  it('a zero-rated rule charges nothing and keeps its code for the record', () => {
    const decided = decideOrderLineTax(engine([rule('zero', ['VAT_ZERO'])]), line);
    expect(decided).toMatchObject({ taxCategoryCode: 'ZERO_RATED', profiles: [], record: { zeroCode: { taxCode: 'VAT_ZERO' } } });
  });

  it('a customer exemption replaces a standard charge with the EXEMPT code', () => {
    const decided = decideOrderLineTax(engine([rule('any', ['VAT_STD'])]), { ...line, customerExempt: true });
    expect(decided).toMatchObject({ taxCategoryCode: 'EXEMPT', exemptReason: 'CUSTOMER_EXEMPTION', profiles: [], record: { zeroCode: { taxCode: 'VAT_EXEMPT' } } });
  });

  it('picks the version in force on the order date', () => {
    const codes = [code('VAT_STD', 'STANDARD', '5', { effectiveTo: '2026-06-30' }), code('VAT_STD', 'STANDARD', '10', { id: 'VAT_STD-2', versionNo: 2, effectiveFrom: '2026-07-01' })];
    expect(decideOrderLineTax(engine([rule('any', ['VAT_STD'])], { codes }), line).profiles[0].ratePercent).toBe('10');
    expect(decideOrderLineTax(engine([rule('any', ['VAT_STD'])], { codes, date: '2026-06-30' }), line).profiles[0].ratePercent).toBe('5');
  });

  it('refuses instead of guessing', () => {
    expect(errorCode(() => decideOrderLineTax(engine([]), line))).toBe('NO_TAX_RULE');
    expect(errorCode(() => decideOrderLineTax(engine([rule('a', ['VAT_STD']), rule('b', ['VAT_STD'])]), line))).toBe('TAX_RULE_AMBIGUOUS');
    expect(errorCode(() => decideOrderLineTax(engine([rule('a', ['NOPE'])]), line))).toBe('TAX_CODE_VERSION_MISSING');
    const fixed = [code('LEVY', 'STANDARD', '0', { amountKind: 'FIXED' })];
    expect(errorCode(() => decideOrderLineTax(engine([rule('a', ['LEVY'])], { codes: fixed }), line))).toBe('TAX_CODE_UNSUPPORTED');
    const noRate = [code('VAT_STD', 'STANDARD', '0', { rateMissing: true })];
    expect(errorCode(() => decideOrderLineTax(engine([rule('a', ['VAT_STD'])], { codes: noRate }), line))).toBe('TAX_CODE_VERSION_MISSING');
  });
});

describe('taxPartyScope', () => {
  it('reads domestic, GCC and foreign', () => {
    expect(taxPartyScope(null, 'OM')).toBe('DOMESTIC');
    expect(taxPartyScope('om', 'OM')).toBe('DOMESTIC');
    expect(taxPartyScope('SA', 'OM')).toBe('GCC');
    expect(taxPartyScope('IN', 'OM')).toBe('FOREIGN');
  });
});
