/**
 * Phase 1 — capability registry classification tests. Pins the amended ADR's
 * condition→handling table as pure registry behavior: routine complications are
 * dialogs/inline prompts, drawer-blocked is a submit guard, B2B account-billing
 * with missing fields is a required gate, and nothing here ever computes money.
 */

import {
  PAYMENT_CAPABILITY,
  PAYMENT_CAPABILITY_KEYS,
} from '@features/orders/payment/capabilities/capability-keys';
import {
  evaluateCapabilities,
  evaluateCapability,
} from '@features/orders/payment/capabilities/registry';
import { DEFAULT_PAYMENT_MODAL_CONFIG } from '@features/orders/payment/config/payment-modal-config';
import type { PaymentModalConfig } from '@features/orders/payment/config/payment-modal-config';
import {
  createCapabilityContext,
  toNeedsAdvancedInput,
} from '@features/orders/payment/domain/capability-context';
import {
  needsAdvancedToSuggestion,
  PAYMENT_REASON,
  SERVER_ERROR_TO_REASON,
} from '@features/orders/payment/domain/payment-reasons';
import { computeNeedsAdvanced } from '@features/orders/hooks/payment-needs-advanced';

const config = DEFAULT_PAYMENT_MODAL_CONFIG;

describe('capability registry (Phase 1)', () => {
  it('evaluates every declared capability key', () => {
    const results = evaluateCapabilities(createCapabilityContext(), config);
    expect(results.map((r) => r.key)).toEqual(PAYMENT_CAPABILITY_KEYS);
  });

  it('exact-cash happy path: cash inline, complications hidden, nothing blocked', () => {
    const results = evaluateCapabilities(createCapabilityContext(), config);
    const byKey = Object.fromEntries(results.map((r) => [r.key, r]));

    expect(byKey[PAYMENT_CAPABILITY.CASH].presentation).toBe('inline');
    expect(byKey[PAYMENT_CAPABILITY.CARD].presentation).toBe('hidden');
    expect(byKey[PAYMENT_CAPABILITY.GIFT_CARD].presentation).toBe('hidden');
    expect(byKey[PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING].presentation).toBe('hidden');
    expect(results.every((r) => !r.blocked)).toBe(true);
    expect(results.every((r) => !r.required)).toBe(true);
  });

  it('split (cash AND card) is a dialog capability, never a mode (ADR #1)', () => {
    const ctx = createCapabilityContext({
      hasCardMethod: true,
      availableMethodCount: 2,
      settlementLegCount: 2,
    });
    const split = evaluateCapability(PAYMENT_CAPABILITY.CASH_CARD_SPLIT, ctx, config);
    expect(split.available).toBe(true);
    expect(split.presentation).toBe('dialog');
    expect(split.reasons).toContain(PAYMENT_REASON.SHOWN_SPLIT_ACTIVE);
    expect(split.blocked).toBe(false);
  });

  it('gift-card PIN is required INSIDE the gift-card capability, not a mode (ADR #6)', () => {
    const ctx = createCapabilityContext({
      giftCardSupported: true,
      giftCardApplied: true,
      giftCardPinRequired: true,
    });
    const gift = evaluateCapability(PAYMENT_CAPABILITY.GIFT_CARD, ctx, config);
    expect(gift.available).toBe(true);
    expect(gift.required).toBe(true);
    expect(gift.presentation).toBe('dialog');
    expect(gift.reasons).toEqual(
      expect.arrayContaining([
        PAYMENT_REASON.SHOWN_GIFT_CARD_DETECTED,
        PAYMENT_REASON.REQUIRED_GIFT_CARD_PIN,
      ]),
    );
  });

  it('customer credit needs balance AND permission (server still enforces)', () => {
    const noPermission = evaluateCapability(
      PAYMENT_CAPABILITY.CUSTOMER_CREDIT,
      createCapabilityContext({ customerCreditAvailable: true }),
      config,
    );
    expect(noPermission.available).toBe(false);
    expect(noPermission.presentation).toBe('hidden');

    const allowed = evaluateCapability(
      PAYMENT_CAPABILITY.CUSTOMER_CREDIT,
      createCapabilityContext({
        customerCreditAvailable: true,
        canApplyCustomerCredit: true,
      }),
      config,
    );
    expect(allowed.available).toBe(true);
    expect(allowed.presentation).toBe('dialog');
    expect(allowed.reasons).toContain(
      PAYMENT_REASON.SHOWN_CUSTOMER_CREDIT_AVAILABLE,
    );
  });

  it('ambiguous drawer is a pick-one prompt (required, inline), not a mode (ADR #7)', () => {
    const drawer = evaluateCapability(
      PAYMENT_CAPABILITY.CASH_DRAWER,
      createCapabilityContext({
        cashDrawerRequired: true,
        cashDrawerSessionChoiceCount: 2,
      }),
      config,
    );
    expect(drawer.available).toBe(true);
    expect(drawer.required).toBe(true);
    expect(drawer.presentation).toBe('inline');
    expect(drawer.blocked).toBe(false);
    expect(drawer.reasons).toContain(
      PAYMENT_REASON.CASH_DRAWER_SESSION_SELECTION_REQUIRED,
    );
  });

  it('blocked drawer is a submit guard with the SERVER error code as reason (ADR #8)', () => {
    const ctx = createCapabilityContext({
      cashDrawerRequired: true,
      cashDrawerSessionChoiceCount: 1,
      cashDrawerBlocked: true,
    });
    const drawer = evaluateCapability(PAYMENT_CAPABILITY.CASH_DRAWER, ctx, config);
    expect(drawer.blocked).toBe(true);
    expect(drawer.blockReason).toBe(PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED);

    const guards = evaluateCapability(PAYMENT_CAPABILITY.SUBMIT_GUARDS, ctx, config);
    expect(guards.blocked).toBe(true);
    expect(guards.blockReason).toBe(PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED);
    // Server-mirror: reason equals the backend error code string exactly.
    expect(drawer.blockReason).toBe('CASH_DRAWER_SESSION_CLOSED');
  });

  it('overpayment routing is required + blocking until resolved (ADR #5)', () => {
    const over = evaluateCapability(
      PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING,
      createCapabilityContext({ overpaymentNeedsResolution: true }),
      config,
    );
    expect(over.available).toBe(true);
    expect(over.required).toBe(true);
    expect(over.blocked).toBe(true);
    expect(over.blockReason).toBe(PAYMENT_REASON.OVERPAYMENT_RESOLUTION_REQUIRED);
    expect(over.presentation).toBe('dialog');
  });

  it('B2B pay-now stays unforced; account billing with missing fields is a required gate (ADR #3)', () => {
    const payNow = evaluateCapability(
      PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING,
      createCapabilityContext({ isB2BCustomer: true }),
      config,
    );
    expect(payNow.available).toBe(true);
    expect(payNow.required).toBe(false);
    expect(payNow.blocked).toBe(false);

    const missingFields = evaluateCapability(
      PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING,
      createCapabilityContext({
        isB2BCustomer: true,
        isB2BCreditInvoice: true,
        b2bRequiredFieldsMissing: true,
      }),
      config,
    );
    expect(missingFields.required).toBe(true);
    expect(missingFields.blocked).toBe(true);
    expect(missingFields.blockReason).toBe(
      PAYMENT_REASON.REQUIRED_B2B_FIELDS_MISSING,
    );
  });

  it('FX/rounding is a read-only inline line (ADR #9)', () => {
    const fx = evaluateCapability(
      PAYMENT_CAPABILITY.FX_ROUNDING,
      createCapabilityContext({ showCurrencyRounding: true }),
      config,
    );
    expect(fx.available).toBe(true);
    expect(fx.presentation).toBe('inline');
    expect(fx.required).toBe(false);
    expect(fx.reasons).toContain(PAYMENT_REASON.SHOWN_FX_ROUNDING_ACTIVE);
  });

  it('config overrides apply last, but never resurrect an unavailable capability', () => {
    const overridden: PaymentModalConfig = {
      ...config,
      capabilityOverrides: {
        [PAYMENT_CAPABILITY.GIFT_CARD]: 'hidden',
        [PAYMENT_CAPABILITY.CARD]: 'dialog',
      },
    };
    const giftHidden = evaluateCapability(
      PAYMENT_CAPABILITY.GIFT_CARD,
      createCapabilityContext({ giftCardSupported: true }),
      overridden,
    );
    expect(giftHidden.presentation).toBe('hidden');

    // CARD unavailable (no card method) → stays hidden even with an override.
    const cardStillHidden = evaluateCapability(
      PAYMENT_CAPABILITY.CARD,
      createCapabilityContext(),
      overridden,
    );
    expect(cardStillHidden.presentation).toBe('hidden');
    expect(cardStillHidden.available).toBe(false);
  });
});

