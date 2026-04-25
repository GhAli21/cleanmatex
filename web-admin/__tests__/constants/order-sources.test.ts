import { DEFAULT_ORDER_SOURCE_CODE, ORDER_SOURCE_CODES } from '@/lib/constants/order-sources';

describe('order-sources constants', () => {
  it('includes seeded mobile channel', () => {
    expect(ORDER_SOURCE_CODES).toContain('customer_mobile_app');
    expect(ORDER_SOURCE_CODES).toContain('pos');
  });

  it('uses legacy_unknown as default code', () => {
    expect(DEFAULT_ORDER_SOURCE_CODE).toBe('legacy_unknown');
  });
});
