import {
  ORDER_TYPE_IDS,
  resolveOrderTypeFromBookingFulfillment,
} from '@/lib/constants/order-types';
import { formatOrderTypeLabel } from '@/lib/constants/order-type-labels';

describe('resolveOrderTypeFromBookingFulfillment', () => {
  it('maps branch drop-off pickup separately from home collection (§9 C5/C6)', () => {
    expect(resolveOrderTypeFromBookingFulfillment('pickup')).toBe(ORDER_TYPE_IDS.PICKUP);
    expect(resolveOrderTypeFromBookingFulfillment('home_collection')).toBe(
      ORDER_TYPE_IDS.HOME_COLLECTION,
    );
    expect(resolveOrderTypeFromBookingFulfillment('collection_and_delivery')).toBe(
      ORDER_TYPE_IDS.COLLECTION_AND_DELIVERY,
    );
    expect(resolveOrderTypeFromBookingFulfillment('delivery')).toBe(ORDER_TYPE_IDS.DELIVERY);
    expect(resolveOrderTypeFromBookingFulfillment('bring_in')).toBe(ORDER_TYPE_IDS.POS);
  });
});

describe('formatOrderTypeLabel', () => {
  const translate = (key: string) => `t:${key}`;

  it('returns localized label for known catalog codes', () => {
    expect(formatOrderTypeLabel('HOME_COLLECTION', translate)).toBe(
      't:orderTypes.HOME_COLLECTION',
    );
    expect(formatOrderTypeLabel('PICKUP', translate)).toBe('t:orderTypes.PICKUP');
  });

  it('falls back to raw code for unknown values', () => {
    expect(formatOrderTypeLabel('LEGACY_CODE', translate)).toBe('LEGACY_CODE');
    expect(formatOrderTypeLabel(null, translate)).toBe('—');
  });
});
