/**
 * UoM library — conversion resolver, decimals rule, formatting. The resolver cases
 * mirror the database function fn_uom_convert (0813) and its QA checks (QA_TEST_GUIDE §P1).
 */
import { typedQtyText } from '@/lib/uom/scale';
import { billingExamples } from '@/lib/commercial/measure';
import {
  areRatesReciprocal,
  assertQtyScale,
  createUomResolver,
  formatQty,
  isQtyScaleValid,
  reciprocalRate,
  uomSymbol,
} from '@/lib/uom';
import { parseUomErrorCode } from '@/lib/constants/uom';
import type { UomConversionFacts, UomUnitFacts } from '@/lib/types/uom';

const unit = (code: string, dimension: UomUnitFacts['dimension'], isBaseUnit = false, qtyDecimals = 3): UomUnitFacts =>
  ({ code, dimension, isBaseUnit, qtyDecimals, isActive: true });
const conv = (fromCode: string, toCode: string, multiplyRate: string, divideRate: string, productId: string | null = null): UomConversionFacts =>
  ({ productId, fromCode, toCode, multiplyRate, divideRate, isActive: true });

const units = [
  unit('PC', 'COUNT', true, 0), unit('BOX', 'COUNT', false, 0), unit('PAIR', 'COUNT', false, 0),
  unit('KG', 'MASS', true), unit('G', 'MASS', false, 0), unit('LB', 'MASS'),
  unit('M', 'LENGTH', true, 2), unit('CM', 'LENGTH', false, 1), unit('FT', 'LENGTH', false, 2),
  unit('L', 'VOLUME', true),
];
const system = [
  conv('G', 'KG', '0.001', '1000'),
  conv('LB', 'KG', '0.45359237', '2.204622621849'),
  conv('CM', 'M', '0.01', '100'),
  conv('FT', 'M', '0.3048', '3.280839895013'),
];
const uom = createUomResolver(units, system);

describe('createUomResolver.convert', () => {
  it('same unit returns the quantity', () => {
    expect(uom.convert('2.5', 'KG', 'KG').toString()).toBe('2.5');
  });
  it('forward direction uses the multiply rate (QA: 2 lb = 0.90718474 kg)', () => {
    expect(uom.convert('2', 'LB', 'KG').toString()).toBe('0.90718474');
  });
  it('reverse direction uses the stored divide rate', () => {
    expect(uom.convert('1', 'KG', 'LB').toString()).toBe('2.204622621849');
  });
  it('two legs through the base unit (QA: 100 cm = 3.28084 ft)', () => {
    expect(uom.convert('100', 'CM', 'FT').toDecimalPlaces(6).toString()).toBe('3.28084');
  });
  it('throws UOM_CONVERSION_MISSING with no path', () => {
    expect(() => uom.convert('1', 'KG', 'L')).toThrow(/UOM_CONVERSION_MISSING/);
    expect(() => uom.convert('30', 'PC', 'BOX')).toThrow(/UOM_CONVERSION_MISSING/);
  });
  it('a product pair wins over the Organization-wide pair', () => {
    const r = createUomResolver(units, [...system, conv('BOX', 'PC', '12', '0.083333333333', 'prod-1'), conv('BOX', 'PC', '10', '0.1')]);
    expect(r.convert('2', 'BOX', 'PC', { productId: 'prod-1' }).toString()).toBe('24');
    expect(r.convert('2', 'BOX', 'PC').toString()).toBe('20');
  });
  it('a product pair is not used for another product', () => {
    const r = createUomResolver(units, [conv('BOX', 'PC', '12', '0.083333333333', 'prod-1')]);
    expect(() => r.convert('2', 'BOX', 'PC', { productId: 'prod-2' })).toThrow(/UOM_CONVERSION_MISSING/);
  });
  it('a count target must be whole (QA: UOM_QTY_NOT_WHOLE)', () => {
    const r = createUomResolver(units, [conv('BOX', 'PC', '12', '0.083333333333', 'p')]);
    expect(() => r.convert('30', 'PC', 'BOX', { productId: 'p' })).toThrow(/UOM_QTY_NOT_WHOLE/);
    expect(r.convert('30', 'PC', 'BOX', { productId: 'p', requireWhole: false }).toDecimalPlaces(6).toString()).toBe('2.5');
    expect(r.convert('24', 'PC', 'BOX', { productId: 'p' }).toDecimalPlaces(6).toString()).toBe('2');
  });
  it('ignores inactive conversions', () => {
    const r = createUomResolver(units, [{ ...conv('LB', 'KG', '0.45359237', '2.204622621849'), isActive: false }]);
    expect(() => r.convert('1', 'LB', 'KG')).toThrow(/UOM_CONVERSION_MISSING/);
  });
  it('exposes bases and units', () => {
    expect(uom.baseOf('MASS')).toBe('KG');
    expect(uom.unit('G')?.qtyDecimals).toBe(0);
  });
});

