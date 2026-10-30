/**
 * P4-04 — tax per row (ADR-060 §6, PLAN.md §8.2, §9, §15 test matrix).
 */
import fc from 'fast-check';
import {
  CommercialRuleError,
  calculateTax,
  resolveTaxCategory,
  selectTaxProfiles,
  sumMoney,
  toMoney,
  type TaxProfileInput,
  type TaxRowInput,
} from '@/lib/commercial';

const OMR = { decimalPlaces: 3, mode: 'HALF_UP' as const };

const profile = (over: Partial<TaxProfileInput> = {}): TaxProfileInput => ({
  id: 'vat',
  taxType: 'VAT',
  ratePercent: '5',
  isCompound: false,
  isDefault: true,
  appliesTo: null,
  roundingLevel: 'DOCUMENT',
  rounding: OMR,
  ...over,
});

// Tenant 1111… on remote: VAT 5% + municipal 2% (both default, stacking), plus special 0% profiles.
const vat5 = profile();
const muni2 = profile({ id: 'muni', taxType: 'CUSTOM', ratePercent: '2', appliesTo: [] });
const exemptSvc = profile({ id: 'exempt', ratePercent: '0', isDefault: false, appliesTo: ['EXEMPT_SERVICE'] });
const tobacco = profile({ id: 'tobacco', taxType: 'CUSTOM', ratePercent: '100', isDefault: false, appliesTo: ['TOBACCO'] });

const row = (rowId: string, net: string, over: Partial<TaxRowInput> = {}): TaxRowInput => ({
  rowId, netAmount: net, taxCategoryCode: 'STANDARD', exemptReason: null, profiles: [vat5], ...over,
});

const run = (rows: TaxRowInput[], over: Partial<Parameters<typeof calculateTax>[0]> = {}) =>
  calculateTax({ rows, pricingMode: 'TAX_EXCLUSIVE', currencyDecimalPlaces: 3, ...over });

const s = (value: { toString(): string } | undefined) => value?.toString();

describe('selectTaxProfiles', () => {
  const all = [vat5, exemptSvc, muni2, tobacco, profile({ id: 'nondefault', isDefault: false })];

  it('a row with no supply code gets every default general profile (stacking, as today)', () => {
    expect(selectTaxProfiles(all, null).map((p) => p.id)).toEqual(['vat', 'muni']);
  });

  it('PF-06: a listed supply code gets its own profiles instead of the defaults', () => {
    expect(selectTaxProfiles(all, 'EXEMPT_SERVICE').map((p) => p.id)).toEqual(['exempt']);
    expect(selectTaxProfiles(all, 'TOBACCO').map((p) => p.id)).toEqual(['tobacco']);
  });

  it('an unlisted supply code falls back to the defaults', () => {
    expect(selectTaxProfiles(all, 'UNKNOWN').map((p) => p.id)).toEqual(['vat', 'muni']);
  });

  it('puts compound profiles last', () => {
    const compound = profile({ id: 'cmp', isCompound: true });
    expect(selectTaxProfiles([compound, vat5], null).map((p) => p.id)).toEqual(['vat', 'cmp']);
  });
});

describe('resolveTaxCategory', () => {
  const base = { productCategory: 'STANDARD', productExemptReason: null, customerExempt: false, serviceExempt: false };
  it('customer exemption, then service exemption, then the product category', () => {
    expect(resolveTaxCategory({ ...base, customerExempt: true, serviceExempt: true })).toEqual({ category: 'EXEMPT', exemptReason: 'CUSTOMER_EXEMPTION' });
    expect(resolveTaxCategory({ ...base, serviceExempt: true })).toEqual({ category: 'EXEMPT', exemptReason: 'SERVICE_EXEMPTION' });
    expect(resolveTaxCategory(base)).toEqual({ category: 'STANDARD', exemptReason: null });
    expect(resolveTaxCategory({ ...base, productCategory: null })).toEqual({ category: 'STANDARD', exemptReason: null });
    expect(resolveTaxCategory({ ...base, productCategory: 'ZERO_RATED', productExemptReason: 'VATEX-SA-32' }))
      .toEqual({ category: 'ZERO_RATED', exemptReason: 'VATEX-SA-32' });
    expect(resolveTaxCategory({ ...base, productCategory: 'OUT_OF_SCOPE' })).toEqual({ category: 'OUT_OF_SCOPE', exemptReason: 'PRODUCT_EXEMPT' });
  });
});

