import {
  PAYMENT_PRESET,
  SIMPLE_PRESET,
  FULL_PRESET,
  resolvePreset,
  resolveViewPresentation,
} from '@features/orders/payment/presets';
import { SIMPLE_MODE_METHOD_CHIP_LIMIT } from '@features/orders/ui/payment-modal-v4.utils';
import { PAYMENT_CAPABILITY } from '@features/orders/payment/capabilities/capability-keys';
import type {
  CapabilityPresentation,
  EvaluatedCapability,
} from '@features/orders/payment/capabilities/registry';
import type { PaymentCapabilityKey } from '@features/orders/payment/capabilities/capability-keys';

/**
 * Builds a minimal {@link EvaluatedCapability} fixture; only the fields the
 * presentation resolver reads are meaningful.
 */
function evaluated(
  key: PaymentCapabilityKey,
  overrides: Partial<EvaluatedCapability> = {},
): EvaluatedCapability {
  return {
    key,
    available: true,
    required: false,
    blocked: false,
    presentation: 'dialog',
    reasons: [],
    messageKeys: { title: `t.${key}`, action: `a.${key}` },
    ...overrides,
  };
}

describe('Payment presets (L6 descriptors)', () => {
  it('SIMPLE is the fast lane with the Simple-safe chip policy', () => {
    expect(SIMPLE_PRESET.key).toBe(PAYMENT_PRESET.SIMPLE);
    expect(SIMPLE_PRESET.layout).toBe('fast-lane');
    expect(SIMPLE_PRESET.methodChips.simpleSafeOnly).toBe(true);
    expect(SIMPLE_PRESET.methodChips.chipLimit).toBe(SIMPLE_MODE_METHOD_CHIP_LIMIT);
  });

  it('FULL is the uncapped workbench with no capability overrides', () => {
    expect(FULL_PRESET.key).toBe(PAYMENT_PRESET.FULL);
    expect(FULL_PRESET.layout).toBe('workbench');
    expect(FULL_PRESET.methodChips.simpleSafeOnly).toBe(false);
    expect(FULL_PRESET.methodChips.chipLimit).toBeNull();
    expect(Object.keys(FULL_PRESET.capabilityPresentation)).toHaveLength(0);
  });
});

describe('resolvePreset', () => {
  it('returns the built descriptor for active presets', () => {
    expect(resolvePreset(PAYMENT_PRESET.SIMPLE)).toBe(SIMPLE_PRESET);
    expect(resolvePreset(PAYMENT_PRESET.FULL)).toBe(FULL_PRESET);
  });

  it('falls back to FULL (safe superset) for a reserved/unbuilt preset', () => {
    expect(resolvePreset(PAYMENT_PRESET.PRO)).toBe(FULL_PRESET);
    expect(resolvePreset(PAYMENT_PRESET.MOBILE_POS)).toBe(FULL_PRESET);
  });
});

describe('resolveViewPresentation (registry × preset merge)', () => {
  it('(1) hides an unavailable capability regardless of preset intent', () => {
    const state = evaluated(PAYMENT_CAPABILITY.GIFT_CARD, {
      available: false,
      presentation: 'hidden',
    });
    expect(resolveViewPresentation(state, FULL_PRESET)).toBe('hidden');
    expect(resolveViewPresentation(state, SIMPLE_PRESET)).toBe('hidden');
  });

  it('(2) surfaces a blocked guard in place even when the preset would hide it', () => {
    // SPLIT_TENDER is hidden by the SIMPLE preset, but a blocked state wins.
    const state = evaluated(PAYMENT_CAPABILITY.SPLIT_TENDER, {
      blocked: true,
      presentation: 'inline',
    });
    expect(resolveViewPresentation(state, SIMPLE_PRESET)).toBe('inline');
  });

  it('(3) never hides a required gate the preset marks hidden — falls to intrinsic', () => {
    // GIFT_CARD is hidden in SIMPLE, but a required PIN gate must still surface.
    const state = evaluated(PAYMENT_CAPABILITY.GIFT_CARD, {
      required: true,
      presentation: 'dialog',
    });
    expect(resolveViewPresentation(state, SIMPLE_PRESET)).toBe('dialog');
  });

  it('(3) re-slots a required gate to a non-hidden preset override', () => {
    const preset = {
      ...FULL_PRESET,
      capabilityPresentation: {
        [PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING]: 'inline' as CapabilityPresentation,
      },
    };
    const state = evaluated(PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING, {
      required: true,
      presentation: 'dialog',
    });
    expect(resolveViewPresentation(state, preset)).toBe('inline');
  });

  it('applies the preset override for an available, non-required capability', () => {
    // SIMPLE hides SPLIT_TENDER when it is merely available (not required/blocked).
    const state = evaluated(PAYMENT_CAPABILITY.SPLIT_TENDER, { presentation: 'dialog' });
    expect(resolveViewPresentation(state, SIMPLE_PRESET)).toBe('hidden');
  });

  it('uses the registry intrinsic presentation when the preset has no override', () => {
    // FULL has no overrides, so split keeps its intrinsic dialog presentation.
    const state = evaluated(PAYMENT_CAPABILITY.SPLIT_TENDER, { presentation: 'dialog' });
    expect(resolveViewPresentation(state, FULL_PRESET)).toBe('dialog');
  });
});
