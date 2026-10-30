/**
 * P4-06 — money invariants I1–I6 (PLAN.md §5.2): one golden order with every
 * stored figure pinned, one violation per invariant, and a property suite
 * that runs random orders through the whole calculator and checks I1–I6.
 */
import fc from 'fast-check';
import {
  MONEY_INVARIANTS,
  allocateItemToPieces,
  applyDocumentAdjustments,
  assertMoneyInvariants,
  buildRowMoney,
  calculateTax,
  checkMoneyInvariants,
  priceLine,
  rollupPiecesToItem,
  sumMoney,
  toMoney,
  type AdjustmentInput,
  type InvariantItem,
  type InvariantOrder,
  type RowMoney,
  type TaxProfileInput,
} from '@/lib/commercial';
import type { DiscAllocBasis, DiscAllocMode } from '@/lib/constants/commercial';
import type { TaxPricingMode } from '@/lib/constants/order-financial';

type Level = 'ITEM' | 'PIECE';

const OMR = { decimalPlaces: 3, mode: 'HALF_UP' as const };

const vat5 = (roundingLevel: 'LINE' | 'DOCUMENT' = 'DOCUMENT'): TaxProfileInput => ({
  id: 'vat', taxType: 'VAT', ratePercent: '5', isCompound: false, isDefault: true,
  appliesTo: null, roundingLevel, rounding: OMR,
});

/** One line of a test order. */
interface LineSpec {
  id: string;
  quantity: number;
  listUnitPrice: string;
  speedUnitPremium?: string;
  extra?: string;
  lineDiscounts?: AdjustmentInput[];
  pieces: number;
}

interface OrderSpec {
  level: Level;
  pricingMode: TaxPricingMode;
  discAllocMode: DiscAllocMode;
  basis: DiscAllocBasis;
  roundingLevel: 'LINE' | 'DOCUMENT';
  lines: LineSpec[];
  orderDiscounts: AdjustmentInput[];
  /** A delivery charge net, taxed on its own and never discounted. */
  chargeNet: string | null;
}

const priced = (spec: LineSpec, quantity: number, extra: string | undefined) => priceLine({
  quantity,
  listUnitPrice: spec.listUnitPrice,
  priceListDiscountPercent: 0,
  priceListItemId: null,
  speedUnitPremium: spec.speedUnitPremium ?? '0',
  speedLinePremium: 0,
  overrideUnitPrice: null,
  modifiers: extra ? [{ id: `${spec.id}-x`, kind: 'PREFERENCE', amount: extra, placement: 'INCLUDED' }] : [],
  adjustments: spec.lineDiscounts ?? [],
  minUnitPrice: null,
  rounding: OMR,
});

/**
 * Runs an order through the calculator the way the P5 writer will: price,
 * order discounts, tax, then the item/piece split (ITEM) or rollup (PIECE).
 * The header is worked out independently of I3: Σ net before order discounts
 * − the order discount + header tax (exclusive) + the charge.
 */
