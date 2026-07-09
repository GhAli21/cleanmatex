import {
  planCapabilityView,
  selectInlineSlots,
  selectDialogSlots,
  selectBlockedSlots,
  selectRequiredSlots,
} from '@features/orders/payment/view/capability-view-plan';
import { SIMPLE_PRESET, FULL_PRESET } from '@features/orders/payment/presets';
import { PAYMENT_CAPABILITY } from '@features/orders/payment/capabilities/capability-keys';
import type { EvaluatedCapability } from '@features/orders/payment/capabilities/registry';
import type { PaymentCapabilityKey } from '@features/orders/payment/capabilities/capability-keys';

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

/** A representative registry-order slice of evaluated capabilities. */
function sampleCapabilities(): EvaluatedCapability[] {
  return [
    evaluated(PAYMENT_CAPABILITY.CASH, { presentation: 'inline' }),
    evaluated(PAYMENT_CAPABILITY.CARD, { presentation: 'inline' }),
    evaluated(PAYMENT_CAPABILITY.SPLIT_TENDER, { presentation: 'dialog' }),
    evaluated(PAYMENT_CAPABILITY.GIFT_CARD, { presentation: 'dialog' }),
    evaluated(PAYMENT_CAPABILITY.FX_ROUNDING, {
      available: false,
      presentation: 'hidden',
    }),
  ];
}

describe('planCapabilityView', () => {
  it('drops hidden capabilities and preserves registry order (FULL)', () => {
    const plan = planCapabilityView(sampleCapabilities(), FULL_PRESET);
    // FX_ROUNDING is unavailable → hidden → dropped; the rest keep order.
    expect(plan.map((s) => s.key)).toEqual([
      PAYMENT_CAPABILITY.CASH,
      PAYMENT_CAPABILITY.CARD,
      PAYMENT_CAPABILITY.SPLIT_TENDER,
      PAYMENT_CAPABILITY.GIFT_CARD,
    ]);
  });

  it('SIMPLE hides the advanced dialog launchers but keeps the inline lane', () => {
    const plan = planCapabilityView(sampleCapabilities(), SIMPLE_PRESET);
    // SPLIT_TENDER + GIFT_CARD are hidden by SIMPLE (available, not required/blocked).
    expect(plan.map((s) => s.key)).toEqual([
      PAYMENT_CAPABILITY.CASH,
      PAYMENT_CAPABILITY.CARD,
    ]);
  });

  it('SIMPLE re-surfaces a required gate it would otherwise hide', () => {
    const caps = [
      evaluated(PAYMENT_CAPABILITY.GIFT_CARD, { required: true, presentation: 'dialog' }),
    ];
    const plan = planCapabilityView(caps, SIMPLE_PRESET);
    expect(plan).toHaveLength(1);
    expect(plan[0].presentation).toBe('dialog');
  });

  it('tags every slot with a visible (non-hidden) presentation', () => {
    const plan = planCapabilityView(sampleCapabilities(), FULL_PRESET);
    for (const slot of plan) {
      expect(slot.presentation === 'inline' || slot.presentation === 'dialog').toBe(true);
    }
  });
});

describe('plan selectors', () => {
  it('partitions inline vs dialog slots', () => {
    const plan = planCapabilityView(sampleCapabilities(), FULL_PRESET);
    expect(selectInlineSlots(plan).map((s) => s.key)).toEqual([
      PAYMENT_CAPABILITY.CASH,
      PAYMENT_CAPABILITY.CARD,
    ]);
    expect(selectDialogSlots(plan).map((s) => s.key)).toEqual([
      PAYMENT_CAPABILITY.SPLIT_TENDER,
      PAYMENT_CAPABILITY.GIFT_CARD,
    ]);
  });

  it('selects blocked slots regardless of presentation', () => {
    const caps = [
      evaluated(PAYMENT_CAPABILITY.CASH_DRAWER, {
        presentation: 'inline',
        blocked: true,
      }),
      evaluated(PAYMENT_CAPABILITY.CARD, { presentation: 'inline' }),
    ];
    const plan = planCapabilityView(caps, FULL_PRESET);
    expect(selectBlockedSlots(plan).map((s) => s.key)).toEqual([
      PAYMENT_CAPABILITY.CASH_DRAWER,
    ]);
  });

  it('selects required slots', () => {
    const caps = [
      evaluated(PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING, { required: true }),
      evaluated(PAYMENT_CAPABILITY.CARD, { presentation: 'inline' }),
    ];
    const plan = planCapabilityView(caps, FULL_PRESET);
    expect(selectRequiredSlots(plan).map((s) => s.key)).toEqual([
      PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING,
    ]);
  });
});
