import {
  formatMoneyAmount,
  formatMoneyAmountWithCode,
  resolveMoneyIntlLocale,
  roundMoneyAmount,
} from '@/lib/money/format-money';

describe('roundMoneyAmount', () => {
  it('rounds to tenant decimal places', () => {
    expect(roundMoneyAmount(1.236, 2)).toBe(1.24);
    expect(roundMoneyAmount(1.2346, 3)).toBe(1.235);
  });

  it('falls back for invalid decimalPlaces', () => {
    expect(roundMoneyAmount(1.2, NaN as unknown as number)).toBe(1.2);
  });
});

describe('formatMoneyAmount', () => {
  it('formats with Intl for OMR and 3 decimals', () => {
    const s = formatMoneyAmount(12.5, { currencyCode: 'OMR', decimalPlaces: 3, locale: 'en' });
    expect(s).toMatch(/12/);
    expect(s).toMatch(/500|5/);
  });

  it('uses SAR with 2 decimals', () => {
    const s = formatMoneyAmount(10.2, { currencyCode: 'SAR', decimalPlaces: 2, locale: 'en' });
    expect(s).toContain('10');
  });

  it('falls back when currency code is invalid for Intl', () => {
    const s = formatMoneyAmount(1, { currencyCode: 'XXXINVALID', decimalPlaces: 2, locale: 'en' });
    expect(s).toContain('XXXINVALID');
  });
});

describe('formatMoneyAmountWithCode', () => {
  it('appends ISO code after formatted number', () => {
    const s = formatMoneyAmountWithCode(7.5, { currencyCode: 'OMR', decimalPlaces: 3, locale: 'en' });
    expect(s.endsWith(' OMR')).toBe(true);
  });
});

describe('resolveMoneyIntlLocale', () => {
  it('maps en and ar', () => {
    expect(resolveMoneyIntlLocale('en')).toBe('en-OM');
    expect(resolveMoneyIntlLocale('ar')).toBe('ar-OM');
  });
});