describe('context ↔ needsAdvanced adapter (shared facts, no drift)', () => {
  it('plain cash session produces no suggestion', () => {
    const { needsAdvanced, reasons } = computeNeedsAdvanced(
      toNeedsAdvancedInput(createCapabilityContext()),
    );
    expect(needsAdvanced).toBe(false);
    expect(needsAdvancedToSuggestion(reasons)).toBeNull();
  });

  it('split + gift card produce the single demoted suggestion code', () => {
    const ctx = createCapabilityContext({
      hasCardMethod: true,
      availableMethodCount: 2,
      settlementLegCount: 2,
      giftCardSupported: true,
      giftCardApplied: true,
    });
    const { needsAdvanced, reasons } = computeNeedsAdvanced(toNeedsAdvancedInput(ctx));
    expect(needsAdvanced).toBe(true);
    expect(reasons.length).toBeGreaterThan(0);
    expect(needsAdvancedToSuggestion(reasons)).toBe(
      PAYMENT_REASON.SUGGEST_FULL_COMPLEXITY,
    );
  });
});

describe('server-mirror reason codes (DB/contract-mirror rule)', () => {
  it('every server-mirror entry maps a code to itself (exact string equality)', () => {
    for (const [serverCode, reason] of Object.entries(SERVER_ERROR_TO_REASON)) {
      expect(reason).toBe(serverCode);
    }
  });
});