describe('calculateTax — exclusive', () => {
  it('taxes each row and adds tax on top (I5)', () => {
    const result = run([row('L1', '10'), row('L2', '20')]);
    expect(s(result.rows.get('L1')?.taxAmount)).toBe('0.5');
    expect(s(result.rows.get('L1')?.lineTotalAmount)).toBe('10.5');
    expect(s(result.rows.get('L1')?.taxableAmount)).toBe('10');
    expect(result.rows.get('L1')).toMatchObject({ taxProfileId: 'vat' });
    expect(s(result.rows.get('L1')?.taxRate)).toBe('5');
    expect(s(result.documentTaxTotal)).toBe('1.5');
    expect(s(result.lineTaxTotal)).toBe('1.5');
    expect(result.taxLines).toHaveLength(1);
    expect(s(result.taxLines[0].taxableAmount)).toBe('30');
  });

  it('stacks VAT 5% + municipal 2% into one combined 7% per row (PLAN §6.8)', () => {
    const result = run([row('L1', '10', { profiles: [vat5, muni2] })]);
    const r = result.rows.get('L1')!;
    expect(s(r.taxAmount)).toBe('0.7');
    expect(s(r.taxRate)).toBe('7');
    expect(r.profileTaxes.map((t) => [t.profileId, t.amount.toString()])).toEqual([['vat', '0.5'], ['muni', '0.2']]);
    expect(result.taxLines.map((l) => l.profileId)).toEqual(['vat', 'muni']);
  });

  it('compound profiles tax base + prior tax', () => {
    const compound = profile({ id: 'cmp', ratePercent: '10', isCompound: true });
    const result = run([row('L1', '100', { profiles: [vat5, compound] })]);
    expect(result.rows.get('L1')!.profileTaxes.map((t) => t.amount.toString())).toEqual(['5', '10.5']);
    expect(s(result.rows.get('L1')?.taxRate)).toBe('15.5');
    expect(s(result.taxLines[1].taxableAmount)).toBe('105');
  });

  it('PF-04/PF-05: an exempt row has no tax and never falls back; other rows are still taxed', () => {
    const result = run([
      row('L1', '10', { taxCategoryCode: 'EXEMPT', exemptReason: 'SERVICE_EXEMPTION' }),
      row('L2', '10'),
    ]);
    expect(result.rows.get('L1')).toMatchObject({ taxProfileId: null, exemptReason: 'SERVICE_EXEMPTION' });
    expect(s(result.rows.get('L1')?.taxAmount)).toBe('0');
    expect(s(result.rows.get('L1')?.lineTotalAmount)).toBe('10');
    expect(s(result.rows.get('L2')?.taxAmount)).toBe('0.5');
    expect(s(result.categoryTaxable.get('EXEMPT'))).toBe('10');
    expect(s(result.categoryTaxable.get('STANDARD'))).toBe('10');
  });

  it('the tenant-rate fallback profile is applied but stored with no profile id', () => {
    const fallback = profile({ id: 'tenant-rate', isTenantRateFallback: true });
    const result = run([row('L1', '10', { profiles: [fallback] })]);
    expect(result.rows.get('L1')).toMatchObject({ taxProfileId: null });
    expect(s(result.rows.get('L1')?.taxAmount)).toBe('0.5');
    expect(result.taxLines[0].isTenantRateFallback).toBe(true);
  });
});

describe('calculateTax — rounding levels', () => {
  // 3 rows of 0.333 at 5%: each row 0.01665 → 0.017 (LINE) ; total 0.04995 → 0.05 (DOCUMENT).
  const rows = [row('A', '0.333'), row('B', '0.333'), row('C', '0.333')];

  it('DOCUMENT (seeded): round once on the total, split exactly to rows', () => {
    const result = run(rows);
    expect(s(result.documentTaxTotal)).toBe('0.05');
    expect(['A', 'B', 'C'].map((id) => s(result.rows.get(id)?.taxAmount))).toEqual(['0.017', '0.017', '0.016']);
    expect(s(result.lineTaxTotal)).toBe('0.05');
  });

  it('LINE: round each row; the header is the sum', () => {
    const line = rows.map((r) => ({ ...r, profiles: [profile({ roundingLevel: 'LINE' })] }));
    const result = run(line);
    expect(['A', 'B', 'C'].map((id) => s(result.rows.get(id)?.taxAmount))).toEqual(['0.017', '0.017', '0.017']);
    expect(s(result.documentTaxTotal)).toBe('0.051');
  });

  it('uses the profile rule: decimals, mode and increment', () => {
    const coarse = profile({ rounding: { decimalPlaces: 2, mode: 'UP', incrementMinor: 5 } });
    const result = run([row('L1', '10.01', { profiles: [coarse] })]); // 0.5005 → UP to 0.55
    expect(s(result.rows.get('L1')?.taxAmount)).toBe('0.55');
  });
});

