/**
 * Payment capability registry (L3 of the composable payment system) — the
 * single decision point for what each capability is in a given session:
 * available / required / blocked / presentation, each with reason codes.
 *
 * The registry is a **classifier, not a second engine**: every rule reads
 * already-derived facts from {@link CapabilityContext} and returns
 * classifications. It never computes money, never validates, never touches the
 * submit payload (locked program decision). Views/presets render what the
 * registry says; dialogs act through typed engine actions.
 *
 * Config (`PaymentModalConfig.capabilityOverrides`) applies LAST as a coarse
 * presentation override (hidden / inline / dialog) — future DB/plan/role config
 * flows through that seam without touching these rules.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import type { PaymentModalConfig } from '../config/payment-modal-config';
import type { CapabilityContext } from '../domain/capability-context';
import {
  PAYMENT_REASON,
  type PaymentReasonCode,
} from '../domain/payment-reasons';
import {
  PAYMENT_CAPABILITY,
  PAYMENT_CAPABILITY_KEYS,
  type PaymentCapabilityKey,
} from './capability-keys';

/**
 * How a capability surfaces in the active view.
 * - `inline`: rendered directly in the view (method chip, drawer selector, FX line).
 * - `dialog`: rendered as a button that opens the capability's dialog.
 * - `hidden`: not rendered (unavailable or config-hidden).
 */
export type CapabilityPresentation = 'inline' | 'dialog' | 'hidden';

/**
 * Block classification for a capability (e.g. drawer blocked → submit guard).
 */
export interface CapabilityBlock {
  blocked: boolean;
  reason?: PaymentReasonCode;
}

/**
 * Declarative descriptor for one capability. Pure rules over facts only.
 */
export interface PaymentCapability {
  key: PaymentCapabilityKey;
  /** i18n key roots (namespace `newOrder`), resolved by the consuming UI. */
  messageKeys: { title: string; action: string };
  /** Whether the capability can be used/offered in this session. */
  isAvailable(ctx: CapabilityContext): boolean;
  /** Whether the capability MUST be resolved before submit. */
  isRequired(ctx: CapabilityContext): boolean;
  /** Whether the capability currently blocks submit. */
  isBlocked(ctx: CapabilityContext): CapabilityBlock;
  /** Rule presentation (before config override). */
  presentation(ctx: CapabilityContext): CapabilityPresentation;
  /** Why the capability is shown/required in this session (explainability). */
  activeReasons(ctx: CapabilityContext): PaymentReasonCode[];
}

const NOT_BLOCKED: CapabilityBlock = { blocked: false };

function messageKeysFor(key: PaymentCapabilityKey): PaymentCapability['messageKeys'] {
  return {
    title: `payment.capabilities.${key}.title`,
    action: `payment.capabilities.${key}.action`,
  };
}

/**
 * The declarative capability registry. Order is stable render order for
 * inline surfaces.
 */
