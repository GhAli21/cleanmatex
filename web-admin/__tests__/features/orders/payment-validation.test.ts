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
    creditLimitWouldExceed: false,
    creditLimitMode: undefined,
    creditLimitOverride: false,
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

  it('honors credit-limit warn vs block modes only when billing to account with remainder', () => {
    expect(
      derivePaymentValidationItems(
        baseCtx({
          creditLimitWouldExceed: true,
          creditLimitMode: 'warn',
          creditLimitOverride: false,
          remainingBalance: 10,
          effectiveOutstandingPolicy: 'CREDIT_INVOICE',
        })
      )
    ).toContain('b2b.creditExceededWarn');
    expect(
      derivePaymentValidationItems(
        baseCtx({
          creditLimitWouldExceed: true,
          creditLimitMode: 'warn',
          creditLimitOverride: true,
          remainingBalance: 10,
          effectiveOutstandingPolicy: 'CREDIT_INVOICE',
        })
      )
    ).not.toContain('b2b.creditExceededWarn');
    expect(
      derivePaymentValidationItems(
        baseCtx({
          creditLimitWouldExceed: true,
          creditLimitMode: 'block',
          remainingBalance: 10,
          effectiveOutstandingPolicy: 'CREDIT_INVOICE',
        })
      )
    ).toContain('b2b.creditExceeded');
  });

  it('does not block on credit limit when the order is fully settled (cash/card)', () => {
    const items = derivePaymentValidationItems(
      baseCtx({
        creditLimitWouldExceed: true,
        creditLimitMode: 'block',
        remainingBalance: 0,
        effectiveOutstandingPolicy: 'NONE',
      })
    );
    expect(items).not.toContain('b2b.creditExceeded');
    expect(items).not.toContain('b2b.creditExceededWarn');
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
