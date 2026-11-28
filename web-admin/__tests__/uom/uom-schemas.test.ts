/** Zod schemas for the UoM routes — they must refuse what the database would refuse. */
import {
  conversionSchema,
  convertPreviewSchema,
  createUnitSchema,
  lineMeasureSchema,
  productMeasureSettingsSchema,
  updateUnitSchema,
} from '@/lib/validations/uom-schemas';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success;

describe('createUnitSchema', () => {
  const custom = { kind: 'custom', code: 'BASKET', dimension: 'COUNT', name: 'Basket', symbol: 'bsk', qtyDecimals: 0 };
  it('requires the base size of a custom measured unit, within what can be converted back', () => {
    const weight = { ...custom, dimension: 'MASS', qtyDecimals: 2 };
    expect(ok(createUnitSchema, weight)).toBe(false);
    expect(ok(createUnitSchema, { ...weight, baseMultiplyRate: '5' })).toBe(true);
    expect(ok(createUnitSchema, { ...weight, baseMultiplyRate: '0' })).toBe(false);
    // 1 / 3000000000 keeps only 12 decimals: the pair would break the reciprocal CHECK.
    expect(ok(createUnitSchema, { ...weight, baseMultiplyRate: '3000000000' })).toBe(false);
  });

  it('accepts a custom count unit and a system add', () => {
    expect(ok(createUnitSchema, custom)).toBe(true);
    expect(ok(createUnitSchema, { kind: 'system', codes: ['GAL', 'YD'] })).toBe(true);
  });
  it('refuses bad codes, count units with decimals, and empty system lists', () => {
    expect(ok(createUnitSchema, { ...custom, code: 'basket' })).toBe(false);
    expect(ok(createUnitSchema, { ...custom, code: '1BASKET' })).toBe(false);
    expect(ok(createUnitSchema, { ...custom, qtyDecimals: 2 })).toBe(false);
    expect(ok(createUnitSchema, { kind: 'system', codes: [] })).toBe(false);
  });
  it('accepts a measured custom unit with decimals and a UN/ECE code', () => {
    const jug = { ...custom, code: 'JUG_5L', dimension: 'VOLUME', qtyDecimals: 3, baseMultiplyRate: '5' };
    expect(ok(createUnitSchema, { ...jug, uneceCode: 'LTR' })).toBe(true);
    expect(ok(createUnitSchema, { ...jug, uneceCode: 'l' })).toBe(false);
  });
});

describe('updateUnitSchema', () => {
  it('needs at least one change and refuses locked fields silently by omission', () => {
    expect(ok(updateUnitSchema, {})).toBe(false);
    expect(ok(updateUnitSchema, { name: 'Kilo' })).toBe(true);
    expect(ok(updateUnitSchema, { isActive: false })).toBe(true);
    expect(ok(updateUnitSchema, { qtyDecimals: 7 })).toBe(false);
  });
});

describe('conversionSchema', () => {
  const base = { fromCode: 'LB', toCode: 'KG', multiplyRate: '0.45359237', divideRate: '2.204622621849' };
  it('accepts reciprocal rates', () => {
    expect(ok(conversionSchema, base)).toBe(true);
  });
  it('accepts the owner’s reference screenshot (0.453592909436 / 2.20462)', () => {
    expect(ok(conversionSchema, { ...base, multiplyRate: '0.453592909436', divideRate: '2.20462' })).toBe(true);
  });
  it('refuses non-reciprocal rates, same unit, zero and signs, and too many decimals', () => {
    expect(ok(conversionSchema, { ...base, divideRate: '3' })).toBe(false);
    expect(ok(conversionSchema, { ...base, toCode: 'LB' })).toBe(false);
    expect(ok(conversionSchema, { ...base, multiplyRate: '0' })).toBe(false);
    expect(ok(conversionSchema, { ...base, multiplyRate: '-0.45' })).toBe(false);
    expect(ok(conversionSchema, { ...base, multiplyRate: '0.4535923712345' })).toBe(false);
  });
  it('accepts a per-product pair', () => {
    expect(ok(conversionSchema, { productId: '11111111-1111-4111-8111-111111111111', fromCode: 'BOX', toCode: 'PC', multiplyRate: '12', divideRate: '0.083333333333' })).toBe(true);
  });
});

describe('convertPreviewSchema', () => {
  it('limits quantity decimals to the QUANTITY class', () => {
    expect(ok(convertPreviewSchema, { quantity: '2.5', fromCode: 'LB', toCode: 'KG' })).toBe(true);
    expect(ok(convertPreviewSchema, { quantity: '2.1234567', fromCode: 'LB', toCode: 'KG' })).toBe(false);
  });
});

describe('lineMeasureSchema', () => {
  it('accepts a measure, or length × width', () => {
    expect(ok(lineMeasureSchema, { measuredQty: '2.4' })).toBe(true);
    expect(ok(lineMeasureSchema, { length: '2.5', width: '1.2' })).toBe(true);
  });
  it('refuses half an area, both forms together, zero and negatives', () => {
    expect(ok(lineMeasureSchema, { length: '2.5' })).toBe(false);
    expect(ok(lineMeasureSchema, { measuredQty: '2', length: '2.5', width: '1' })).toBe(false);
    expect(ok(lineMeasureSchema, { measuredQty: '0' })).toBe(false);
    expect(ok(lineMeasureSchema, { measuredQty: '-1' })).toBe(false);
  });
});

describe('productMeasureSettingsSchema', () => {
  it('allows none, or positive values', () => {
    expect(ok(productMeasureSettingsSchema, {})).toBe(true);
    expect(ok(productMeasureSettingsSchema, { minBillableQty: null, billingIncrement: '0.5' })).toBe(true);
    expect(ok(productMeasureSettingsSchema, { minBillableQty: '0' })).toBe(false);
  });
});
