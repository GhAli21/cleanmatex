import { orderLineQualifiers, type OrderLineQualifierInput } from '@/lib/orders/line-qualifier';

const count = (id: string, productId: string, speedCode = 'STANDARD'): OrderLineQualifierInput => (
  { id, productId, uomCode: 'PC', uomDimension: 'COUNT', uomSymbol: 'pc', speedCode }
);
const rug = (id: string, qty: string, speedCode = 'STANDARD', productId = 'rug'): OrderLineQualifierInput => (
  { id, productId, uomCode: 'M2', uomDimension: 'AREA', uomSymbol: 'm²', uomSymbol2: 'م²', uomQtyDecimals: 2, measuredQty: qty, billedQty: qty, speedCode }
);

describe('orderLineQualifiers', () => {
  it('a plain count line has nothing to say', () => {
    expect(orderLineQualifiers([count('a', 'shirt')], 'STANDARD').get('a')).toEqual({});
  });

  it('a measured line always shows its measure with the unit facts', () => {
    const q = orderLineQualifiers([rug('a', '2.500000')], 'STANDARD').get('a');
    expect(q?.measure).toEqual({
      qty: '2.500000', billedQty: '2.500000', uomCode: 'M2', symbol: 'm²', symbol2: 'م²', qtyDecimals: 2,
      minBillableQty: null, billingIncrement: null, unitPrice: null,
    });
    expect(q?.ordinal).toBeUndefined();
  });

  it('a count unit carries no measure even if a quantity is stored', () => {
    expect(orderLineQualifiers([{ ...count('a', 'shirt'), measuredQty: '3' }], 'STANDARD').get('a')?.measure).toBeUndefined();
  });

  it('shows the speed only when it differs from the order speed', () => {
    const q = orderLineQualifiers([count('a', 'shirt', 'EXPRESS'), count('b', 'tie', 'STANDARD')], 'STANDARD');
    expect(q.get('a')).toEqual({ speedCode: 'EXPRESS' });
    expect(q.get('b')).toEqual({});
  });

  it('numbers lines of one product only when everything else about them is identical', () => {
    const q = orderLineQualifiers([count('a', 'shirt', 'EXPRESS'), count('b', 'shirt', 'STANDARD')], 'STANDARD');
    expect(q.get('a')).toEqual({ speedCode: 'EXPRESS' });
    expect(q.get('b')).toEqual({});
    const same = orderLineQualifiers([count('a', 'shirt'), count('b', 'shirt'), count('c', 'shirt')], 'STANDARD');
    expect([same.get('a')?.ordinal, same.get('b')?.ordinal, same.get('c')?.ordinal]).toEqual([1, 2, 3]);
  });

  it('two identical rugs are numbered; a rug with another measure is not', () => {
    const q = orderLineQualifiers([rug('a', '2.5'), rug('b', '2.500000'), rug('c', '3')], 'STANDARD');
    expect([q.get('a')?.ordinal, q.get('b')?.ordinal, q.get('c')?.ordinal]).toEqual([1, 2, undefined]);
  });

  it('different products never share an ordinal, and a product-less line is never numbered', () => {
    const q = orderLineQualifiers([count('a', 'shirt'), count('b', 'tie'), { ...count('c', 'x'), productId: null }, { ...count('d', 'x'), productId: null }], 'STANDARD');
    expect([q.get('a')?.ordinal, q.get('b')?.ordinal, q.get('c')?.ordinal, q.get('d')?.ordinal]).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('a missing order speed shows every line speed', () => {
    expect(orderLineQualifiers([count('a', 'shirt', 'STANDARD')], null).get('a')).toEqual({ speedCode: 'STANDARD' });
  });
});

import { billedReason, formatLineQualifier, type LineQualifierTextOptions } from '@/lib/orders/line-qualifier-format';

const en = jest.requireActual('@/messages/en/uom.json') as { line: Record<string, string> };

const t: LineQualifierTextOptions['t'] = (key, values) =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, v), en.line[key.slice('line.'.length)]);
const enText: LineQualifierTextOptions = { t };

describe('formatLineQualifier', () => {
  const names = new Map([['EXPRESS', { name: 'Express', name2: 'سريع' }]]);
  it('joins measure, speed and ordinal; nothing to say gives an empty string', () => {
    const q = orderLineQualifiers([
      rug('a', '2.500000', 'EXPRESS'), rug('b', '2.5', 'EXPRESS'), count('c', 'shirt'),
    ], 'STANDARD', names);
    expect(formatLineQualifier(q.get('a'), enText)).toBe('2.5 m² · Express (1)');
    expect(formatLineQualifier(q.get('b'), enText)).toBe('2.5 m² · Express (2)');
    expect(formatLineQualifier(q.get('c'), enText)).toBe('');
    expect(formatLineQualifier(undefined, enText)).toBe('');
  });
  it('uses the Arabic symbol and speed name for Arabic readers, and the code when no name was passed', () => {
    const named = orderLineQualifiers([rug('a', '2.5', 'EXPRESS')], 'STANDARD', names).get('a');
    expect(formatLineQualifier(named, { t, locale: 'ar' })).toContain('م²');
    expect(formatLineQualifier(named, { t, locale: 'ar' })).toContain('سريع');
    expect(formatLineQualifier(orderLineQualifiers([count('a', 'tie', 'EXPRESS')], 'STANDARD').get('a'), enText)).toBe('EXPRESS');
  });

  const wash = (measuredQty: string, billedQty: string, extra: Partial<OrderLineQualifierInput> = {}) =>
    orderLineQualifiers([{
      id: 'w', productId: 'wash', uomCode: 'KG', uomDimension: 'MASS', uomSymbol: 'kg', uomQtyDecimals: 3,
      measuredQty, billedQty, ...extra,
    }], null).get('w')!;

  it('says what is billed and why when it differs from the measure', () => {
    expect(formatLineQualifier(wash('1.8', '3.000000', { minBillableQty: '3' }), enText)).toBe('1.8 kg · billed 3 kg (minimum)');
    expect(formatLineQualifier(wash('3.2', '3.5', { minBillableQty: '3', billingIncrement: '0.5' }), enText))
      .toBe('3.2 kg · billed 3.5 kg (per 0.5 kg)');
    expect(formatLineQualifier(wash('2', '2.5'), enText)).toBe('2 kg · billed 2.5 kg');
    expect(formatLineQualifier(wash('4.5', '4.500000', { minBillableQty: '3' }), enText)).toBe('4.5 kg');
  });

  it('a minimum raised to the next step is still the minimum', () => {
    expect(billedReason(wash('1', '3.5', { minBillableQty: '3.2', billingIncrement: '0.5' }).measure!)).toBe('MINIMUM');
  });

  it('adds the unit price only where the caller asks for it', () => {
    const q = wash('1.8', '3', { minBillableQty: '3', unitPrice: '1.200000' });
    expect(formatLineQualifier(q, { t, formatUnitPrice: (p) => `${Number(p).toFixed(3)} OMR` }))
      .toBe('1.8 kg · billed 3 kg (minimum) × 1.200 OMR');
    expect(formatLineQualifier(q, enText)).not.toContain('×');
  });
});