function calculateOrder(spec: OrderSpec): InvariantOrder {
  const profiles = [vat5(spec.roundingLevel)];
  const pieceLevel = spec.level === 'PIECE';

  // ─── Price the rows that carry the price ───────────────────────────────
  // PIECE: each piece is one unit with the line's extra on its first piece.
  const pricedRows = spec.lines.flatMap((line) => (pieceLevel
    ? Array.from({ length: line.pieces }, (_, k) => ({
      rowId: `${line.id}-p${k + 1}`, lineId: line.id, result: priced(line, 1, k === 0 ? line.extra : undefined),
    }))
    : [{ rowId: line.id, lineId: line.id, result: priced(line, line.quantity, line.extra) }]));

  // ─── Order discounts and tax ───────────────────────────────────────────
  const doc = applyDocumentAdjustments({
    adjustments: spec.orderDiscounts,
    lines: pricedRows.map((r) => ({
      lineId: r.rowId, grossAmount: r.result.grossAmount, netAmount: r.result.netBeforeDocument, taxCategoryCode: 'STANDARD',
    })),
    mode: spec.discAllocMode,
    basis: spec.basis,
    rounding: OMR,
  });
  const tax = calculateTax({
    rows: pricedRows.map((r) => ({
      rowId: r.rowId,
      netAmount: r.result.netBeforeDocument.minus(doc.lineShares.get(r.rowId)!),
      taxCategoryCode: 'STANDARD',
      exemptReason: null,
      profiles,
    })),
    pricingMode: spec.pricingMode,
    documentAllowances: doc.categoryShares,
    currencyDecimalPlaces: OMR.decimalPlaces,
  });
  const chargeTax = spec.chargeNet
    ? calculateTax({
      rows: [{ rowId: 'delivery', netAmount: spec.chargeNet, taxCategoryCode: 'STANDARD', exemptReason: null, profiles }],
      pricingMode: spec.pricingMode,
      currencyDecimalPlaces: OMR.decimalPlaces,
    })
    : null;

  const rowMoney = (r: (typeof pricedRows)[number]): RowMoney => buildRowMoney({
    listUnitPrice: r.result.listUnitPrice,
    unitPrice: r.result.unitPrice,
    speedPremiumAmount: r.result.speedPremiumAmount,
    includedModifierAmount: r.result.includedModifierAmount,
    grossAmount: r.result.grossAmount,
    lineDiscountAmount: r.result.lineDiscountAmount,
    orderDiscountAllocAmount: doc.lineShares.get(r.rowId)!,
    taxAmount: tax.rows.get(r.rowId)!.taxAmount,
  }, spec.pricingMode);

  // ─── Item and piece rows ───────────────────────────────────────────────
  const items: InvariantItem[] = spec.lines.map((line) => {
    const rows = pricedRows.filter((r) => r.lineId === line.id);
    if (pieceLevel) {
      const pieceRows = rows.map(rowMoney);
      return {
        itemId: line.id, moneyBasis: 'ROLLUP', pricingMode: spec.pricingMode,
        money: rollupPiecesToItem(pieceRows, line.quantity, spec.pricingMode, OMR),
        pieces: pieceRows.map((money, k) => ({ pieceId: rows[k].rowId, moneyBasis: 'PRICED', pricingMode: spec.pricingMode, money })),
      };
    }
    const money = rowMoney(rows[0]);
    const pieces = allocateItemToPieces(money, Array.from({ length: line.pieces }, () => 1), spec.pricingMode, OMR.decimalPlaces);
    return {
      itemId: line.id, moneyBasis: 'PRICED', pricingMode: spec.pricingMode, money,
      pieces: pieces.map((p, k) => ({ pieceId: `${line.id}-p${k + 1}`, moneyBasis: 'ALLOCATED', pricingMode: spec.pricingMode, money: p })),
    };
  });

  const inclusive = spec.pricingMode === 'TAX_INCLUSIVE';
  const charges = spec.chargeNet && chargeTax
    ? [{
      chargeId: 'delivery', netAmount: spec.chargeNet, taxAmount: chargeTax.lineTaxTotal,
      lineTotalAmount: chargeTax.rows.get('delivery')!.lineTotalAmount,
    }]
    : [];
  const headerTax = tax.documentTaxTotal.plus(chargeTax?.documentTaxTotal ?? 0);
  const headerTotalAmount = sumMoney(pricedRows.map((r) => r.result.netBeforeDocument))
    .minus(doc.total)
    .plus(inclusive ? 0 : headerTax)
    .plus(spec.chargeNet ?? 0);
  const allowance = sumMoney([...doc.categoryShares.values()]);

  return {
    pricingMode: spec.pricingMode,
    discAllocMode: spec.discAllocMode,
    items,
    charges,
    documentAllowance: { amount: allowance, taxEffect: tax.lineTaxTotal.minus(tax.documentTaxTotal) },
    headerTotalAmount,
  };
}

const str = (m: RowMoney) => ({
  gross: m.grossAmount.toString(), lineDisc: m.lineDiscountAmount.toString(),
  share: m.orderDiscountAllocAmount.toString(), net: m.netAmount.toString(),
  tax: m.taxAmount.toString(), total: m.lineTotalAmount.toString(),
});

// ─── Golden ─────────────────────────────────────────────────────────────

