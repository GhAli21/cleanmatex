// Phase 4 — Simple/Full mode pure helpers. The escalation predicate itself
// (`computeNeedsAdvanced`) is covered in payment-needs-advanced.test.ts; these
// tests cover the mode constants and the Simple-face method-chip deriver.
import {
  PAYMENT_MODAL_MODE,
  SIMPLE_MODE_METHOD_CHIP_LIMIT,
  deriveSimpleModeMethodOptions,
  isB2BCreditLimitBlocking,
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

  it('treats a draft leg without a method code as never Simple-editable', () => {
    expect(isLegOnSimpleFace({}, chips)).toBe(false);
    expect(isLegOnSimpleFace({ method: null }, chips)).toBe(false);
    expect(
      resolveSimpleFaceActiveLegIndex({
        paymentLegs: [{ method: undefined }, { method: 'CASH' }],
        simpleOptions: chips,
        currentIndex: 0,
      })
    ).toBe(1);
  });

  it(`toSettlementOptionKey joins method and gateway`, () => {
    expect(toSettlementOptionKey('STRIPE', 'STRIPE')).toBe('STRIPE::STRIPE');
    expect(toSettlementOptionKey('CASH', null)).toBe('CASH::');
    expect(toSettlementOptionKey('CARD')).toBe('CARD::');
  });
});

describe('isB2BCreditLimitBlocking', () => {
  it('blocks when the CREDIT_INVOICE receivable exceeds available credit', () => {
    // limit 100, available 40, full 70 on account → 70 > 40 → blocked
    expect(
      isB2BCreditLimitBlocking({
        creditLimit: 100,
        available: 40,
        remainingBalance: 70,
        outstandingPolicy: 'CREDIT_INVOICE',
      })
    ).toBe(true);
  });

  it('does NOT block once part is paid so the receivable fits available (pay-to-fit)', () => {
    // available 40, only 40 left on account → 40 not > 40 → allowed
    expect(
      isB2BCreditLimitBlocking({
        creditLimit: 100,
        available: 40,
        remainingBalance: 40,
        outstandingPolicy: 'CREDIT_INVOICE',
      })
    ).toBe(false);
  });

  it('does not block a fully settled B2B cash/card payment', () => {
    expect(
      isB2BCreditLimitBlocking({
        creditLimit: 100,
        available: 0,
        remainingBalance: 0,
        outstandingPolicy: 'NONE',
      })
    ).toBe(false);
  });

  it('does not apply credit control when the customer has no credit limit', () => {
    expect(
      isB2BCreditLimitBlocking({
        creditLimit: 0,
        available: 0,
        remainingBalance: 500,
        outstandingPolicy: 'CREDIT_INVOICE',
      })
    ).toBe(false);
  });
});
