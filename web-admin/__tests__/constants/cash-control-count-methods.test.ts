import { allowedCountMethods } from '@/lib/constants/cash-control';

describe('allowedCountMethods', () => {
  it('fixes the method when the policy is mandatory', () => {
    expect(allowedCountMethods('DENOMINATION')).toEqual(['DENOMINATION']);
    expect(allowedCountMethods('TOTAL_ONLY')).toEqual(['TOTAL_ONLY']);
  });

  it('offers both, total first, when denominations are optional', () => {
    expect(allowedCountMethods('OPTIONAL_DENOMINATION')).toEqual(['TOTAL_ONLY', 'DENOMINATION']);
  });
});