describe('golden order (OMR, VAT 5% DOCUMENT rounding, exclusive, ALLOCATE_TO_LINES)', () => {
  const golden: OrderSpec = {
    level: 'ITEM', pricingMode: 'TAX_EXCLUSIVE', discAllocMode: 'ALLOCATE_TO_LINES', basis: 'PROPORTIONAL_NET',
    roundingLevel: 'DOCUMENT',
    lines: [
      { id: 'shirt', quantity: 3, listUnitPrice: '1', pieces: 3 },
      { id: 'suit', quantity: 1, listUnitPrice: '4.5', speedUnitPremium: '1.5', pieces: 2 },
      { id: 'trousers', quantity: 2, listUnitPrice: '0.5', pieces: 2,
        lineDiscounts: [{ id: 'd10', source: 'MANUAL', calcType: 'PERCENTAGE', value: '10' }] },
    ],
    orderDiscounts: [{ id: 'od', source: 'MANUAL', calcType: 'FIXED_AMOUNT', value: '1' }],
    chargeNet: '0.5',
  };
  const order = calculateOrder(golden);
  const item = (id: string) => order.items.find((i) => i.itemId === id)!;

  it('pins every item figure', () => {
    // Shares of 1.000 by net 3 / 6 / 0.9: 0.303 / 0.606 / 0.090 + the leftover unit to trousers (0.909 remainder).
    // Tax 0.445 on 8.900, split by exact row tax 0.13485 / 0.2697 / 0.04045 → 0.135 / 0.270 / 0.040.
    expect(str(item('shirt').money)).toEqual({ gross: '3', lineDisc: '0', share: '0.303', net: '2.697', tax: '0.135', total: '2.832' });
    expect(str(item('suit').money)).toEqual({ gross: '6', lineDisc: '0', share: '0.606', net: '5.394', tax: '0.27', total: '5.664' });
    expect(item('suit').money.speedPremiumAmount.toString()).toBe('1.5');
    expect(str(item('trousers').money)).toEqual({ gross: '1', lineDisc: '0.1', share: '0.091', net: '0.809', tax: '0.04', total: '0.849' });
  });

  it('pins the pieces and the header', () => {
    expect(item('shirt').pieces.map((p) => str(p.money))).toEqual(Array(3).fill(
      { gross: '1', lineDisc: '0', share: '0.101', net: '0.899', tax: '0.045', total: '0.944' },
    ));
    expect(item('suit').pieces.map((p) => p.money.speedPremiumAmount.toString())).toEqual(['0.75', '0.75']);
    // 2.832 + 5.664 + 0.849 + delivery 0.525
    expect(toMoney(order.headerTotalAmount).toString()).toBe('9.87');
  });

  it('holds I1–I6', () => {
    expect(checkMoneyInvariants(order)).toEqual([]);
    expect(() => assertMoneyInvariants(order)).not.toThrow();
  });
});

// ─── One violation per invariant ────────────────────────────────────────

describe('checkMoneyInvariants catches each break', () => {
  const base = (): InvariantOrder => calculateOrder({
    level: 'ITEM', pricingMode: 'TAX_EXCLUSIVE', discAllocMode: 'ALLOCATE_TO_LINES', basis: 'PROPORTIONAL_NET',
    roundingLevel: 'LINE',
    lines: [{ id: 'a', quantity: 3, listUnitPrice: '1', pieces: 3 }, { id: 'b', quantity: 1, listUnitPrice: '2', pieces: 1 }],
    orderDiscounts: [{ id: 'od', source: 'MANUAL', calcType: 'FIXED_AMOUNT', value: '0.1' }],
    chargeNet: null,
  });
  const codes = (order: InvariantOrder) => checkMoneyInvariants(order).map((v) => v.invariant);
  const bump = (m: RowMoney, key: keyof RowMoney): RowMoney => ({ ...m, [key]: m[key].plus('0.001') });

  it('I1: a piece one unit off its item', () => {
    const order = base();
    const [a] = order.items;
    const pieces = a.pieces.map((p, k) => (k === 0 ? { ...p, money: buildRowMoney({ ...p.money, grossAmount: p.money.grossAmount.plus('0.001') }, 'TAX_EXCLUSIVE') } : p));
    expect(codes({ ...order, items: [{ ...a, pieces }, order.items[1]] })).toContain(MONEY_INVARIANTS.I1);
  });

  it('I1/I2: wrong basis pairs', () => {
    const order = base();
    const [a] = order.items;
    expect(codes({ ...order, items: [{ ...a, moneyBasis: 'ALLOCATED' }] })).toContain(MONEY_INVARIANTS.I1);
    expect(codes({ ...order, items: [{ ...a, moneyBasis: 'ROLLUP' }] })).toContain(MONEY_INVARIANTS.I2);
    expect(codes({ ...order, items: [{ ...a, moneyBasis: 'ROLLUP', pieces: [] }] })).toContain(MONEY_INVARIANTS.I2);
  });

  it('I3: a header one unit off the rows', () => {
    const order = base();
    expect(codes({ ...order, headerTotalAmount: toMoney(order.headerTotalAmount).plus('0.001') })).toEqual([MONEY_INVARIANTS.I3]);
  });

  it('I4: a discount with two homes, and a row id used twice', () => {
    const order = base();
    expect(codes({ ...order, discAllocMode: 'DOCUMENT_LEVEL' })).toContain(MONEY_INVARIANTS.I4);
    expect(codes({ ...order, documentAllowance: { amount: '0.1', taxEffect: 0 } })).toContain(MONEY_INVARIANTS.I4);
    expect(codes({ ...order, charges: [{ chargeId: 'a', netAmount: 0, taxAmount: 0, lineTotalAmount: 0 }] })).toEqual([MONEY_INVARIANTS.I4]);
  });

  it('I5: a row whose net or total does not follow from its amounts', () => {
    const order = base();
    const [a, b] = order.items;
    expect(codes({ ...order, items: [a, { ...b, money: bump(b.money, 'netAmount') }] })).toContain(MONEY_INVARIANTS.I5);
    expect(codes({ ...order, charges: [{ chargeId: 'c', netAmount: '1', taxAmount: '0.05', lineTotalAmount: '1' }] }))
      .toEqual([MONEY_INVARIANTS.I5, MONEY_INVARIANTS.I3]);
  });

  it('I6: a line in another pricing mode', () => {
    const order = base();
    const [a, b] = order.items;
    expect(codes({ ...order, items: [a, { ...b, pricingMode: 'TAX_INCLUSIVE' }] })).toEqual([MONEY_INVARIANTS.I6]);
  });

  it('assert throws COMMERCIAL_INVARIANT_FAILED with the first violation and the count', () => {
    const order = base();
    try {
      assertMoneyInvariants({ ...order, headerTotalAmount: 0 });
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toMatchObject({ code: 'COMMERCIAL_INVARIANT_FAILED', details: { invariant: 'I3', rowId: 'ORDER', violationCount: '1' } });
    }
  });
});

