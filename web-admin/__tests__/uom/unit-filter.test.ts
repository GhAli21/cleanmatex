import { filterUnits, NO_UNIT_FILTER } from '@/src/features/uom/model/unit-filter';
import type { UomUnit } from '@/lib/types/uom';

const unit = (code: string, extra: Partial<UomUnit> = {}): UomUnit => ({
  code, sysCode: code, origin: 'SYSTEM', name: code, name2: null, symbol: code.toLowerCase(), symbol2: null,
  dimension: 'MASS', isBaseUnit: false, isPackaging: false, qtyDecimals: 2, uneceCode: null, isActive: true,
  displayOrder: null, ...extra,
});
const units = [
  unit('KG', { name: 'Kilogram', name2: 'كيلوغرام', uneceCode: 'KGM' }),
  unit('LB', { name: 'Pound', isActive: false }),
  unit('M', { name: 'Metre', dimension: 'LENGTH' }),
];
const codes = (list: UomUnit[]) => list.map((u) => u.code);

describe('filterUnits', () => {
  it('no filter keeps everything in order', () => {
    expect(codes(filterUnits(units, NO_UNIT_FILTER))).toEqual(['KG', 'LB', 'M']);
  });
  it('searches code, names in both languages and the UN/ECE code', () => {
    for (const search of ['  kilo ', 'كيلو', 'kgm']) {
      expect(codes(filterUnits(units, { ...NO_UNIT_FILTER, search }))).toEqual(['KG']);
    }
  });
  it('narrows by dimension and status together', () => {
    expect(codes(filterUnits(units, { search: '', dimension: 'MASS', status: 'inactive' }))).toEqual(['LB']);
    expect(filterUnits(units, { search: 'metre', dimension: 'MASS', status: '' })).toEqual([]);
  });
});
