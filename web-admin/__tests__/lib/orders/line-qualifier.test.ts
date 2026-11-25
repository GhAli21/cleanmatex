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
    expect(q?.measure).toEqual({ qty: '2.500000', billedQty: '2.500000', uomCode: 'M2', symbol: 'm²', symbol2: 'م²', qtyDecimals: 2 });
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

import { formatLineQualifier } from '@/lib/orders/line-qualifier-format';

describe('formatLineQualifier', () => {
  const names = new Map([['EXPRESS', { name: 'Express', name2: 'سريع' }]]);
  it('joins measure, speed and ordinal; nothing to say gives an empty string', () => {
    const q = orderLineQualifiers([
      rug('a', '2.500000', 'EXPRESS'), rug('b', '2.5', 'EXPRESS'), count('c', 'shirt'),
    ], 'STANDARD', names);
    expect(formatLineQualifier(q.get('a'))).toBe('2.5 m² · Express (1)');
    expect(formatLineQualifier(q.get('b'))).toBe('2.5 m² · Express (2)');
    expect(formatLineQualifier(q.get('c'))).toBe('');
    expect(formatLineQualifier(undefined)).toBe('');
  });
  it('uses the Arabic symbol and speed name for Arabic readers, and the code when no name was passed', () => {
    const named = orderLineQualifiers([rug('a', '2.5', 'EXPRESS')], 'STANDARD', names).get('a');
    expect(formatLineQualifier(named, { locale: 'ar' })).toContain('م²');
    expect(formatLineQualifier(named, { locale: 'ar' })).toContain('سريع');
    expect(formatLineQualifier(orderLineQualifiers([count('a', 'tie', 'EXPRESS')], 'STANDARD').get('a'))).toBe('EXPRESS');
  });
});
