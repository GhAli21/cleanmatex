import {
  formatMoneyAmount,
  formatMoneyAmountWithCode,
  resolveMoneyIntlLocale,
} from '@/lib/money/format-money';
import { formatDate, formatTime, resolveDateIntlLocale } from '@/lib/utils/rtl';

describe('GCC-first number & date formatting with Extra Config', () => {
  it('defaults Arabic money formatting to Western 123 (LATN) digits', () => {
    const out = formatMoneyAmountWithCode(12.5, {
      currencyCode: 'OMR',
      decimalPlaces: 3,
      locale: 'ar',
    });
    expect(out).toBe('12.500 OMR');
    expect(out).not.toMatch(/[٠-٩]/);
  });

  it('switches to Eastern Arabic numerals when numberScript=ARAB', () => {
    const out = formatMoneyAmount(12.5, {
      currencyCode: '',
      decimalPlaces: 3,
      locale: 'ar',
      numberScript: 'ARAB',
    });
    expect(out).toMatch(/[٠-٩]/);
  });

  it('supports EN_US vs AR_LATN grouping while keeping legacy resolveMoneyIntlLocale(ar)', () => {
    expect(resolveMoneyIntlLocale('ar')).toBe('ar');
    expect(
      resolveMoneyIntlLocale('ar', {
        numberScript: 'LATN',
        groupingLocale: 'EN_US',
      })
    ).toBe('en-US');
    expect(
      resolveMoneyIntlLocale('ar', {
        numberScript: 'LATN',
        groupingLocale: 'AR_LATN',
      })
    ).toBe('ar-u-nu-latn');
  });

  it('formats Arabic dates with Western 123 digits by default and ARAB when configured', () => {
    const date = new Date('2026-11-19T14:30:00Z');
    expect(resolveDateIntlLocale('ar', 'LATN')).toBe('ar-u-nu-latn');
    expect(formatDate(date, { year: 'numeric', day: 'numeric', month: 'short' }, 'ar', 'LATN')).toMatch(
      /2026/
    );
    expect(formatTime(date, 'ar', 'ARAB')).toMatch(/[٠-٩]/);
  });
});
