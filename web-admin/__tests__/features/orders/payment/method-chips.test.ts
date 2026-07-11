import { applyMethodChipPolicy } from '@features/orders/payment/view/method-chips';
import { SIMPLE_PRESET, FULL_PRESET } from '@features/orders/payment/presets';
import {
  deriveSimpleModeMethodOptions,
  SIMPLE_MODE_METHOD_CHIP_LIMIT,
} from '@features/orders/ui/payment-modal-v4.utils';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';

interface Option {
  payment_method_code: string;
  requires_reference?: boolean | null;
}

/** A catalog wider than the Simple-safe set, with a reference-required option. */
function catalog(): Option[] {
  return [
    { payment_method_code: PAYMENT_METHODS.CARD },
    { payment_method_code: PAYMENT_METHODS.CASH },
    { payment_method_code: PAYMENT_METHODS.STRIPE },
    { payment_method_code: PAYMENT_METHODS.MOBILE_PAYMENT },
    { payment_method_code: PAYMENT_METHODS.CHECK }, // not Simple-safe
    { payment_method_code: PAYMENT_METHODS.CARD, requires_reference: true }, // needs Full
  ];
}

describe('applyMethodChipPolicy', () => {
  it('is behavior-identical to deriveSimpleModeMethodOptions for the SIMPLE policy (parity)', () => {
    const options = catalog();
    expect(applyMethodChipPolicy(options, SIMPLE_PRESET.methodChips)).toEqual(
      deriveSimpleModeMethodOptions(options),
    );
  });

  it('keeps cash first and caps at the Simple chip limit under the SIMPLE policy', () => {
    const chips = applyMethodChipPolicy(catalog(), SIMPLE_PRESET.methodChips);
    expect(chips.length).toBeLessThanOrEqual(SIMPLE_MODE_METHOD_CHIP_LIMIT);
    expect(chips[0].payment_method_code).toBe(PAYMENT_METHODS.CASH);
    // Reference-required + non-safe codes are excluded.
    expect(chips.every((c) => c.payment_method_code !== PAYMENT_METHODS.CHECK)).toBe(true);
    expect(chips.every((c) => !c.requires_reference)).toBe(true);
  });

  it('returns all options in catalog order under the FULL (workbench) policy', () => {
    const options = catalog();
    expect(applyMethodChipPolicy(options, FULL_PRESET.methodChips)).toEqual(options);
  });

  it('applies a policy chip limit on the workbench when set', () => {
    const options = catalog();
    const limited = applyMethodChipPolicy(options, { simpleSafeOnly: false, chipLimit: 2 });
    expect(limited).toHaveLength(2);
    expect(limited).toEqual(options.slice(0, 2));
  });
});