export const PAYMENT_CAPABILITIES: Record<PaymentCapabilityKey, PaymentCapability> = {
  [PAYMENT_CAPABILITY.CASH]: {
    key: PAYMENT_CAPABILITY.CASH,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.CASH),
    isAvailable: (ctx) => ctx.hasCashMethod,
    isRequired: () => false,
    isBlocked: () => NOT_BLOCKED,
    presentation: () => 'inline',
    activeReasons: () => [],
  },

  [PAYMENT_CAPABILITY.CARD]: {
    key: PAYMENT_CAPABILITY.CARD,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.CARD),
    isAvailable: (ctx) => ctx.hasCardMethod,
    isRequired: () => false,
    isBlocked: () => NOT_BLOCKED,
    presentation: () => 'inline',
    activeReasons: () => [],
  },

  [PAYMENT_CAPABILITY.CASH_CARD_SPLIT]: {
    key: PAYMENT_CAPABILITY.CASH_CARD_SPLIT,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.CASH_CARD_SPLIT),
    // The common "cash AND card" shortcut needs both methods offered.
    isAvailable: (ctx) => ctx.hasCashMethod && ctx.hasCardMethod,
    isRequired: () => false,
    isBlocked: () => NOT_BLOCKED,
    presentation: () => 'dialog',
    activeReasons: (ctx) =>
      ctx.settlementLegCount > 1 ? [PAYMENT_REASON.SHOWN_SPLIT_ACTIVE] : [],
  },

  [PAYMENT_CAPABILITY.SPLIT_TENDER]: {
    key: PAYMENT_CAPABILITY.SPLIT_TENDER,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.SPLIT_TENDER),
    // General N-leg split needs at least two selectable methods.
    isAvailable: (ctx) => ctx.availableMethodCount >= 2,
    isRequired: () => false,
    isBlocked: () => NOT_BLOCKED,
    presentation: () => 'dialog',
    activeReasons: (ctx) =>
      ctx.settlementLegCount > 1 ? [PAYMENT_REASON.SHOWN_SPLIT_ACTIVE] : [],
  },

  [PAYMENT_CAPABILITY.GIFT_CARD]: {
    key: PAYMENT_CAPABILITY.GIFT_CARD,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.GIFT_CARD),
    isAvailable: (ctx) => ctx.giftCardSupported,
    // PIN entry is a field INSIDE this capability's dialog (ADR: former
    // condition #6 is not a mode reason) — required until satisfied.
    isRequired: (ctx) => ctx.giftCardApplied && ctx.giftCardPinRequired,
    isBlocked: () => NOT_BLOCKED,
    presentation: () => 'dialog',
    activeReasons: (ctx) => [
      ...(ctx.giftCardApplied ? [PAYMENT_REASON.SHOWN_GIFT_CARD_DETECTED] : []),
      ...(ctx.giftCardApplied && ctx.giftCardPinRequired
        ? [PAYMENT_REASON.REQUIRED_GIFT_CARD_PIN]
        : []),
    ],
  },

  [PAYMENT_CAPABILITY.PROMO_CODE]: {
    key: PAYMENT_CAPABILITY.PROMO_CODE,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.PROMO_CODE),
    isAvailable: (ctx) => ctx.promoSupported,
    isRequired: () => false,
    isBlocked: () => NOT_BLOCKED,
    presentation: () => 'dialog',
    activeReasons: (ctx) =>
      ctx.promoApplied ? [PAYMENT_REASON.SHOWN_PROMO_DETECTED] : [],
  },

  [PAYMENT_CAPABILITY.CUSTOMER_CREDIT]: {
    key: PAYMENT_CAPABILITY.CUSTOMER_CREDIT,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.CUSTOMER_CREDIT),
    // Offered only when the customer has balance AND the user may apply it
    // (permission fact; server still enforces `orders:apply_credit`).
    isAvailable: (ctx) =>
      ctx.customerCreditAvailable && ctx.canApplyCustomerCredit,
    isRequired: () => false,
    isBlocked: () => NOT_BLOCKED,
    presentation: () => 'dialog',
    activeReasons: (ctx) =>
      ctx.customerCreditAvailable
        ? [PAYMENT_REASON.SHOWN_CUSTOMER_CREDIT_AVAILABLE]
        : [],
  },

  [PAYMENT_CAPABILITY.PAY_LATER]: {
    key: PAYMENT_CAPABILITY.PAY_LATER,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.PAY_LATER),
    isAvailable: (ctx) => ctx.payLaterAvailable,
    isRequired: () => false,
    isBlocked: () => NOT_BLOCKED,
    presentation: () => 'dialog',
    activeReasons: () => [],
  },

  [PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING]: {
    key: PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING),
    isAvailable: (ctx) => ctx.isB2BCustomer,
    // ADR: B2B pay-now finishes in Simple; account billing requires the
    // contract/accounting fields BEFORE submit when any are missing.
    isRequired: (ctx) => ctx.isB2BCreditInvoice && ctx.b2bRequiredFieldsMissing,
    isBlocked: (ctx) =>
      ctx.isB2BCreditInvoice && ctx.b2bRequiredFieldsMissing
        ? { blocked: true, reason: PAYMENT_REASON.REQUIRED_B2B_FIELDS_MISSING }
        : NOT_BLOCKED,
    presentation: () => 'dialog',
    activeReasons: (ctx) =>
      ctx.isB2BCreditInvoice && ctx.b2bRequiredFieldsMissing
        ? [PAYMENT_REASON.REQUIRED_B2B_FIELDS_MISSING]
        : [],
  },

  [PAYMENT_CAPABILITY.CASH_DRAWER]: {
    key: PAYMENT_CAPABILITY.CASH_DRAWER,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.CASH_DRAWER),
    isAvailable: (ctx) => ctx.cashDrawerRequired,
    // Ambiguity (>1 open session) is a pick-one prompt, not a mode change
    // (ADR: former condition #7).
    isRequired: (ctx) =>
      ctx.cashDrawerRequired && ctx.cashDrawerSessionChoiceCount > 1,
    // A blocked drawer is an error guard, not complexity (ADR: former #8) —
    // switching views cannot unblock it, so it blocks submit in place.
    isBlocked: (ctx) =>
      ctx.cashDrawerBlocked
        ? { blocked: true, reason: PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED }
        : NOT_BLOCKED,
    presentation: () => 'inline',
    activeReasons: (ctx) => [
      ...(ctx.cashDrawerRequired && ctx.cashDrawerSessionChoiceCount > 1
        ? [PAYMENT_REASON.CASH_DRAWER_SESSION_SELECTION_REQUIRED]
        : []),
      ...(ctx.cashDrawerBlocked
        ? [PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED]
        : []),
    ],
  },

  [PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING]: {
    key: PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING),
    isAvailable: (ctx) => ctx.overpaymentNeedsResolution,
    isRequired: (ctx) => ctx.overpaymentNeedsResolution,
    isBlocked: (ctx) =>
      ctx.overpaymentNeedsResolution
        ? {
            blocked: true,
            reason: PAYMENT_REASON.OVERPAYMENT_RESOLUTION_REQUIRED,
          }
        : NOT_BLOCKED,
    presentation: () => 'dialog',
    activeReasons: (ctx) =>
      ctx.overpaymentNeedsResolution
        ? [PAYMENT_REASON.OVERPAYMENT_RESOLUTION_REQUIRED]
        : [],
  },

  [PAYMENT_CAPABILITY.FX_ROUNDING]: {
    key: PAYMENT_CAPABILITY.FX_ROUNDING,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.FX_ROUNDING),
    isAvailable: (ctx) => ctx.showCurrencyRounding,
    isRequired: () => false,
    isBlocked: () => NOT_BLOCKED,
    // Read-only display line (ADR: former condition #9); manual FX edit is a
    // deferred restricted action (needs its own permission — not this phase).
    presentation: () => 'inline',
    activeReasons: (ctx) =>
      ctx.showCurrencyRounding ? [PAYMENT_REASON.SHOWN_FX_ROUNDING_ACTIVE] : [],
  },

  [PAYMENT_CAPABILITY.SUBMIT_GUARDS]: {
    key: PAYMENT_CAPABILITY.SUBMIT_GUARDS,
    messageKeys: messageKeysFor(PAYMENT_CAPABILITY.SUBMIT_GUARDS),
    isAvailable: () => true,
    isRequired: () => false,
    // Aggregate guard surface: any engine blocking issue disables submit in
    // place with a reason — never a view switch.
    isBlocked: (ctx) =>
      ctx.cashDrawerBlocked
        ? { blocked: true, reason: PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED }
        : ctx.submitHasBlockingIssues
          ? { blocked: true, reason: PAYMENT_REASON.OUTSTANDING_POLICY_REQUIRED }
          : NOT_BLOCKED,
    presentation: () => 'inline',
    activeReasons: (ctx) =>
      ctx.cashDrawerBlocked ? [PAYMENT_REASON.CASH_DRAWER_SESSION_CLOSED] : [],
  },
};

