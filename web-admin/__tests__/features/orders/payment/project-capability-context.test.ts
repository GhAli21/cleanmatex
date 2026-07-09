import {
  projectCapabilityContext,
  type CapabilityContextSource,
} from '@features/orders/payment/domain/project-capability-context';
import {
  evaluateCapability,
} from '@features/orders/payment/capabilities/registry';
import { DEFAULT_PAYMENT_MODAL_CONFIG } from '@features/orders/payment/config/payment-modal-config';
import { PAYMENT_CAPABILITY } from '@features/orders/payment/capabilities/capability-keys';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';

/** A neutral single-method cash session; tests override only what differs. */
function source(
  overrides: Partial<CapabilityContextSource> = {},
): CapabilityContextSource {
  return {
    promoGiftDisabled: false,
    availableMethodCodes: [PAYMENT_METHODS.CASH],
    isB2BCustomer: false,
    effectiveOutstandingPolicy: 'NONE',
    customerCreditAvailable: false,
    canApplyCustomerCredit: false,
    b2bRequiredFieldsMissing: false,
    payLaterAvailable: false,
    settlementLegCount: 1,
    customerCreditApplied: false,
    giftCardApplied: false,
    promoApplied: false,
    giftCardPinRequired: false,
    overpaymentNeedsResolution: false,
    cashDrawerRequired: false,
    cashDrawerSessionChoiceCount: 0,
    cashDrawerBlocked: false,
    currencyExRate: 1,
    submitHasBlockingIssues: false,
    ...overrides,
  };
}

describe('projectCapabilityContext (translation rules)', () => {
  it('classifies cash vs card-family method codes and counts them', () => {
    const ctx = projectCapabilityContext(
      source({
        availableMethodCodes: [PAYMENT_METHODS.CASH, PAYMENT_METHODS.CARD, PAYMENT_METHODS.STRIPE],
      }),
    );
    expect(ctx.hasCashMethod).toBe(true);
    expect(ctx.hasCardMethod).toBe(true);
    expect(ctx.availableMethodCount).toBe(3);
  });

  it('treats a cash-only catalog as no card method', () => {
    const ctx = projectCapabilityContext(source({ availableMethodCodes: [PAYMENT_METHODS.CASH] }));
    expect(ctx.hasCashMethod).toBe(true);
    expect(ctx.hasCardMethod).toBe(false);
    expect(ctx.availableMethodCount).toBe(1);
  });

  it('folds the promo/gift kill-flag into both giftCardSupported and promoSupported', () => {
    expect(projectCapabilityContext(source({ promoGiftDisabled: false })).giftCardSupported).toBe(true);
    const disabled = projectCapabilityContext(source({ promoGiftDisabled: true }));
    expect(disabled.giftCardSupported).toBe(false);
    expect(disabled.promoSupported).toBe(false);
  });

  it('maps isB2BCreditInvoice to the precise CREDIT_INVOICE policy (not the needsAdvanced OR-fold)', () => {
    // A B2B customer paying now (policy NONE) must NOT be a credit invoice.
    const payNow = projectCapabilityContext(
      source({ isB2BCustomer: true, effectiveOutstandingPolicy: 'NONE' }),
    );
    expect(payNow.isB2BCustomer).toBe(true);
    expect(payNow.isB2BCreditInvoice).toBe(false);

    const invoice = projectCapabilityContext(
      source({ isB2BCustomer: true, effectiveOutstandingPolicy: 'CREDIT_INVOICE' }),
    );
    expect(invoice.isB2BCreditInvoice).toBe(true);
  });

  it('derives showCurrencyRounding from a non-unit FX rate (null → false)', () => {
    expect(projectCapabilityContext(source({ currencyExRate: 1 })).showCurrencyRounding).toBe(false);
    expect(projectCapabilityContext(source({ currencyExRate: 3.75 })).showCurrencyRounding).toBe(true);
    expect(projectCapabilityContext(source({ currencyExRate: null })).showCurrencyRounding).toBe(false);
  });

  it('passes container-derived facts through unchanged', () => {
    const ctx = projectCapabilityContext(
      source({
        payLaterAvailable: true,
        b2bRequiredFieldsMissing: true,
        customerCreditAvailable: true,
        canApplyCustomerCredit: true,
        cashDrawerSessionChoiceCount: 2,
        cashDrawerBlocked: true,
        overpaymentNeedsResolution: true,
        submitHasBlockingIssues: true,
      }),
    );
    expect(ctx.payLaterAvailable).toBe(true);
    expect(ctx.b2bRequiredFieldsMissing).toBe(true);
    expect(ctx.customerCreditAvailable).toBe(true);
    expect(ctx.canApplyCustomerCredit).toBe(true);
    expect(ctx.cashDrawerSessionChoiceCount).toBe(2);
    expect(ctx.cashDrawerBlocked).toBe(true);
    expect(ctx.overpaymentNeedsResolution).toBe(true);
    expect(ctx.submitHasBlockingIssues).toBe(true);
  });
});

describe('projectCapabilityContext → registry (end-to-end classification)', () => {
  const config = DEFAULT_PAYMENT_MODAL_CONFIG;

  it('SPLIT_TENDER is available with two catalog methods, hidden with one', () => {
    const two = projectCapabilityContext(
      source({ availableMethodCodes: [PAYMENT_METHODS.CASH, PAYMENT_METHODS.CARD] }),
    );
    expect(evaluateCapability(PAYMENT_CAPABILITY.SPLIT_TENDER, two, config).available).toBe(true);

    const one = projectCapabilityContext(source({ availableMethodCodes: [PAYMENT_METHODS.CASH] }));
    expect(evaluateCapability(PAYMENT_CAPABILITY.SPLIT_TENDER, one, config).available).toBe(false);
  });

  it('GIFT_CARD is unavailable when the kill-flag is set', () => {
    const ctx = projectCapabilityContext(source({ promoGiftDisabled: true, giftCardApplied: true }));
    const evaluated = evaluateCapability(PAYMENT_CAPABILITY.GIFT_CARD, ctx, config);
    expect(evaluated.available).toBe(false);
    expect(evaluated.presentation).toBe('hidden');
  });

  it('B2B account-billing is required+blocked only for a credit invoice with missing fields', () => {
    const gated = projectCapabilityContext(
      source({
        isB2BCustomer: true,
        effectiveOutstandingPolicy: 'CREDIT_INVOICE',
        b2bRequiredFieldsMissing: true,
      }),
    );
    const gatedEval = evaluateCapability(PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING, gated, config);
    expect(gatedEval.required).toBe(true);
    expect(gatedEval.blocked).toBe(true);

    // Same B2B customer paying now (policy NONE) → available but not required/blocked.
    const payNow = projectCapabilityContext(
      source({ isB2BCustomer: true, effectiveOutstandingPolicy: 'NONE', b2bRequiredFieldsMissing: true }),
    );
    const payNowEval = evaluateCapability(PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING, payNow, config);
    expect(payNowEval.available).toBe(true);
    expect(payNowEval.required).toBe(false);
    expect(payNowEval.blocked).toBe(false);
  });

  it('OVERPAYMENT_ROUTING is required+blocked when an overpayment needs routing', () => {
    const ctx = projectCapabilityContext(source({ overpaymentNeedsResolution: true }));
    const evaluated = evaluateCapability(PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING, ctx, config);
    expect(evaluated.required).toBe(true);
    expect(evaluated.blocked).toBe(true);
  });
});