describe('rates', () => {
  it('reciprocalRate matches the seeded divide rate at RATE precision', () => {
    expect(reciprocalRate('0.45359237').toString()).toBe('2.204622621849');
  });
  it('areRatesReciprocal accepts the owner’s screenshot pair and rejects a mismatch', () => {
    expect(areRatesReciprocal('0.453592909436', '2.20462')).toBe(true);
    expect(areRatesReciprocal('0.45', '2.5')).toBe(false);
    expect(areRatesReciprocal('0', '1')).toBe(false);
  });
});

describe('decimals rule (D11)', () => {
  it.each([
    ['1.5', 0, false], ['2', 0, true], ['2.375', 3, true], ['2.3755', 3, false], ['1.50', 2, true],
  ] as const)('%s with %i decimals → %s', (qty, decimals, ok) => {
    expect(isQtyScaleValid(qty, decimals)).toBe(ok);
  });
  it('assertQtyScale throws UOM_QTY_SCALE', () => {
    expect(() => assertQtyScale('1.5', { code: 'PC', qtyDecimals: 0 })).toThrow(/UOM_QTY_SCALE/);
    expect(() => assertQtyScale('1.5', { code: 'M', qtyDecimals: 2 })).not.toThrow();
  });
});

describe('formatQty', () => {
  const kg = { symbol: 'kg', symbol2: 'كغ', qtyDecimals: 3 };
  it('drops trailing zeros and adds the symbol', () => {
    expect(formatQty('2.400000', kg)).toBe('2.4 kg');
    expect(formatQty('3', kg)).toBe('3 kg');
  });
  it('can keep the unit decimals', () => {
    expect(formatQty('2.4', kg, { fixedDecimals: true })).toBe('2.400 kg');
  });
  it('uses the Arabic symbol in Arabic', () => {
    expect(uomSymbol(kg, 'ar')).toBe('كغ');
    expect(formatQty('2.4', kg, { locale: 'ar' })).toContain('كغ');
  });
  it('falls back to the English symbol when there is no Arabic one', () => {
    expect(uomSymbol({ symbol: 'x', symbol2: null }, 'ar')).toBe('x');
  });
  it('rounds to the unit decimals', () => {
    expect(formatQty('2.3456', { symbol: 'kg', symbol2: null, qtyDecimals: 2 })).toBe('2.35 kg');
  });
});

describe('parseUomErrorCode', () => {
  it('reads the code a database rule puts first', () => {
    expect(parseUomErrorCode('UOM_IN_USE: unit KG is used by 3 product(s)')).toBe('UOM_IN_USE');
    expect(parseUomErrorCode('error: MEASURE_REQUIRED: retail product x')).toBe('MEASURE_REQUIRED');
  });
  it('returns null for anything else', () => {
    expect(parseUomErrorCode('duplicate key value')).toBeNull();
    expect(parseUomErrorCode('UOM_SOMETHING_NEW: x')).toBeNull();
    expect(parseUomErrorCode(null)).toBeNull();
  });
});

describe('typedQtyText', () => {
  it('keeps only what the unit allows', () => {
    expect(typedQtyText('2,3755 kg', 3)).toBe('2.375');
    expect(typedQtyText('1.5', 0)).toBe('1');
    expect(typedQtyText('1..25', 2)).toBe('1.25');
    expect(typedQtyText('-4', 2)).toBe('4');
    expect(typedQtyText('', 2)).toBe('');
  });
});

describe('billingExamples', () => {
  it('shows the minimum and the step the way the line will be billed', () => {
    expect(billingExamples({ qtyDecimals: 3, minBillableQty: '3', billingIncrement: '0.5' }))
      .toEqual([{ measuredQty: '2.4', billedQty: '3' }, { measuredQty: '3.2', billedQty: '3.5' }]);
    expect(billingExamples({ qtyDecimals: 2, billingIncrement: '0.25' })).toEqual([{ measuredQty: '1.6', billedQty: '1.75' }]);
  });
  it('shows nothing when no rule changes the bill or a value is not usable yet', () => {
    expect(billingExamples({ qtyDecimals: 3 })).toEqual([]);
    expect(billingExamples({ qtyDecimals: 3, minBillableQty: '0', billingIncrement: '.' })).toEqual([]);
    expect(billingExamples({ qtyDecimals: 0, billingIncrement: '1' })).toEqual([]);
  });
});