/**
 * Evaluated state of one capability for a session.
 */
export interface EvaluatedCapability {
  key: PaymentCapabilityKey;
  available: boolean;
  required: boolean;
  blocked: boolean;
  blockReason?: PaymentReasonCode;
  presentation: CapabilityPresentation;
  reasons: PaymentReasonCode[];
  messageKeys: PaymentCapability['messageKeys'];
}

/**
 * Classifies one capability against the session facts and config.
 * Unavailable ⇒ hidden. Config override (hidden/inline/dialog) applies last.
 *
 * @param key - Capability to evaluate.
 * @param ctx - Session facts.
 * @param config - Effective modal config (overrides seam).
 * @returns The evaluated capability state.
 */
export function evaluateCapability(
  key: PaymentCapabilityKey,
  ctx: CapabilityContext,
  config: PaymentModalConfig,
): EvaluatedCapability {
  const capability = PAYMENT_CAPABILITIES[key];
  const available = capability.isAvailable(ctx);
  const block = available ? capability.isBlocked(ctx) : NOT_BLOCKED;
  const override = config.capabilityOverrides[key];

  let presentation: CapabilityPresentation = available
    ? capability.presentation(ctx)
    : 'hidden';
  if (available && override) presentation = override;

  return {
    key,
    available,
    required: available ? capability.isRequired(ctx) : false,
    blocked: block.blocked,
    blockReason: block.reason,
    presentation,
    reasons: available ? capability.activeReasons(ctx) : [],
    messageKeys: capability.messageKeys,
  };
}

/**
 * Classifies all capabilities for a session, in stable registry order.
 *
 * @param ctx - Session facts.
 * @param config - Effective modal config.
 * @returns Evaluated states for every capability key.
 */
export function evaluateCapabilities(
  ctx: CapabilityContext,
  config: PaymentModalConfig,
): EvaluatedCapability[] {
  return PAYMENT_CAPABILITY_KEYS.map((key) => evaluateCapability(key, ctx, config));
}
