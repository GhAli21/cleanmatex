/** Prepayment tax: tax inside the amount received, netted oldest receipt first, never twice. */
import { ZERO, sumMoney, toMoney } from '@/lib/commercial/money';
import { takeFromPrepaid } from '@/lib/tax/prepaid-pool';
import { decidePurchaseTax, type PurchaseTaxCode, type PurchaseTaxRule } from '@/lib/tax/purchase-tax';

const RULE: PurchaseTaxRule = {
  id: 'r-adv', doc_type_code: null, tax_flow_code: 'OUTPUT', branch_id: null, place_of_supply_country: null,
  tax_item_class_code: 'ADVANCE_DEPOSIT', party_tax_class_code: null, party_country_scope: null, service_category_code: null,
  priority: 100, effective_from: '2020-01-01', effective_to: null, tax_codes: ['VAT_STD'],
};
const CODE: PurchaseTaxCode = {
  id: 'p-std', taxCode: 'VAT_STD', versionNo: 1, effectiveFrom: '2020-01-01', effectiveTo: null, ratePercent: '5.00',
  amountKind: 'PERCENT', calcLevel: 'LINE', categoryCode: 'STANDARD', exemptReasonCode: null, recoverablePct: '0',
};
const m = (v: string) => toMoney(v);

describe('tax inside a prepayment', () => {
  it('105.000 received at 5% holds 5.000 tax on a 100.000 base', () => {
    const r = decidePurchaseTax([RULE], [CODE], {
      flow: 'OUTPUT', docTypeCode: 'RECEIPT_VOUCHER', date: '2026-11-10', branchId: null, placeOfSupplyCountry: 'OM',
      itemClass: 'ADVANCE_DEPOSIT', partyTaxClass: 'CONSUMER', partyCountryScope: 'DOMESTIC',
      net: m('105.000'), inclusive: true, enteredTax: null, decimals: 3,
    });
    expect(r.taxAmount.toFixed(3)).toBe('5.000');
    expect(r.parts[0].taxable.toFixed(3)).toBe('100.000');
    expect(r.parts[0].recoverable.isZero()).toBe(true);
  });
});

describe('takeFromPrepaid', () => {
  const receipts = [{ taxable: m('100.000'), taxes: [m('5.000')] }, { taxable: m('200.000'), taxes: [m('10.000')] }];

  it('spends the oldest receipt first and takes a share of the next', () => {
    const [a, b] = takeFromPrepaid(receipts, m('157.500'), 3);
    expect(a.taxable.toFixed(3)).toBe('100.000');
    expect(a.taxes[0].toFixed(3)).toBe('5.000');
    expect(b.taxes[0].toFixed(3)).toBe('2.500');
    expect(b.taxable.toFixed(3)).toBe('50.000');
  });

  it('never takes more than the receipts hold', () => {
    const taken = takeFromPrepaid(receipts, m('999.000'), 3);
    expect(sumMoney(taken.flatMap((t) => [t.taxable, ...t.taxes])).toFixed(3)).toBe('315.000');
  });

  it('a share always adds up to the amount spent', () => {
    const [a] = takeFromPrepaid([{ taxable: m('100.000'), taxes: [m('5.000')] }], m('33.333'), 3);
    expect(a.taxable.plus(a.taxes[0]).toFixed(3)).toBe('33.333');
  });

  it('nothing spent takes nothing', () => {
    expect(takeFromPrepaid(receipts, ZERO, 3).every((t) => t.taxable.isZero() && t.taxes.every((x) => x.isZero()))).toBe(true);
  });
});
