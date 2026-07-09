/**
 * Engine → CapabilityContext projector (L1 → L3 bridge, pure).
 *
 * The container holds the live `usePaymentEngine` return; the registry consumes a
 * pure {@link CapabilityContext}. This projector is the single, tested translation
 * between them. It encodes the *rules* that turn engine/catalog/permission terms
 * into the registry's fact vocabulary — method-code classification, the
 * gift/promo kill-flag fold, the precise CREDIT_INVOICE policy check, and the
 * FX-rate → rounding fact — while genuinely container-derived facts
 * (`b2bRequiredFieldsMissing`, `payLaterAvailable`, `customerCreditAvailable`)
 * arrive as explicit, documented inputs it never guesses.
 *
 * No money math, no validation, no payload. Each source field names where the
 * container reads it from, so the wiring step (Phase 4d+) is mechanical.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { OutstandingPolicy } from '@/lib/validations/new-order-payment-schemas';
import {
  createCapabilityContext,
  type CapabilityContext,
} from './capability-context';

/**
 * Card-family settlement method codes — the tenders the registry treats as a
 * "card" for the CARD and CASH_CARD_SPLIT capabilities (card + gateway rails,
 * excluding cash). Kept local to the payment module (which will move to a
 * top-level module later); codes mirror the DB `PAYMENT_METHODS` — never reformat.
 */
const CARD_FAMILY_METHOD_CODES: readonly string[] = [
  PAYMENT_METHODS.CARD,
  PAYMENT_METHODS.MOBILE_PAYMENT,
  PAYMENT_METHODS.PAYMENT_GATEWAY,
  PAYMENT_METHODS.HYPERPAY,
  PAYMENT_METHODS.PAYTABS,
  PAYMENT_METHODS.STRIPE,
];

/**
 * The engine/catalog/permission-native inputs the projector reads. Every field
 * documents the exact container source, so the wiring is a direct hand-off from
 * the destructured `usePaymentEngine` return.
 */
export interface CapabilityContextSource {
  /**
   * Feature kill-flag `NEW_ORDER_PROMO_GIFT_DISABLED` — gift-card AND promo are
   * both gated by it (engine handlers early-return under it). Folded into
   * `giftCardSupported`/`promoSupported`.
   */
  promoGiftDisabled: boolean;
  /**
   * Settlement method codes offered by the checkout catalog this session
   * (`catalog.realPaymentOptions[*].payment_method_code`). Drives
   * `hasCashMethod`/`hasCardMethod`/`availableMethodCount`.
   */
  availableMethodCodes: string[];
  /** Customer is a B2B account (`isB2BCustomer` prop). */
  isB2BCustomer: boolean;
  /** Engine's effective outstanding policy (`engine.effectiveOutstandingPolicy`). */
  effectiveOutstandingPolicy: OutstandingPolicy;
  /**
   * Customer has stored-value/advance balance available to apply
   * (`engine.walletHasAvailableBalance` OR a credit option with balance).
   * Container-derived.
   */
  customerCreditAvailable: boolean;
  /** Current user holds `orders:apply_credit` (client `hasPermission`). */
  canApplyCustomerCredit: boolean;
  /**
   * Required B2B contract/accounting fields are missing for a credit-invoice
   * order. Container-derived from the watched B2B fields at wiring time — the
   * projector does not define which fields are required.
   */
  b2bRequiredFieldsMissing: boolean;
  /**
   * The balance-policy (pay-later) section applies this session
   * (`showBalancePolicySection` = section-id BALANCE_POLICY visible).
   * Container-derived.
   */
  payLaterAvailable: boolean;
  /** Count of settlement legs with a positive amount (`settlementLegEntries.length`). */
  settlementLegCount: number;
  /** A customer advance/stored-credit leg is applied (`customerCreditEntries.length > 0`). */
  customerCreditApplied: boolean;
  /** A gift card is applied (`!!appliedGiftCard`). */
  giftCardApplied: boolean;
  /** A promo code is applied (`!!appliedPromoCode`). */
  promoApplied: boolean;
  /** Gift-card PIN required and unsatisfied (`giftPromo.pinRequired`). */
  giftCardPinRequired: boolean;
  /** An overpayment still needs routing (`engine.overpaymentNeedsResolution`). */
  overpaymentNeedsResolution: boolean;
  /** Session requires a cash-drawer binding (`engine.cashDrawerRequired`). */
  cashDrawerRequired: boolean;
  /** Number of open drawer sessions the cashier may choose (`cashDrawerSessionChoices.length`). */
  cashDrawerSessionChoiceCount: number;
  /** A cash-drawer blocking condition is present (`!!cashDrawerBlockingMessage`). */
  cashDrawerBlocked: boolean;
  /** Currency exchange rate in effect (`currencyConfig.currencyExRate`); ≠ 1 ⇒ FX/rounding shown. */
  currencyExRate: number | null | undefined;
  /** Engine validation reports blocking issues (`engine.submitHasBlockingIssues`). */
  submitHasBlockingIssues: boolean;
}

/**
 * Projects the engine-native source into the pure {@link CapabilityContext} the
 * registry classifies against.
 *
 * Divergence note: the registry's `isB2BCreditInvoice` is the *precise*
 * `effectiveOutstandingPolicy === 'CREDIT_INVOICE'`, NOT the engine's
 * `needsAdvanced` OR-fold (`isB2BCustomer || policy === 'CREDIT_INVOICE'`). The
 * OR-fold would wrongly trip the required B2B account-billing gate for a B2B
 * customer paying now. The two are reconciled when Phase 5 wires the demoted
 * suggestion through the registry.
 *
 * @param src - Engine/catalog/permission-native facts.
 * @returns The complete capability context.
 */
export function projectCapabilityContext(
  src: CapabilityContextSource,
): CapabilityContext {
  const codes = new Set(src.availableMethodCodes);
  const giftPromoSupported = !src.promoGiftDisabled;

  return createCapabilityContext({
    hasCashMethod: codes.has(PAYMENT_METHODS.CASH),
    hasCardMethod: CARD_FAMILY_METHOD_CODES.some((code) => codes.has(code)),
    availableMethodCount: codes.size,
    giftCardSupported: giftPromoSupported,
    promoSupported: giftPromoSupported,
    payLaterAvailable: src.payLaterAvailable,
    isB2BCustomer: src.isB2BCustomer,
    isB2BCreditInvoice: src.effectiveOutstandingPolicy === 'CREDIT_INVOICE',
    customerCreditAvailable: src.customerCreditAvailable,
    canApplyCustomerCredit: src.canApplyCustomerCredit,
    b2bRequiredFieldsMissing: src.b2bRequiredFieldsMissing,
    settlementLegCount: src.settlementLegCount,
    customerCreditApplied: src.customerCreditApplied,
    giftCardApplied: src.giftCardApplied,
    promoApplied: src.promoApplied,
    giftCardPinRequired: src.giftCardPinRequired,
    overpaymentNeedsResolution: src.overpaymentNeedsResolution,
    cashDrawerRequired: src.cashDrawerRequired,
    cashDrawerSessionChoiceCount: src.cashDrawerSessionChoiceCount,
    cashDrawerBlocked: src.cashDrawerBlocked,
    showCurrencyRounding: (src.currencyExRate ?? 1) !== 1,
    submitHasBlockingIssues: src.submitHasBlockingIssues,
  });
}
