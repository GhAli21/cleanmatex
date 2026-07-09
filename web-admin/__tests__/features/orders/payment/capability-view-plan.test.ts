import {
  planCapabilityView,
  selectInlineSlots,
  selectDialogSlots,
  selectBlockedSlots,
  selectRequiredSlots,
  selectGuardSlots,
} from '@features/orders/payment/view/capability-view-plan';
import { PAYMENT_REASON } from '@features/orders/payment/domain/payment-reasons';
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

  it('SIMPLE keeps the inline lane and surfaces common capabilities as quick-action buttons', () => {
    const plan = planCapabilityView(sampleCapabilities(), SIMPLE_PRESET);
    // Cash/Card inline; SPLIT_TENDER + GIFT_CARD are quick-action dialog buttons;
    // FX_ROUNDING is unavailable in the fixture → dropped.
    expect(plan.map((s) => s.key)).toEqual([
      PAYMENT_CAPABILITY.CASH,
      PAYMENT_CAPABILITY.CARD,
      PAYMENT_CAPABILITY.SPLIT_TENDER,
      PAYMENT_CAPABILITY.GIFT_CARD,
    ]);
    expect(
      plan.find((s) => s.key === PAYMENT_CAPABILITY.SPLIT_TENDER)?.presentation,
    ).toBe('dialog');
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

describe('selectGuardSlots (dedup by reason)', () => {
  it('renders one guard per distinct reason, first occurrence winning', () => {
    // The registry deliberately overlaps: CASH_DRAWER and the aggregate
    // SUBMIT_GUARDS both report CASH_DRAWER_SESSION_CLOSED for a closed drawer.
    const caps = [
      evaluated(PAYMENT_CAPABILITY.CASH_DRAWER, {
        presentation: 'inline',
        blocked: true,
        blockReason: PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED,
      }),
      evaluated(PAYMENT_CAPABILITY.SUBMIT_GUARDS, {
        presentation: 'inline',
        blocked: true,
        blockReason: PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED,
      }),
    ];
    const plan = planCapabilityView(caps, FULL_PRESET);
    const guards = selectGuardSlots(plan);
    expect(guards).toHaveLength(1);
    expect(guards[0].key).toBe(PAYMENT_CAPABILITY.CASH_DRAWER);
  });

  it('keeps distinct reasons and skips blocked slots with no reason', () => {
    const caps = [
      evaluated(PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING, {
        blocked: true,
        blockReason: PAYMENT_REASON.OVERPAYMENT_RESOLUTION_REQUIRED,
      }),
      evaluated(PAYMENT_CAPABILITY.SUBMIT_GUARDS, {
        presentation: 'inline',
        blocked: true,
        blockReason: PAYMENT_REASON.OUTSTANDING_POLICY_REQUIRED,
      }),
      // Defensive: blocked without a reason is skipped.
      evaluated(PAYMENT_CAPABILITY.CASH_DRAWER, { presentation: 'inline', blocked: true }),
    ];
    const plan = planCapabilityView(caps, FULL_PRESET);
    expect(selectGuardSlots(plan).map((s) => s.evaluated.blockReason)).toEqual([
      PAYMENT_REASON.OVERPAYMENT_RESOLUTION_REQUIRED,
      PAYMENT_REASON.OUTSTANDING_POLICY_REQUIRED,
    ]);
  });
});
