import { createUomResolver } from '@/lib/uom/convert'
import { applyKeypadKey } from '@/lib/uom/scale'
import { convertMeasure, measureEntryUnits, sizeMeasure, squareMetreRate } from '@/src/features/orders/model/measure-entry'
import type { UomConversion, UomUnit } from '@/lib/types/uom'

const unit = (code: string, dimension: UomUnit['dimension'], isBaseUnit = false, isActive = true): UomUnit => ({
  code, sysCode: code, origin: 'SYSTEM', name: code, name2: null, symbol: code.toLowerCase(), symbol2: null,
  dimension, isBaseUnit, isPackaging: false, qtyDecimals: dimension === 'COUNT' ? 0 : 3, uneceCode: null, isActive, displayOrder: null,
})
const pair = (fromCode: string, toCode: string, multiplyRate: string, divideRate: string, productId: string | null = null): UomConversion => ({
  id: `${fromCode}${toCode}`, productId, fromCode, toCode, multiplyRate, divideRate,
  isFromSystem: false, isCustomized: false, isActive: true, notes: null,
})
const units = [
  unit('PC', 'COUNT', true), unit('BOX', 'COUNT'), unit('KG', 'MASS', true), unit('LB', 'MASS'), unit('OZ', 'MASS', false, false),
  unit('M', 'LENGTH', true), unit('FT', 'LENGTH'), unit('SQM', 'AREA', true), unit('SQFT', 'AREA'),
]
const resolver = createUomResolver(units, [
  pair('LB', 'KG', '0.45359237', '2.204622621849'),
  pair('OZ', 'KG', '0.028349523125', '35.27396195'),
  pair('FT', 'M', '0.3048', '3.280839895013'),
  pair('SQFT', 'SQM', '0.09290304', '10.763910416710'),
  pair('BOX', 'KG', '12', '0.083333333333', 'p1'),
])
const codes = (list: { code: string }[]) => list.map((u) => u.code)

describe('measureEntryUnits', () => {
  it('offers the product unit first, then every active unit that converts to it', () => {
    expect(codes(measureEntryUnits(resolver, units, { code: 'KG', dimension: 'MASS' }, 'p2'))).toEqual(['KG', 'LB'])
  })
  it('includes the product\'s own pack for that product only', () => {
    expect(codes(measureEntryUnits(resolver, units, { code: 'KG', dimension: 'MASS' }, 'p1'))).toEqual(['KG', 'BOX', 'LB'])
  })
  it('offers lengths in metres first for any area unit, a custom one included', () => {
    for (const code of ['SQM', 'SQFT', 'BLOCK']) {
      const list = measureEntryUnits(resolver, units, { code, dimension: 'AREA' }, 'p1')
      expect(codes(list)).toEqual(['M', 'FT'])
      expect(list[1].rate).toBe('0.3048')
    }
  })
  it('offers nothing while the units are unknown', () => {
    expect(measureEntryUnits(createUomResolver([], []), [], { code: 'KG', dimension: 'MASS' })).toEqual([])
  })
})

describe('convertMeasure', () => {
  it('rounds half-up to the product unit and leaves empty or unfinished fields empty', () => {
    expect(convertMeasure({ measuredQty: '2', length: '', width: '.' }, '0.45359237', 3))
      .toEqual({ measuredQty: '0.907', length: '', width: '' })
  })
  it('keeps a figure too small for the unit visible as zero', () => {
    expect(convertMeasure({ measuredQty: '0.001', length: '', width: '' }, '0.028349523125', 3).measuredQty).toBe('0')
  })
})

describe('squareMetreRate', () => {
  it('gives one square metre in the area unit, or null when there is no path', () => {
    expect(squareMetreRate(resolver, units, { code: 'SQM', dimension: 'AREA' })).toBe('1')
    expect(squareMetreRate(resolver, units, { code: 'SQFT', dimension: 'AREA' })).toBe('10.76391041671')
    expect(squareMetreRate(resolver, units, { code: 'BLOCK', dimension: 'AREA' })).toBeNull()
    expect(squareMetreRate(resolver, units, { code: 'KG', dimension: 'MASS' })).toBeNull()
  })
})

describe('sizeMeasure', () => {
  it('keeps the size in metres and gives the area in the product unit', () => {
    expect(sizeMeasure({ measuredQty: '', length: '2', width: '3' }, '1', '1.195990046301', 2))
      .toEqual({ measuredQty: '7.18', length: '2', width: '3' }) // square yards
    expect(sizeMeasure({ measuredQty: '', length: '8', width: '10' }, '0.3048', '10.76391041671', 2))
      .toEqual({ measuredQty: '80', length: '2.4384', width: '3.048' }) // feet on square feet: exactly 80
  })
  it('keeps every typed inch exactly in metres', () => {
    expect(sizeMeasure({ measuredQty: '', length: '7.25', width: '1' }, '0.0254', '1', 6).length).toBe('0.18415')
  })
  it('leaves the area empty until both sides are typed', () => {
    expect(sizeMeasure({ measuredQty: '', length: '2', width: '' }, '1', '1', 2)).toEqual({ measuredQty: '', length: '2', width: '' })
  })
})

describe('applyKeypadKey', () => {
  it('builds a number within the unit decimals', () => {
    expect(['0', '5'].reduce((v, k) => applyKeypadKey(v, k, 2), '')).toBe('5')
    expect(applyKeypadKey('', '.', 2)).toBe('0.')
    expect(applyKeypadKey('2.35', '7', 2)).toBe('2.35')
    expect(applyKeypadKey('2', '.', 0)).toBe('2')
    expect(applyKeypadKey('2.5', '.', 2)).toBe('2.5')
    expect(applyKeypadKey('12', 'backspace', 0)).toBe('1')
  })
})
