import 'server-only';

import { CREDIT_APPLICATION_TYPES, PAYMENT_NATURE } from '@/lib/constants/order-financial';
import { getAvailableStoredValueSummary, toStoredValueSummaryDto, type AvailableStoredValueSummary } from './order-credit-application.service';
import { isCheckoutPaymentMethodEligible, listEffectivePaymentMethodConfigs, type EffectivePaymentMethodConfig } from './payment-config.service';
import { resolveDefaultStatus } from './order-settlement-planner.service';

/** Request-local inputs allow the quote orchestrator to overlap independent reads. */
export interface ComposeCheckoutOptionsParams {
  /** Authenticated Organization scope; supplied facts must belong to this same tenant. */
  tenantId: string;
  branchId?: string;
  amount: number;
  customerId?: string;
  effectiveMethods?: EffectivePaymentMethodConfig[];
  /** Undefined requests a read; null explicitly records that this quote has no customer summary. */
  storedValueSummary?: AvailableStoredValueSummary | null;
  includeStoredValue?: boolean;
  /** The richer customer-balance DTO is gated separately from operational payment options. */
  canViewStoredValueBalances?: boolean;
}

/**
 * Composes checkout options from request-local facts without repeating quote reads.
 *
 * @param params Authenticated tenant, branch, sale total, customer and optional loaded facts.
 * @returns Operational methods plus a separately permission-gated stored-value summary.
 * @throws When a required config or balance read fails; unavailable balances never become zero.
 * @example
 * const options = await composeCheckoutOptions({
 *   tenantId: '00000000-0000-4000-8000-000000000002', amount: 100,
 * });
 */
export async function composeCheckoutOptions(params: ComposeCheckoutOptionsParams) {
  const { tenantId, branchId, amount, customerId } = params;
  const [effectiveMethods, storedValueSummary] = await Promise.all([
    params.effectiveMethods ?? listEffectivePaymentMethodConfigs({ tenantId, branchId }),
    params.storedValueSummary !== undefined
      ? params.storedValueSummary
      : customerId && params.includeStoredValue !== false
        ? getAvailableStoredValueSummary(tenantId, customerId)
        : null,
  ]);
  const methods = effectiveMethods.filter((method) => isCheckoutPaymentMethodEligible(method, amount));
    const allOptions = methods.map((method) => ({
      id: method.id,
      payment_method_code: method.payment_method_code,
      payment_nature: method.payment_nature,
      gateway_code: method.gateway_code,
      display_name: method.display_name,
      display_name2: method.display_name2,
      description: method.description,
      description2: method.description2,
      requires_cash_drawer: method.requires_cash_drawer,
      requires_terminal: method.requires_terminal,
      supports_overpayment: method.supports_overpayment,
      supports_change_return: method.supports_change_return,
      requires_reference: method.requires_reference,
      // B31: surfaced so the collect-payment modal can show a "will be
      // recorded as PENDING until verified" notice for D9-configured methods.
      default_creation_status: method.default_creation_status,
      // The status the payment will ACTUALLY be created with. `default_creation_status`
      // alone only carries an explicit D9 override, so a method that resolves to
      // PENDING purely through the fallback chain looked COMPLETED to the client —
      // the cashier was told the order would be fully paid when it would not be.
      // Mirrors `collectPaymentTx`'s resolution exactly (same `||`, same helper),
      // so the notice cannot drift from what the server writes.
      resolved_creation_status:
        method.default_creation_status ||
        resolveDefaultStatus(method.payment_method_code, method.gateway_code),
      allowed_in_pos: method.allowed_in_pos,
      allowed_for_pay_now: method.allowed_for_pay_now,
      allowed_for_pay_on_collection: method.allowed_for_pay_on_collection,
      allowed_for_invoice_payment: method.allowed_for_invoice_payment,
      credit_application_type: method.credit_application_type,
      available_balance:
        method.credit_application_type === CREDIT_APPLICATION_TYPES.WALLET ||
        method.payment_method_code === 'WALLET'
          ? storedValueSummary?.wallet.balance ?? 0
          : method.credit_application_type === CREDIT_APPLICATION_TYPES.CUSTOMER_ADVANCE ||
              method.payment_method_code === 'ADVANCE'
            ? storedValueSummary?.advance.balance ?? 0
            : method.credit_application_type === CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT ||
                method.payment_method_code === 'CREDIT_NOTE'
              ? storedValueSummary?.creditNoteTotal ?? 0
              // B21 — was missing entirely: LOYALTY_CREDIT fell through to
              // null, so `available_balance ?? 0 > 0` was always false and
              // the option never appeared in customerCredits below, no
              // matter how many points the customer had.
              : method.credit_application_type === CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT ||
                  method.payment_method_code === 'LOYALTY_POINTS'
                ? storedValueSummary?.loyaltyAvailableValue ?? 0
                : null,
      requires_credit_reference_selection:
        method.credit_application_type === CREDIT_APPLICATION_TYPES.CUSTOMER_CREDIT ||
        method.payment_method_code === 'CREDIT_NOTE',
      // B21 — surfaced so the payment modal can show "N points = X currency"
      // and enforce the min-redeem floor client-side before submit.
      loyalty_points_balance:
        method.credit_application_type === CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT ||
        method.payment_method_code === 'LOYALTY_POINTS'
          ? storedValueSummary?.loyaltyPointsBalance ?? 0
          : undefined,
      loyalty_redeem_rate_per_point:
        method.credit_application_type === CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT ||
        method.payment_method_code === 'LOYALTY_POINTS'
          ? storedValueSummary?.loyaltyRedeemRatePerPoint ?? 0
          : undefined,
      loyalty_min_redeem_points:
        method.credit_application_type === CREDIT_APPLICATION_TYPES.LOYALTY_CREDIT ||
        method.payment_method_code === 'LOYALTY_POINTS'
          ? storedValueSummary?.loyaltyMinRedeemPoints ?? 0
          : undefined,
      display_order: method.display_order,
    }));

    const paymentMethods = allOptions.filter(
      (method) =>
        method.payment_nature === PAYMENT_NATURE.REAL_PAYMENT &&
        method.allowed_in_pos
    );

    const customerCredits = allOptions.filter((method) => {
      if (method.payment_nature !== PAYMENT_NATURE.CREDIT_APPLICATION) {
        return false;
      }
      if (!method.allowed_in_pos) {
        return false;
      }
      if (method.credit_application_type === CREDIT_APPLICATION_TYPES.GIFT_CARD) {
        return false;
      }
      return (method.available_balance ?? 0) > 0;
    });

  return {
    paymentMethods,
    customerCredits,
    storedValueSummary: params.canViewStoredValueBalances && storedValueSummary
      ? toStoredValueSummaryDto(storedValueSummary)
      : null,
  };
}

/** API-safe checkout envelope shared by the quote and compatibility endpoint. */
export type CheckoutOptionsResult = Awaited<ReturnType<typeof composeCheckoutOptions>>;
