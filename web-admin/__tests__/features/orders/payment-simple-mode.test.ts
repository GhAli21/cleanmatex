// Phase 4 — Simple/Full mode pure helpers. The escalation predicate itself
// (`computeNeedsAdvanced`) is covered in payment-needs-advanced.test.ts; these
// tests cover the mode constants and the Simple-face method-chip deriver.
import {
  PAYMENT_MODAL_MODE,
  SIMPLE_MODE_METHOD_CHIP_LIMIT,
  deriveSimpleModeMethodOptions,
  isLegOnSimpleFace,
  resolveSimpleFaceActiveLegIndex,
  toSettlementOptionKey,
  type SimpleModeMethodOptionLike,
} from '@features/orders/ui/payment-modal-v4.utils';

type TestOption = SimpleModeMethodOptionLike & { id: string };

const option = (
  id: string,
  payment_method_code: string,
  requires_reference?: boolean | null
): TestOption => ({ id, payment_method_code, requires_reference });

describe('PAYMENT_MODAL_MODE', () => {
  it('exposes the two locked faces', () => {
    expect(PAYMENT_MODAL_MODE.SIMPLE).toBe('simple');
    expect(PAYMENT_MODAL_MODE.FULL).toBe('full');
  });
});

describe('deriveSimpleModeMethodOptions', () => {
  it('keeps cash and card/gateway tenders, in catalog order after cash', () => {
    const result = deriveSimpleModeMethodOptions([
      option('card', 'CARD'),
      option('cash', 'CASH'),
      option('mobile', 'MOBILE_PAYMENT'),
    ]);
    expect(result.map((entry) => entry.id)).toEqual(['cash', 'card', 'mobile']);
  });

  it('excludes methods the Simple face cannot complete (check, transfer, deferred, credits)', () => {
    const result = deriveSimpleModeMethodOptions([
      option('check', 'CHECK'),
      option('transfer', 'BANK_TRANSFER'),
      option('poc', 'PAY_ON_COLLECTION'),
      option('invoice', 'INVOICE'),
      option('wallet', 'WALLET'),
      option('credit-note', 'CREDIT_NOTE'),
    ]);
    expect(result).toEqual([]);
  });

  it('excludes otherwise-safe options that demand a reference', () => {
    const result = deriveSimpleModeMethodOptions([
      option('cash', 'CASH'),
      option('card-ref', 'CARD', true),
    ]);
    expect(result.map((entry) => entry.id)).toEqual(['cash']);
  });

  it('includes gateway-backed methods', () => {
    const result = deriveSimpleModeMethodOptions([
      option('gw', 'PAYMENT_GATEWAY'),
      option('hyperpay', 'HYPERPAY'),
      option('paytabs', 'PAYTABS'),
    ]);
    expect(result.map((entry) => entry.id)).toEqual(['gw', 'hyperpay', 'paytabs']);
  });

  it(`caps the chip row at ${SIMPLE_MODE_METHOD_CHIP_LIMIT} with cash always first`, () => {
    const result = deriveSimpleModeMethodOptions([
      option('card', 'CARD'),
      option('mobile', 'MOBILE_PAYMENT'),
      option('gw', 'PAYMENT_GATEWAY'),
      option('cash', 'CASH'),
    ]);
    expect(result).toHaveLength(SIMPLE_MODE_METHOD_CHIP_LIMIT);
    expect(result[0]?.id).toBe('cash');
    // Cash first, then catalog order — capped at the chip limit (limit-agnostic).
    expect(result.map((entry) => entry.id)).toEqual(
      ['cash', 'card', 'mobile', 'gw'].slice(0, SIMPLE_MODE_METHOD_CHIP_LIMIT),
    );
  });

  it('returns an empty row for an empty catalog', () => {
    expect(deriveSimpleModeMethodOptions([])).toEqual([]);
  });
});

describe('resolveSimpleFaceActiveLegIndex', () => {
  const chips = [
    option('cash', 'CASH'),
    option('card', 'CARD'),
    option('mobile', 'MOBILE_PAYMENT'),
  ];

  it('keeps the current index when the active leg is already on a Simple chip', () => {
    expect(
      resolveSimpleFaceActiveLegIndex({
        paymentLegs: [
          { method: 'CASH' },
          { method: 'CARD' },
          { method: 'STRIPE', gateway_code: 'STRIPE' },
        ],
        simpleOptions: chips,
        currentIndex: 1,
      })
    ).toBe(1);
  });

  it('retargets off-chip active legs (e.g. Stripe) to the first chip that has a leg', () => {
    expect(
      resolveSimpleFaceActiveLegIndex({
        paymentLegs: [
          { method: 'CASH' },
          { method: 'CARD' },
          { method: 'CHECK' },
          { method: 'STRIPE', gateway_code: 'STRIPE' },
        ],
        simpleOptions: chips,
        currentIndex: 3,
      })
    ).toBe(0);
  });

  it('leaves the index unchanged when no chip-visible leg exists', () => {
    expect(
      resolveSimpleFaceActiveLegIndex({
        paymentLegs: [
          { method: 'CHECK' },
          { method: 'STRIPE', gateway_code: 'STRIPE' },
        ],
        simpleOptions: chips,
        currentIndex: 1,
      })
    ).toBe(1);
  });

  it('matches gateway identity so CARD is not confused with STRIPE', () => {
    const gatewayChips = [
      option('cash', 'CASH'),
      option('card', 'CARD'),
      { id: 'stripe', payment_method_code: 'STRIPE', gateway_code: 'STRIPE' },
    ];
    expect(
      isLegOnSimpleFace(
        { method: 'STRIPE', gateway_code: 'STRIPE' },
        gatewayChips
      )
    ).toBe(true);
    expect(
      isLegOnSimpleFace({ method: 'STRIPE', gateway_code: 'STRIPE' }, chips)
    ).toBe(false);
  });

  it('toSettlementOptionKey joins method and gateway', () => {
    expect(toSettlementOptionKey('STRIPE', 'STRIPE')).toBe('STRIPE::STRIPE');
    expect(toSettlementOptionKey('CASH', null)).toBe('CASH::');
    expect(toSettlementOptionKey('CARD')).toBe('CARD::');
  });
});
