/**
 * Payment Modal v4 — pure submit-payload builder.
 *
 * Verbatim extraction of the payload-assembly tail of `onSubmitForm` in
 * `payment-modal-v4.tsx` (program plan anchor `:2240-3488`): the `legsWithRefs` /
 * `submitCashLegRef` / `submitOverpaymentResolution` computation and the `payload`
 * object literal that is then `safeParse`d against `newOrderPaymentPayloadSchema`.
 *
 * Scope (Phase 2F): this module owns only the **pure payload assembly** — the
 * conditional spreads, field selection, leg-ref stamping, and overpayment-resolution
 * fallback. The submit **orchestration** (the `cmxMessage` validation guards, the
 * confirm-dialog state, the `safeParse` + error surface, and the final
 * `onSubmit(paymentData, payload)`) stays in the component/view; it feeds these
 * already-derived inputs in and parses the returned object.
 *
 * Behavior freeze: the assembly is byte-equivalent to the original inline code. This
 * file is intentionally **pure** (no `cmxMessage` / `'use client'`) so the Phase 2F
 * payload **oracle** can replay the 8 baseline fixtures through `buildPaymentPayload`
 * and assert deep-equality without pulling in the modal's client import chain.
 *
 * See `docs/features/Order_Fin/Payment_Modal_Review/` and
 * `__tests__/features/orders/payment-payload-fixtures/`.
 */

import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type {
  OutstandingPolicy,
  OverpaymentResolutionInput,
  PaymentLeg,
} from '@/lib/validations/new-order-payment-schemas';
import { ensurePaymentLegRefs } from '@/lib/payments/ensure-payment-leg-refs';
import { buildOverpaymentResolutionPayload } from '@features/orders/ui/payment-modal/allocation/build-overpayment-resolution';
import type { ExtraReceiptHandlingMode } from '@features/orders/ui/payment-modal/allocation/extra-receipt-handling-card';

/**
 * The subset of resolved totals the payload carries (a structural slice of the
 * `usePaymentTotals` `totals` memo — extra fields on the passed object are ignored).
 */
export interface PaymentSubmitTotals {
  subtotal: number;
  manualDiscount: number;
  promoDiscount: number;
  afterDiscounts: number;
  taxRate: number;
  taxAmount: number;
  vatTaxPercent: number;
  vatValue: number;
  giftCardApplied: number;
}

/**
 * A payment leg paired with its index — the settlement-entry shape the modal derives
 * (`useMoneyDerivations.settlementLegEntries`). Only `leg` is read here.
 */
export interface PaymentSettlementLegEntry {
  leg: PaymentLeg;
}

/**
 * Inputs to {@link buildPaymentPayload} — all already-derived by the modal's
 * totals/legs/derivations/payExtra/cash-drawer slices at submit time.
 */
export interface BuildPaymentPayloadInput {
  /** Amount settled now (`amountToCharge`). */
  settledNowAmount: number;
  /** Resolved totals slice carried in the payload. */
  totals: PaymentSubmitTotals;
  /** Final sale total. */
  saleTotal: number;
  /** Currency config (code + ex-rate) when loaded; omitted from the payload when null. */
  currencyConfig: { currencyCode: string; currencyExRate: number } | null;
  /** Effective outstanding policy after settlement. */
  effectiveOutstandingPolicy: OutstandingPolicy;
  /** Cashier override of a soft credit-limit warning. */
  creditLimitOverride: boolean;
  /** Whether settlement requires a bound cash-drawer session. */
  cashDrawerRequired: boolean;
  /** Selected cash-drawer session id (carried only when required + selected). */
  selectedCashDrawerSessionId: string;
  /** Default tax-profile entries; enabled ids are carried as `taxProfileIds`. */
  taxProfileEntries: ReadonlyArray<{ id: string; enabled: boolean }>;
  /** Settlement leg entries — when non-empty, their legs (ref-stamped) are carried. */
  settlementLegEntries: ReadonlyArray<PaymentSettlementLegEntry>;
  /** All payment legs (fallback source when there are no settlement entries). */
  paymentLegs: PaymentLeg[];
  /** Pre-resolved overpayment resolution (from payExtra); falls back to the builder below. */
  overpaymentResolutionPayload: OverpaymentResolutionInput | null | undefined;
  /** Extra-receipt handling mode (for the overpayment-resolution fallback). */
  extraReceiptMode: ExtraReceiptHandlingMode;
  /** Unresolved overpayment amount (for the overpayment-resolution fallback). */
  unresolvedOverpaymentAmount: number;
  /** Allocation preview id (for the overpayment-resolution fallback). */
  allocationPreviewId: string | null;
}

/**
 * Builds the submit-order payload from the modal's already-derived submit inputs.
 *
 * Pure and side-effect-free: identical to the inline assembly in `onSubmitForm`, so it
 * can be unit-tested by the Phase 2F oracle (replays the 8 baseline fixtures). The
 * caller still validates the result against `newOrderPaymentPayloadSchema`.
 *
 * @param input - {@link BuildPaymentPayloadInput}.
 * @returns The unparsed submit-order payload object.
 */
export function buildPaymentPayload({
  settledNowAmount,
  totals,
  saleTotal,
  currencyConfig,
  effectiveOutstandingPolicy,
  creditLimitOverride,
  cashDrawerRequired,
  selectedCashDrawerSessionId,
  taxProfileEntries,
  settlementLegEntries,
  paymentLegs,
  overpaymentResolutionPayload,
  extraReceiptMode,
  unresolvedOverpaymentAmount,
  allocationPreviewId,
}: BuildPaymentPayloadInput) {
  const legsWithRefs = ensurePaymentLegRefs(
    settlementLegEntries.length > 0
      ? settlementLegEntries.map(({ leg }) => leg)
      : paymentLegs
  );

  const submitCashLegRef =
    legsWithRefs.find((leg) => leg.method === PAYMENT_METHODS.CASH)?.legRef ?? null;

  const submitOverpaymentResolution =
    overpaymentResolutionPayload ??
    buildOverpaymentResolutionPayload(
      extraReceiptMode,
      unresolvedOverpaymentAmount,
      {
        allocationPreviewId,
        cashLegRef: submitCashLegRef,
      }
    );

  return {
    amountToCharge: settledNowAmount,
    totals: {
      subtotal: totals.subtotal,
      manualDiscount: totals.manualDiscount,
      promoDiscount: totals.promoDiscount,
      afterDiscounts: totals.afterDiscounts,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      vatTaxPercent: totals.vatTaxPercent,
      vatValue: totals.vatValue,
      giftCardApplied: totals.giftCardApplied,
      saleTotal,
    },
    ...(currencyConfig && {
      currencyCode: currencyConfig.currencyCode,
      currencyExRate: currencyConfig.currencyExRate,
    }),
    outstandingPolicy: effectiveOutstandingPolicy,
    creditLimitOverride: creditLimitOverride || undefined,
    ...(cashDrawerRequired && selectedCashDrawerSessionId && {
      cashDrawerSessionId: selectedCashDrawerSessionId,
    }),
    ...(taxProfileEntries.some((entry) => entry.enabled) && {
      taxProfileIds: taxProfileEntries
        .filter((entry) => entry.enabled)
        .map((entry) => entry.id),
    }),
    ...(settlementLegEntries.length > 0 && {
      paymentLegs: legsWithRefs,
    }),
    ...(submitOverpaymentResolution && {
      overpaymentResolution: submitOverpaymentResolution,
    }),
  };
}