describe('calculateTax — inclusive', () => {
  it('extracts the tax from the price; total = net (I5)', () => {
    const result = run([row('L1', '10.5')], { pricingMode: 'TAX_INCLUSIVE' });
    const r = result.rows.get('L1')!;
    expect(s(r.taxAmount)).toBe('0.5');
    expect(s(r.taxableAmount)).toBe('10');
    expect(s(r.lineTotalAmount)).toBe('10.5');
    expect(s(result.taxLines[0].taxableAmount)).toBe('10');
  });

  it('extracts stacked rates with the combined rate (as B11)', () => {
    const result = run([row('L1', '10.7', { profiles: [vat5, muni2] })], { pricingMode: 'TAX_INCLUSIVE' });
    expect(result.rows.get('L1')!.profileTaxes.map((t) => t.amount.toString())).toEqual(['0.5', '0.2']);
    expect(s(result.rows.get('L1')?.taxableAmount)).toBe('10');
  });
});

describe('calculateTax — DOCUMENT_LEVEL allowance', () => {
  it('row tax stays on the row\'s own net; the header taxes base − allowance (I3)', () => {
    const result = run([row('L1', '10'), row('L2', '10')], { documentAllowances: new Map([['STANDARD', '4']]) });
    expect(s(result.lineTaxTotal)).toBe('1');
    expect(s(result.documentTaxTotal)).toBe('0.8');
    expect(s(result.taxLines[0].taxableAmount)).toBe('16');
    expect(s(result.categoryTaxable.get('STANDARD'))).toBe('16');
  });

  it('LINE rounding subtracts the allowance\'s own rounded tax', () => {
    const line = profile({ roundingLevel: 'LINE' });
    const result = run([row('L1', '10', { profiles: [line] })], { documentAllowances: new Map([['STANDARD', '0.333']]) });
    expect(s(result.documentTaxTotal)).toBe('0.483'); // 0.5 − round(0.01665)
  });

  it('splits a category allowance across its profile groups by net', () => {
    const result = run([
      row('L1', '30'),
      row('L2', '10', { profiles: [tobacco] }),
    ], { documentAllowances: new Map([['STANDARD', '4']]) });
    // groups: VAT 30 → allowance 3; tobacco 10 → allowance 1
    expect(result.taxLines.map((l) => [l.profileId, l.taxableAmount.toString(), l.taxAmount.toString()]))
      .toEqual([['vat', '27', '1.35'], ['tobacco', '9', '9']]);
  });

  it('inclusive: the allowance is inclusive too', () => {
    const result = run([row('L1', '21')], { pricingMode: 'TAX_INCLUSIVE', documentAllowances: new Map([['STANDARD', '10.5']]) });
    expect(s(result.lineTaxTotal)).toBe('1');
    expect(s(result.documentTaxTotal)).toBe('0.5');
    expect(s(result.categoryTaxable.get('STANDARD'))).toBe('10');
  });

  it('rejects an allowance above its category, or for a missing category', () => {
    const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as CommercialRuleError).code; } return undefined; };
    expect(code(() => run([row('L1', '10')], { documentAllowances: new Map([['STANDARD', '10.001']]) }))).toBe('DOCUMENT_DISCOUNT_EXCEEDS_BASE');
    expect(code(() => run([row('L1', '10')], { documentAllowances: new Map([['EXEMPT', '1']]) }))).toBe('DOCUMENT_DISCOUNT_EXCEEDS_BASE');
  });
});

describe('calculateTax — properties', () => {
  const net = fc.integer({ min: 0, max: 10_000_000 }).map((n) => toMoney(n).dividedBy(1000));
  const level = fc.constantFrom('LINE' as const, 'DOCUMENT' as const);
  const mode = fc.constantFrom('TAX_EXCLUSIVE' as const, 'TAX_INCLUSIVE' as const);

  it('I5 per row; DOCUMENT rows add up to the header; amounts within precision', () => {
    fc.assert(fc.property(fc.array(net, { minLength: 1, maxLength: 12 }), level, mode, (nets, lvl, m) => {
      const p = [profile({ roundingLevel: lvl }), profile({ id: 'muni', ratePercent: '2', roundingLevel: lvl })];
      const result = calculateTax({
        rows: nets.map((n, i) => row(`R${i}`, n.toString(), { profiles: p })),
        pricingMode: m, currencyDecimalPlaces: 3,
      });
      for (const [i, n] of nets.entries()) {
        const r = result.rows.get(`R${i}`)!;
        expect(r.taxAmount.decimalPlaces()).toBeLessThanOrEqual(3);
        if (m === 'TAX_EXCLUSIVE') {
          expect(r.lineTotalAmount.equals(n.plus(r.taxAmount))).toBe(true);
        } else {
          expect(r.lineTotalAmount.equals(n)).toBe(true);
          expect(r.taxableAmount.plus(r.taxAmount).equals(n)).toBe(true);
        }
      }
      expect(result.lineTaxTotal.equals(result.documentTaxTotal)).toBe(true);
      expect(sumMoney(result.taxLines.map((l) => l.taxAmount)).equals(result.documentTaxTotal)).toBe(true);
    }));
  });
});
