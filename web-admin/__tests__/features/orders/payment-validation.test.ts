import { derivePaymentValidationItems } from '@features/orders/hooks/payment-validation';
import type { PaymentValidationItemsContext } from '@features/orders/hooks/payment-validation';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';

type Option = { label?: string };

const t = (key: string) => key;

function leg(p: Partial<PaymentLeg> & { method: string }): PaymentLeg {
  return p as PaymentLeg;
}

function baseCtx(
  overrides: Partial<PaymentValidationItemsContext<Option>> = {}
): PaymentValidationItemsContext<Option> {
  return {
    t,
    currencyCode: 'OMR',
    formatAmount: (n) => n.toFixed(3),
    getMethodOption: () => ({ label: 'Card' }),
    getOptionDisplayName: (_o, fallback) => fallback ?? 'Method',
    promoCodeValidating: false,
    giftCardValidating: false,
    overpaymentBlocksSubmit: false,
    payExtraIntent: false,
    validationPhase: 'editing',
    unresolvedOverpaymentAmount: 0,
    checkNumberError: undefined,
    amountDiscountError: undefined,
    percentDiscountError: undefined,
    pinRequired: false,
    hasCheckLegWithoutNumber: false,
    hasCheckLegWithInvalidDate: false,
    paymentLegs: [],
    legsMissingRequiredReference: [],
    walletLegExceedsLiveBalance: false,
    liveWalletBalanceDisplay: 'OMR 0.000',
    storedValueLegExceedsBalance: false,
    storedValueLegExceedance: null,
    creditNoteLegsMissingReference: [],
    terminalRequiredLegs: [],
    cashDrawerBlockingMessage: null,
    invalidImmediateAmount: false,
    remainingBalance: 0,
    effectiveOutstandingPolicy: 'PAY_ON_COLLECTION',
    creditLimitValue: 0,
    creditLimitAvailable: 0,
    ...overrides,
  };
}

describe('derivePaymentValidationItems', () => {
  it('returns no blocking items for a clean, submittable state', () => {
    expect(derivePaymentValidationItems(baseCtx())).toEqual([]);
  });

  it('blocks while promo/gift card are validating', () => {
    expect(derivePaymentValidationItems(baseCtx({ promoCodeValidating: true }))).toContain(
      'promoCode.validating'
    );
    expect(derivePaymentValidationItems(baseCtx({ giftCardValidating: true }))).toContain(
      'giftCard.checking'
    );
  });

  it('uses the validate-first message when paying extra and not yet ready', () => {
    const items = derivePaymentValidationItems(
      baseCtx({ overpaymentBlocksSubmit: true, payExtraIntent: true, validationPhase: 'editing' })
    );
    expect(items).toContain('validatePayment.requiredBeforeSubmit');
  });

  it('uses the overpayment message when not in pay-extra flow', () => {
    const items = derivePaymentValidationItems(
      baseCtx({ overpaymentBlocksSubmit: true, payExtraIntent: false })
    );
    expect(items).toContain('rightRail.requiredAction.overpaymentMessage');
  });

  it('blocks on gift-card PIN and missing check number', () => {
    expect(derivePaymentValidationItems(baseCtx({ pinRequired: true }))).toContain(
      'giftCard.pinPendingError'
    );
    expect(
      derivePaymentValidationItems(baseCtx({ hasCheckLegWithoutNumber: true }))
    ).toContain('splitPayment.validation.checkNumberRequired');
  });

  it('blocks when a cash drawer message is present (passes it through verbatim)', () => {
    const msg = 'No open cash drawer session';
    expect(derivePaymentValidationItems(baseCtx({ cashDrawerBlockingMessage: msg }))).toContain(
      msg
    );
  });

  it('requires a remainder policy when NONE leaves a balance', () => {
    const items = derivePaymentValidationItems(
      baseCtx({ remainingBalance: 5, effectiveOutstandingPolicy: 'NONE' })
    );
    expect(items).toContain('remainder.validation.required');
  });

  it('blocks (always) when the credit-invoice receivable exceeds available credit', () => {
    // Order 70 fully on account: currentBalance 60, limit 100 → available 40.
    // Receivable 70 > 40 → blocked. No override path exists.
    const items = derivePaymentValidationItems(
      baseCtx({
        creditLimitValue: 100,
        creditLimitAvailable: 40,
        remainingBalance: 70,
        effectiveOutstandingPolicy: 'CREDIT_INVOICE',
      })
    );
    expect(items).toContain('b2b.creditExceeded');
  });

  it('does NOT block when the customer pays part now so the receivable fits available credit', () => {
    // Same customer (available 40), but 30 paid now → only 40 on account.
    // Receivable 40 is not > available 40 → allowed (pay-to-fit; 2026-07-11 fix).
    const items = derivePaymentValidationItems(
      baseCtx({
        creditLimitValue: 100,
        creditLimitAvailable: 40,
        remainingBalance: 40,
        effectiveOutstandingPolicy: 'CREDIT_INVOICE',
      })
    );
    expect(items).not.toContain('b2b.creditExceeded');
  });

  it('does not block on credit limit when the order is fully settled (cash/card)', () => {
    const items = derivePaymentValidationItems(
      baseCtx({
        creditLimitValue: 100,
        creditLimitAvailable: 0,
        remainingBalance: 0,
        effectiveOutstandingPolicy: 'NONE',
      })
    );
    expect(items).not.toContain('b2b.creditExceeded');
  });

  it('does not apply credit control when the customer has no credit limit', () => {
    const items = derivePaymentValidationItems(
      baseCtx({
        creditLimitValue: 0,
        creditLimitAvailable: 0,
        remainingBalance: 500,
        effectiveOutstandingPolicy: 'CREDIT_INVOICE',
      })
    );
    expect(items).not.toContain('b2b.creditExceeded');
  });

  it('emits one message per terminal-required leg', () => {
    const items = derivePaymentValidationItems(
      baseCtx({
        terminalRequiredLegs: [{ leg: leg({ method: 'CARD' }) }, { leg: leg({ method: 'CARD' }) }],
      })
    );
    expect(items.filter((m) => m === 'splitPayment.validation.terminalRequired')).toHaveLength(1);
  });

  it('dedupes repeated identical messages', () => {
    const items = derivePaymentValidationItems(
      baseCtx({
        creditNoteLegsMissingReference: [
          { leg: leg({ method: 'CREDIT_NOTE' }) },
          { leg: leg({ method: 'CREDIT_NOTE' }) },
        ],
      })
    );
    expect(items.filter((m) => m === 'customerCredits.creditNoteRequired')).toHaveLength(1);
  });
});
