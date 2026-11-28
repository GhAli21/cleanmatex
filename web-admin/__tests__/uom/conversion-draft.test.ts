import { checkRates, conversionUnits, previewRate, suggestedDivideRate } from '@/src/features/uom/model/conversion-draft';

describe('conversion dialog rules', () => {
  it('suggests the reciprocal without scientific notation and only for a usable rate', () => {
    expect(suggestedDivideRate('0.45359237')).toBe('2.204622621849');
    expect(suggestedDivideRate('10000000')).toBe('0.0000001');
    expect(suggestedDivideRate('0')).toBeNull();
    expect(suggestedDivideRate('1.')).toBeNull();
    expect(suggestedDivideRate('3000000000000000')).toBeNull();
  });

  it('tells an incomplete, an invalid and a non-reciprocal pair apart', () => {
    expect(checkRates('', '')).toBe('incomplete');
    expect(checkRates('abc', '')).toBe('invalid');
    expect(checkRates('12', '0')).toBe('invalid');
    expect(checkRates('12', '0.5')).toBe('mismatch');
    expect(checkRates('12', '0.083333333333')).toBe('ok');
  });

  it('shows a rate without trailing zeros and keeps whole numbers', () => {
    expect(previewRate('0.453592370000')).toBe('0.45359237');
    expect(previewRate('12.000')).toBe('12');
    expect(previewRate('1000')).toBe('1000');
  });

  const units = [
    { code: 'PC', dimension: 'COUNT' as const, isPackaging: false },
    { code: 'BOX', dimension: 'COUNT' as const, isPackaging: true },
    { code: 'KG', dimension: 'MASS' as const, isPackaging: false },
    { code: 'LB', dimension: 'MASS' as const, isPackaging: false },
  ];
  const codes = (list: { code: string }[]) => list.map((u) => u.code);

  it('an Organization-wide pair stays in one measure and takes no packs', () => {
    const choices = conversionUnits(units, 'KG', false);
    expect(codes(choices.from)).toEqual(['PC', 'KG', 'LB']);
    expect(codes(choices.to)).toEqual(['LB']);
  });

  it('a product pair may join any two units', () => {
    expect(codes(conversionUnits(units, 'BOX', true).to)).toEqual(['PC', 'KG', 'LB']);
  });
});
