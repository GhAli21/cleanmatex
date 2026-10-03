import { financeTenderScopeOf } from '@/lib/utils/cash-method';

describe('financeTenderScopeOf (B1)', () => {
  it('is CASH when any leg is cash-family, whatever else is tendered', () => {
    expect(financeTenderScopeOf(['CARD', 'CASH'])).toBe('CASH');
    expect(financeTenderScopeOf([' cash '])).toBe('CASH');
  });

  it('is NON_CASH for tenders without cash', () => {
    expect(financeTenderScopeOf(['CARD'])).toBe('NON_CASH');
    expect(financeTenderScopeOf(['WALLET', 'BANK_TRANSFER'])).toBe('NON_CASH');
  });

  it('is NONE when nothing is tendered', () => {
    expect(financeTenderScopeOf([])).toBe('NONE');
    expect(financeTenderScopeOf([null, undefined, ' '])).toBe('NONE');
  });
});
