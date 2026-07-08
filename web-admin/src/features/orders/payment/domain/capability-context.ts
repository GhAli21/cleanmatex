/**
 * CapabilityContext — the pure fact projection the capability registry
 * classifies against (L3 input of the composable payment system).
 *
 * Every field is an already-derived engine/catalog/permission FACT (boolean or
 * count). This module performs **no financial calculation, no validation, and
 * no payload logic** — those live in the engine (L1). The container projects
 * the live engine into this shape; tests build it directly via
 * {@link createCapabilityContext}.
 *
 * The nine legacy `computeNeedsAdvanced` inputs are all representable here —
 * {@link toNeedsAdvancedInput} adapts this context into that predicate's input
 * so the demoted suggestion and the registry classify from the SAME facts and
 * can never disagree.
 */

import type { NeedsAdvancedInput } from '@features/orders/hooks/payment-needs-advanced';

/**
 * Pure facts describing one payment session, used to classify capability
 * availability / requirement / blockage / presentation.
 */
export interface CapabilityContext {
  // ---- catalog facts (already reflect tenant settings / flags / plan) ----
  /** A cash settlement method is offered by the checkout catalog. */
  hasCashMethod: boolean;
  /** A card settlement method is offered by the checkout catalog. */
  hasCardMethod: boolean;
  /** Count of selectable settlement methods for this session. */
  availableMethodCount: number;
  /** Gift-card redemption is supported for this tenant/session. */
  giftCardSupported: boolean;
  /** Promo codes are supported for this tenant/session. */
  promoSupported: boolean;
  /** A deferred / pay-later settlement option exists for this customer. */
  payLaterAvailable: boolean;

  // ---- customer facts ----
  /** Customer is a B2B account. */
  isB2BCustomer: boolean;
  /** Session resolves to a CREDIT_INVOICE outstanding policy (B2B AR). */
  isB2BCreditInvoice: boolean;
  /** Customer has stored credit / advance balance available to apply. */
  customerCreditAvailable: boolean;
  /** Current user holds the permission to apply customer credit. */
  canApplyCustomerCredit: boolean;
  /** Required B2B contract/accounting fields are missing (PO, cost center…). */
  b2bRequiredFieldsMissing: boolean;

  // ---- leg / applied-instrument facts ----
  /** Count of settlement legs with a positive amount. >1 means a split. */
  settlementLegCount: number;
  /** A customer advance / stored-credit leg is applied. */
  customerCreditApplied: boolean;
  /** A gift card is applied to this session. */
  giftCardApplied: boolean;
  /** A promo code is applied to this session. */
  promoApplied: boolean;
  /** A gift-card PIN is required and not yet satisfied. */
  giftCardPinRequired: boolean;

  // ---- overpayment ----
  /** An overpayment still needs routing before submit. */
  overpaymentNeedsResolution: boolean;

  // ---- cash drawer ----
  /** This session requires a cash-drawer binding (cash leg present). */
  cashDrawerRequired: boolean;
  /** Number of open drawer sessions the cashier may choose from. */
  cashDrawerSessionChoiceCount: number;
  /** A cash-drawer blocking condition is present. */
  cashDrawerBlocked: boolean;

  // ---- FX / rounding ----
  /** FX (rate ≠ 1) or non-zero rounding is active (display fact). */
  showCurrencyRounding: boolean;

  // ---- submit ----
  /** Engine validation currently reports blocking issues. */
  submitHasBlockingIssues: boolean;
}

/**
 * Neutral defaults: a plain single-method cash session with nothing applied.
 * Tests and projections override only what differs.
 */
export const EMPTY_CAPABILITY_CONTEXT: CapabilityContext = {
  hasCashMethod: true,
  hasCardMethod: false,
  availableMethodCount: 1,
  giftCardSupported: false,
  promoSupported: false,
  payLaterAvailable: false,
  isB2BCustomer: false,
  isB2BCreditInvoice: false,
  customerCreditAvailable: false,
  canApplyCustomerCredit: false,
  b2bRequiredFieldsMissing: false,
  settlementLegCount: 1,
  customerCreditApplied: false,
  giftCardApplied: false,
  promoApplied: false,
  giftCardPinRequired: false,
  overpaymentNeedsResolution: false,
  cashDrawerRequired: false,
  cashDrawerSessionChoiceCount: 0,
  cashDrawerBlocked: false,
  showCurrencyRounding: false,
  submitHasBlockingIssues: false,
};

/**
 * Builds a {@link CapabilityContext} from partial facts over neutral defaults.
 *
 * @param partial - Facts that differ from {@link EMPTY_CAPABILITY_CONTEXT}.
 * @returns A complete context.
 */
export function createCapabilityContext(
  partial: Partial<CapabilityContext> = {},
): CapabilityContext {
  return { ...EMPTY_CAPABILITY_CONTEXT, ...partial };
}

/**
 * Adapts this context into the retained `computeNeedsAdvanced` predicate input,
 * so the demoted Full-view suggestion classifies from the same facts as the
 * capability registry.
 *
 * @param ctx - The capability context.
 * @returns The predicate's input shape.
 */
export function toNeedsAdvancedInput(ctx: CapabilityContext): NeedsAdvancedInput {
  return {
    settlementLegCount: ctx.settlementLegCount,
    hasCustomerCreditApplied: ctx.customerCreditApplied,
    isB2BCreditInvoice: ctx.isB2BCreditInvoice,
    hasGiftCardOrPromo: ctx.giftCardApplied || ctx.promoApplied,
    overpaymentNeedsResolution: ctx.overpaymentNeedsResolution,
    pinRequired: ctx.giftCardPinRequired,
    cashDrawerSessionChoiceCount: ctx.cashDrawerSessionChoiceCount,
    cashDrawerBlocked: ctx.cashDrawerBlocked,
    showCurrencyRounding: ctx.showCurrencyRounding,
  };
}