// ─── Property: random orders through the whole calculator ───────────────

describe('property: every calculated order holds I1–I6', () => {
  const amount = (maxMinor: number) => fc.integer({ min: 0, max: maxMinor }).map((n) => toMoney(n).dividedBy(1000).toString());
  const lineArb = (id: string) => fc.record({
    quantity: fc.integer({ min: 1, max: 5 }),
    listUnitPrice: amount(20_000),
    speedUnitPremium: amount(3_000),
    extra: fc.option(amount(2_000), { nil: undefined }),
    lineDiscountPercent: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
    piecesDiffer: fc.boolean(),
    extraPieces: fc.integer({ min: 0, max: 2 }),
  }).map((r): LineSpec => ({
    id,
    quantity: r.quantity,
    listUnitPrice: r.listUnitPrice,
    speedUnitPremium: r.speedUnitPremium,
    extra: r.extra,
    lineDiscounts: r.lineDiscountPercent
      ? [{ id: `${id}-d`, source: 'MANUAL', calcType: 'PERCENTAGE', value: String(r.lineDiscountPercent) }]
      : [],
    // ITEM level allows a piece count other than the quantity (a suit set); PIECE needs one piece per unit.
    pieces: r.piecesDiffer ? r.quantity + r.extraPieces : r.quantity,
  }));

  const orderArb = fc.record({
    level: fc.constantFrom<Level>('ITEM', 'PIECE'),
    pricingMode: fc.constantFrom<TaxPricingMode>('TAX_EXCLUSIVE', 'TAX_INCLUSIVE'),
    discAllocMode: fc.constantFrom<DiscAllocMode>('ALLOCATE_TO_LINES', 'DOCUMENT_LEVEL'),
    basis: fc.constantFrom<DiscAllocBasis>('PROPORTIONAL_NET', 'PROPORTIONAL_GROSS'),
    roundingLevel: fc.constantFrom<'LINE' | 'DOCUMENT'>('LINE', 'DOCUMENT'),
    lines: fc.integer({ min: 1, max: 4 }).chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => lineArb(`L${i + 1}`)))),
    orderPercent: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
    chargeNet: fc.option(amount(5_000), { nil: null }),
  }).map((r): OrderSpec => ({
    level: r.level,
    pricingMode: r.pricingMode,
    discAllocMode: r.discAllocMode,
    basis: r.basis,
    roundingLevel: r.roundingLevel,
    lines: r.level === 'PIECE' ? r.lines.map((l) => ({ ...l, pieces: l.quantity })) : r.lines,
    // A percentage never exceeds the base, so no input is rejected by the base check.
    orderDiscounts: r.orderPercent ? [{ id: 'od', source: 'MANUAL', calcType: 'PERCENTAGE', value: String(r.orderPercent) }] : [],
    chargeNet: r.chargeNet,
  }));

  it('I1–I6 hold, or the calculator rejects the input with a business-rule code', () => {
    fc.assert(fc.property(orderArb, (spec) => {
      let order: InvariantOrder;
      try {
        order = calculateOrder(spec);
      } catch (error) {
        // Gross-basis shares can exceed a heavily discounted line: rejected, never written.
        expect((error as { code?: string }).code).toBe('DOCUMENT_DISCOUNT_EXCEEDS_LINE');
        return;
      }
      expect(checkMoneyInvariants(order)).toEqual([]);
    }), { numRuns: 400 });
  });
});
