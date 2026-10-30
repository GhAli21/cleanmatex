/**
 * P4-05 — item/piece levels (money_basis, PIECE fallback) and ready-by
 * (PLAN.md §5.1, §5.2 I1/I2/I5, §5.4).
 */
import fc from 'fast-check';
import {
  allocateItemToPieces,
  buildRowMoney,
  resolveMoneyBasis,
  resolveReadyBy,
  resolveTurnaround,
  rollupPiecesToItem,
  sumMoney,
  toMoney,
  type ReadyByLineInput,
  type RowMoney,
} from '@/lib/commercial';

const OMR = { decimalPlaces: 3, mode: 'HALF_UP' as const };

const item = (over: Partial<Record<string, string>> = {}, mode: 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE' = 'TAX_EXCLUSIVE'): RowMoney =>
  buildRowMoney({
    listUnitPrice: toMoney(over.listUnitPrice ?? '3'),
    unitPrice: toMoney(over.unitPrice ?? '3.333'),
    speedPremiumAmount: toMoney(over.speedPremiumAmount ?? '0.999'),
    includedModifierAmount: toMoney(over.includedModifierAmount ?? '0'),
    grossAmount: toMoney(over.grossAmount ?? '10'),
    lineDiscountAmount: toMoney(over.lineDiscountAmount ?? '1'),
    orderDiscountAllocAmount: toMoney(over.orderDiscountAllocAmount ?? '0.5'),
    taxAmount: toMoney(over.taxAmount ?? '0.425'),
  }, mode);

const MONEY_KEYS = ['speedPremiumAmount', 'includedModifierAmount', 'grossAmount', 'lineDiscountAmount',
  'orderDiscountAllocAmount', 'netAmount', 'taxableAmount', 'taxAmount', 'lineTotalAmount'] as const;

describe('resolveMoneyBasis', () => {
  const line = (priceType: string | null, quantity: number, pieceCount: number) => ({ priceType, quantity, pieceCount });

  it('ITEM level: item PRICED, pieces ALLOCATED', () => {
    expect(resolveMoneyBasis('ITEM', line('PER_PC', 3, 3))).toEqual({ itemBasis: 'PRICED', pieceBasis: 'ALLOCATED', fallbackReason: null });
  });

  it('PIECE level: pieces PRICED, item ROLLUP', () => {
    expect(resolveMoneyBasis('PIECE', line('PER_PC', 3, 3))).toEqual({ itemBasis: 'ROLLUP', pieceBasis: 'PRICED', fallbackReason: null });
    expect(resolveMoneyBasis('PIECE', line(null, 2, 2)).itemBasis).toBe('ROLLUP');
  });

  it('PIECE fallback: FIXED, count mismatch or no pieces stay priced on the item', () => {
    expect(resolveMoneyBasis('PIECE', line('FIXED', 1, 2))).toMatchObject({ itemBasis: 'PRICED', fallbackReason: 'FIXED_PRICE_TYPE' });
    expect(resolveMoneyBasis('PIECE', line('PER_PC', 2, 3))).toMatchObject({ itemBasis: 'PRICED', fallbackReason: 'PIECE_COUNT_MISMATCH' });
    expect(resolveMoneyBasis('PIECE', line('PER_PC', 1, 0))).toMatchObject({ itemBasis: 'PRICED', fallbackReason: 'NO_PIECES' });
  });
});

describe('buildRowMoney (I5)', () => {
  it('exclusive: net = gross − discounts, total = net + tax', () => {
    const row = item();
    expect(row.netAmount.toString()).toBe('8.5');
    expect(row.taxableAmount.toString()).toBe('8.5');
    expect(row.lineTotalAmount.toString()).toBe('8.925');
  });

  it('inclusive: taxable = net − tax, total = net', () => {
    const row = item({}, 'TAX_INCLUSIVE');
    expect(row.taxableAmount.toString()).toBe('8.075');
    expect(row.lineTotalAmount.toString()).toBe('8.5');
  });
});

describe('allocateItemToPieces (I1)', () => {
  it('FD-02: 10 over 3 pieces is exact (was 9.9999)', () => {
    const pieces = allocateItemToPieces(item(), [1, 1, 1], 'TAX_EXCLUSIVE', 3);
    expect(pieces.map((p) => p.grossAmount.toString())).toEqual(['3.334', '3.333', '3.333']);
    for (const key of MONEY_KEYS) {
      expect(sumMoney(pieces.map((p) => p[key])).equals(item()[key])).toBe(true);
    }
    pieces.forEach((p) => {
      expect(p.unitPrice.toString()).toBe('3.333');
      expect(p.netAmount.equals(p.grossAmount.minus(p.lineDiscountAmount).minus(p.orderDiscountAllocAmount))).toBe(true);
    });
  });

  it('weights move the shares (a piece with its own extra)', () => {
    const pieces = allocateItemToPieces(item({ grossAmount: '9', lineDiscountAmount: '0', orderDiscountAllocAmount: '0', taxAmount: '0' }), [2, 1], 'TAX_EXCLUSIVE', 3);
    expect(pieces.map((p) => p.grossAmount.toString())).toEqual(['6', '3']);
  });

  it('no pieces gives no rows', () => {
    expect(allocateItemToPieces(item(), [], 'TAX_EXCLUSIVE', 3)).toEqual([]);
  });

  it('property: chained splits never leave a piece below zero, even with tiny amounts and uneven weights', () => {
    const units = (max: number) => fc.integer({ min: 0, max });
    fc.assert(fc.property(
      units(5000), fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 8 }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }),
      fc.constantFrom('TAX_EXCLUSIVE' as const, 'TAX_INCLUSIVE' as const),
      (grossUnits, weights, lineFrac, orderFrac, mode) => {
        const gross = toMoney(grossUnits).dividedBy(1000);
        const lineDisc = toMoney(Math.floor(grossUnits * lineFrac)).dividedBy(1000);
        const orderDisc = toMoney(Math.floor((grossUnits - Math.floor(grossUnits * lineFrac)) * orderFrac)).dividedBy(1000);
        const net = gross.minus(lineDisc).minus(orderDisc);
        const row = buildRowMoney({
          listUnitPrice: toMoney(1), unitPrice: toMoney(1), speedPremiumAmount: toMoney(0), includedModifierAmount: toMoney(0),
          grossAmount: gross, lineDiscountAmount: lineDisc, orderDiscountAllocAmount: orderDisc,
          taxAmount: net.times(mode === 'TAX_INCLUSIVE' ? '0.0476' : '0.05').toDecimalPlaces(3, 1),
        }, mode);
        const pieces = allocateItemToPieces(row, weights, mode, 3);
        pieces.forEach((p) => {
          expect(p.lineDiscountAmount.lessThanOrEqualTo(p.grossAmount)).toBe(true);
          expect(p.netAmount.isNegative()).toBe(false);
          expect(p.taxableAmount.isNegative()).toBe(false);
        });
        for (const key of MONEY_KEYS) expect(sumMoney(pieces.map((p) => p[key])).equals(row[key])).toBe(true);
      }), { numRuns: 300 });
  });

  it('property (I1 + I5): every amount sums to the item; every piece keeps its identities', () => {
    const amount = (max: number) => fc.integer({ min: 0, max }).map((n) => toMoney(n).dividedBy(1000));
    fc.assert(fc.property(amount(1_000_000), fc.integer({ min: 1, max: 12 }), fc.constantFrom('TAX_EXCLUSIVE' as const, 'TAX_INCLUSIVE' as const),
      (gross, count, mode) => {
        const row = buildRowMoney({
          listUnitPrice: toMoney(1), unitPrice: toMoney(1), speedPremiumAmount: toMoney(0), includedModifierAmount: toMoney(0),
          grossAmount: gross, lineDiscountAmount: toMoney(0), orderDiscountAllocAmount: toMoney(0),
          taxAmount: mode === 'TAX_INCLUSIVE' ? toMoney(0) : gross.times('0.05').toDecimalPlaces(3),
        }, mode);
        const pieces = allocateItemToPieces(row, Array(count).fill(1), mode, 3);
        for (const key of MONEY_KEYS) expect(sumMoney(pieces.map((p) => p[key])).equals(row[key])).toBe(true);
      }));
  });
});

