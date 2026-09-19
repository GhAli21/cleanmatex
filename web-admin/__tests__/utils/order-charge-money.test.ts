import { CHARGE_TYPES } from '@/lib/constants/order-financial';
import { PREFS_LEVEL } from '@/lib/constants/order-preferences';
import {
  isMoneyAddendCharge,
  mapPreferenceLevels,
  sumMoneyAddendCharges,
} from '@/lib/utils/order-charge-money';

describe('order-charge-money', () => {
  const levels = mapPreferenceLevels([
    { id: 'pref-order', prefs_level: PREFS_LEVEL.ORDER },
    { id: 'pref-piece', prefs_level: PREFS_LEVEL.PIECE },
    { id: 'pref-item', prefs_level: PREFS_LEVEL.ITEM },
  ]);

  it('counts ORDER-level PREFERENCE and real non-pref charges', () => {
    const charges = [
      { charge_type: CHARGE_TYPES.PREFERENCE, amount: 0.7, charge_source_id: 'pref-order' },
      { charge_type: CHARGE_TYPES.EXPRESS, amount: 1.5 },
    ];
    expect(sumMoneyAddendCharges(charges, levels)).toBeCloseTo(2.2);
  });

  it('does not add ITEM/PIECE PREFERENCE extras to the commercial total', () => {
    const charges = [
      { charge_type: CHARGE_TYPES.PREFERENCE, amount: 0.4, charge_source_id: 'pref-piece' },
      { charge_type: CHARGE_TYPES.PREFERENCE, amount: 0.2, charge_source_id: 'pref-item' },
    ];
    expect(sumMoneyAddendCharges(charges, levels)).toBe(0);
    expect(isMoneyAddendCharge(charges[0], levels)).toBe(false);
  });
});