describe('rollupPiecesToItem (I2)', () => {
  it('sums every amount and keeps a shared unit price', () => {
    const pieces = allocateItemToPieces(item(), [1, 1, 1], 'TAX_EXCLUSIVE', 3);
    const rolled = rollupPiecesToItem(pieces, 3, 'TAX_EXCLUSIVE', OMR);
    for (const key of MONEY_KEYS) expect(rolled[key].equals(item()[key])).toBe(true);
    expect(rolled.unitPrice.toString()).toBe('3.333');
  });

  it('shows the average unit price when pieces differ', () => {
    const a = item({ unitPrice: '3', listUnitPrice: '3' });
    const b = item({ unitPrice: '4', listUnitPrice: '4' });
    expect(rollupPiecesToItem([a, b], 2, 'TAX_EXCLUSIVE', OMR).unitPrice.toString()).toBe('3.5');
  });

  it('refuses an item with no pieces', () => {
    expect(() => rollupPiecesToItem([], 1, 'TAX_EXCLUSIVE', OMR)).toThrow();
  });
});

describe('ready-by', () => {
  const start = new Date('2026-10-24T08:00:00.000Z');
  const line = (over: Partial<ReadyByLineInput> = {}): ReadyByLineInput => ({
    lineId: 'L1', serviceSpeed: 'STANDARD', speedRuleHours: null, productHours: null, categoryHours: null, extraMinutes: 0, ...over,
  });

  it('standard: product → category → default 24', () => {
    expect(resolveTurnaround(line({ productHours: '36', categoryHours: '48' }))).toEqual({ hours: 36, source: 'PRODUCT' });
    expect(resolveTurnaround(line({ categoryHours: '48' }))).toEqual({ hours: 48, source: 'CATEGORY' });
    expect(resolveTurnaround(line())).toEqual({ hours: 24, source: 'DEFAULT' });
  });

  it('PF-13: express uses the rule, then the category express hours, with no second halving', () => {
    const express = { serviceSpeed: 'EXPRESS' };
    expect(resolveTurnaround(line({ ...express, speedRuleHours: '6', productHours: '36', categoryHours: '24' }))).toEqual({ hours: 6, source: 'SPEED_RULE' });
    expect(resolveTurnaround(line({ ...express, productHours: '36', categoryHours: '24' }))).toEqual({ hours: 24, source: 'CATEGORY' });
    expect(resolveTurnaround(line(express))).toEqual({ hours: 12, source: 'DEFAULT' });
  });

  it('0 is a real value (retail items are ready at once); null falls through', () => {
    expect(resolveTurnaround(line({ productHours: '0', categoryHours: '48' }))).toEqual({ hours: 0, source: 'PRODUCT' });
  });

  it('per-line minutes plus order minutes; the order is ready with its slowest line', () => {
    const result = resolveReadyBy({
      startAt: start,
      lines: [line({ productHours: '24', extraMinutes: 30 }), line({ lineId: 'L2', productHours: '48' })],
      orderExtraMinutes: 15,
      orderOverride: null,
    });
    expect(result.lines.map((l) => l.readyByAt.toISOString())).toEqual(['2026-10-25T08:45:00.000Z', '2026-10-26T08:15:00.000Z']);
    expect(result.orderReadyBy.toISOString()).toBe('2026-10-26T08:15:00.000Z');
    expect(result.isOverride).toBe(false);
  });

  it('a cashier time wins for the order; lines keep their own', () => {
    const override = new Date('2026-10-30T10:00:00.000Z');
    const result = resolveReadyBy({ startAt: start, lines: [line({ productHours: '24' })], orderExtraMinutes: 0, orderOverride: override });
    expect(result.orderReadyBy).toBe(override);
    expect(result.lines[0].readyByAt.toISOString()).toBe('2026-10-25T08:00:00.000Z');
  });

  it('fractional hours and an order with no lines', () => {
    expect(resolveReadyBy({ startAt: start, lines: [line({ productHours: '1.5' })], orderExtraMinutes: 0, orderOverride: null })
      .orderReadyBy.toISOString()).toBe('2026-10-24T09:30:00.000Z');
    expect(resolveReadyBy({ startAt: start, lines: [], orderExtraMinutes: 0, orderOverride: null })
      .orderReadyBy.toISOString()).toBe('2026-10-25T08:00:00.000Z');
  });

  it('rejects negative hours or minutes', () => {
    expect(() => resolveTurnaround(line({ productHours: '-1' }))).toThrow();
    expect(() => resolveReadyBy({ startAt: start, lines: [line({ extraMinutes: -5 })], orderExtraMinutes: 0, orderOverride: null })).toThrow();
  });
});
