'use client';

/**
 * Payment catalog queries for Payment Modal V4.
 *
 * Verbatim extraction of the modal's read-only catalog concern (previously inline
 * in `payment-modal-v4.tsx`): the active card brands, branch payment terminals, and
 * checkout settlement options (real payment methods + customer credits). It also
 * owns the catalog lookup derivations (`realPaymentOptions`, `creditMethodCodes`,
 * `optionByMethodKey`), the `getMethodOption` resolver, and the catalog presentation
 * helpers (`getOptionDisplayName`, `getMethodHint`) that downstream legs, validation,
 * totals, and both views read.
 *
 * Behavior freeze (Phase 2A): queries, query keys, `enabled`, `staleTime`, memo
 * dependency arrays, and the display/hint logic stay byte-equivalent to the original
 * inline code — do not "improve" filtering, caching, or label resolution here. The
 * only additive surface is `checkoutOptionsIsError` + `refetchCheckoutOptions`
 * (finding 1.9), exposed for the Phase 3 method empty/error/loading three-state. The
 * checkout-options query still swallows fetch failures into empty lists exactly as
 * before, so behavior is unchanged; the new fields are plumbing for a later phase.
 *
 * `getPaymentLabel` is duplicated here (it is a translation-driven switch, not an
 * importable helper) so the hook can resolve `getOptionDisplayName` fallbacks; the
 * component keeps its own copy for `summaryMethodLabel`.
 *
 * See `docs/features/Order_Fin/Payment_Modal_Review/`.
 */

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { OrgCardBrandConfig } from '@/lib/types/payment';

/**
 * Immediate (real-payment) method codes — settle at checkout rather than deferring.
 */
export const IMMEDIATE_METHOD_CODES = [
  PAYMENT_METHODS.CASH,
  PAYMENT_METHODS.CARD,
  PAYMENT_METHODS.CHECK,
  PAYMENT_METHODS.BANK_TRANSFER,
  PAYMENT_METHODS.MOBILE_PAYMENT,
  PAYMENT_METHODS.PAYMENT_GATEWAY,
] as const;

/**
 * Gateway-backed method codes — require terminal/gateway selection on the leg.
 */
export const GATEWAY_METHOD_CODES: string[] = [
  PAYMENT_METHODS.PAYMENT_GATEWAY,
  PAYMENT_METHODS.HYPERPAY,
  PAYMENT_METHODS.PAYTABS,
  PAYMENT_METHODS.STRIPE,
];

/**
 * Minimal translate signature compatible with next-intl's `useTranslations`.
 */
export type PaymentCatalogTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * A single settlement option returned by the checkout-options API — either a real
 * payment method (cash/card/gateway/…) or a customer credit (wallet/advance/credit
 * note/loyalty). Mirrors the shape consumed across Payment Modal V4.
 */
export type CheckoutSettlementOption = {
  id: string;
  payment_method_code: string;
  payment_nature: string;
  gateway_code: string | null;
  display_name: string;
  display_name2: string | null;
  description: string | null;
  description2: string | null;
  requires_cash_drawer: boolean;
  requires_terminal: boolean;
  supports_overpayment: boolean;
  supports_change_return: boolean;
  requires_reference: boolean;
  allowed_in_pos: boolean;
  allowed_for_pay_now?: boolean | null;
  allowed_for_pay_on_collection?: boolean | null;
  allowed_for_invoice_payment?: boolean | null;
  credit_application_type?: string | null;
  available_balance?: number | null;
  requires_credit_reference_selection?: boolean;
  display_order?: number | null;
};

/**
 * Envelope returned by `/api/v1/orders/checkout-options`.
 */
export type CheckoutOptionsResponse = {
  paymentMethods: CheckoutSettlementOption[];
  customerCredits: CheckoutSettlementOption[];
};

/**
 * A payment terminal option for the CARD/gateway leg terminal dropdown.
 */
export type PaymentTerminalOption = {
  id: string;
  terminal_code: string;
  terminal_name: string;
  terminal_name2: string | null;
  branch_id: string | null;
  is_active: boolean;
};

/**
 * Inputs the catalog queries + presentation helpers need. Threaded by the modal
 * (and, from Phase 2G, the payment engine) — the hook owns no order context itself.
 */
export interface UsePaymentCatalogParams {
  /** Gates every query; matches the modal `open` flag. */
  open: boolean;
  tenantOrgId: string;
  branchId?: string;
  customerId?: string;
  /** Order amount used for checkout-options eligibility. */
  checkoutEligibilityAmount: number;
  /** Retail-only orders hide INVOICE / PAY_ON_COLLECTION methods. */
  isRetailOnlyOrder: boolean;
  /** Right-to-left locale flag — selects `*_name2`/`description2` display fields. */
  isRTL: boolean;
  /** Translate function (`newOrder.payment` namespace) for fallback method labels. */
  t: PaymentCatalogTranslate;
}

/**
 * Read-only catalog data + lookup/presentation derivations for Payment Modal V4.
 *
 * @param params - {@link UsePaymentCatalogParams}.
 * @param params.open - Gates every query; matches the modal `open` flag.
 * @param params.tenantOrgId - Active tenant org id.
 * @param params.branchId - Active branch id (filters terminals + checkout options).
 * @param params.customerId - Active customer id (scopes checkout options).
 * @param params.checkoutEligibilityAmount - Order amount for checkout-options eligibility.
 * @param params.isRetailOnlyOrder - Hides INVOICE / PAY_ON_COLLECTION when true.
 * @param params.isRTL - Selects RTL display fields for option names/hints.
 * @param params.t - Translate function for fallback method labels.
 * @returns Catalog query data, lookup derivations, and presentation helpers.
 */
export function usePaymentCatalog({
  open,
  tenantOrgId,
  branchId,
  customerId,
  checkoutEligibilityAmount,
  isRetailOnlyOrder,
  isRTL,
  t,
}: UsePaymentCatalogParams) {
  // Active card brands for CARD leg dropdown
  const { data: cardBrands = [] } = useQuery<OrgCardBrandConfig[]>({
    queryKey: ['card-brands-active', tenantOrgId],
    queryFn: async () => {
      const res = await fetch('/api/v1/settings/payments/card-brands');
      if (!res.ok) return [];
      const json = await res.json();
      return ((json.data ?? []) as OrgCardBrandConfig[]).filter((b) => b.is_active);
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: paymentTerminals = [] } = useQuery<PaymentTerminalOption[]>({
    queryKey: ['payment-terminals-checkout', tenantOrgId, branchId ?? ''],
    queryFn: async () => {
      const res = await fetch('/api/v1/settings/payments/terminals');
      if (!res.ok) return [];
      const json = await res.json();
      return ((json.data ?? []) as PaymentTerminalOption[]).filter((terminal) => terminal.is_active);
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const branchPaymentTerminals = useMemo(
    () =>
      paymentTerminals.filter(
        (terminal) => !branchId || !terminal.branch_id || terminal.branch_id === branchId
      ),
    [branchId, paymentTerminals]
  );

  const {
    data: checkoutOptions,
    isLoading: checkoutMethodsLoading,
    isError: checkoutOptionsIsError,
    refetch: refetchCheckoutOptions,
  } = useQuery<CheckoutOptionsResponse>({
    queryKey: ['checkout-options', tenantOrgId, branchId ?? '', customerId ?? '', checkoutEligibilityAmount],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      if (customerId) params.set('customerId', customerId);
      params.set('amount', String(checkoutEligibilityAmount));
      const res = await fetch(`/api/v1/orders/checkout-options?${params.toString()}`);
      if (!res.ok) return { paymentMethods: [], customerCredits: [] };
      const json = await res.json();
      return (json.data ?? { paymentMethods: [], customerCredits: [] }) as CheckoutOptionsResponse;
    },
    enabled: open,
    staleTime: 60_000,
  });

  const checkoutMethods = checkoutOptions?.paymentMethods ?? [];
  const customerCreditOptions = checkoutOptions?.customerCredits ?? [];

  const realPaymentOptions = useMemo(
    () =>
      checkoutMethods
        .filter((method) => method.payment_nature === 'REAL_PAYMENT' && method.allowed_in_pos)
        .filter((method) => !isRetailOnlyOrder || method.payment_method_code !== PAYMENT_METHODS.INVOICE)
        .filter((method) => !isRetailOnlyOrder || method.payment_method_code !== PAYMENT_METHODS.PAY_ON_COLLECTION)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    [checkoutMethods, isRetailOnlyOrder]
  );

  const creditMethodCodes = useMemo(
    () => customerCreditOptions.map((option) => option.payment_method_code),
    [customerCreditOptions]
  );

  const optionByMethodKey = useMemo(() => {
    const allOptions = [...realPaymentOptions, ...customerCreditOptions];
    return new Map(
      allOptions.map((option) => [`${option.payment_method_code}::${option.gateway_code ?? ''}`, option])
    );
  }, [customerCreditOptions, realPaymentOptions]);

  const getMethodOption = useCallback(
    (methodCode: string, gatewayCode?: string | null) =>
      optionByMethodKey.get(`${methodCode}::${gatewayCode ?? ''}`) ??
      optionByMethodKey.get(`${methodCode}::`),
    [optionByMethodKey]
  );

  // Translation-driven fallback label (duplicated from the component on purpose —
  // see the file header). Keep byte-equivalent to `payment-modal-v4.tsx`.
  const getPaymentLabel = (id: string) => {
    switch (id) {
      case PAYMENT_METHODS.CASH:              return t('methods.cash');
      case PAYMENT_METHODS.CARD:              return t('methods.card');
      case PAYMENT_METHODS.PAY_ON_COLLECTION: return t('methods.payOnCollection');
      case PAYMENT_METHODS.CHECK:             return t('methods.check');
      case PAYMENT_METHODS.INVOICE:           return t('methods.invoice');
      case PAYMENT_METHODS.BANK_TRANSFER:     return t('methods.bankTransfer');
      case PAYMENT_METHODS.MOBILE_PAYMENT:    return t('methods.mobilePayment');
      case PAYMENT_METHODS.PAYMENT_GATEWAY:   return t('methods.paymentGateway');
      case PAYMENT_METHODS.HYPERPAY:          return t('methods.hyperpay');
      case PAYMENT_METHODS.PAYTABS:           return t('methods.paytabs');
      case PAYMENT_METHODS.STRIPE:            return t('methods.stripe');
      case 'WALLET':                          return t('customerCredits.wallet');
      case 'ADVANCE':                         return t('customerCredits.customerAdvance');
      case 'CREDIT_NOTE':                     return t('customerCredits.customerCredit');
      case 'LOYALTY_POINTS':                  return t('customerCredits.loyaltyCredit');
      case 'CUSTOMER_ADVANCE':                return t('customerCredits.customerAdvance');
      case 'CUSTOMER_CREDIT':                 return t('customerCredits.customerCredit');
      case 'LOYALTY_CREDIT':                  return t('customerCredits.loyaltyCredit');
      default:                                return id;
    }
  };

  const getOptionDisplayName = (option: CheckoutSettlementOption | undefined, fallbackMethodCode?: string) => {
    if (option) {
      return isRTL ? (option.display_name2 || option.display_name) : option.display_name;
    }
    return fallbackMethodCode ? getPaymentLabel(fallbackMethodCode) : '';
  };

  const getMethodHint = (option: CheckoutSettlementOption) => {
    const description = isRTL ? (option.description2 || option.description) : (option.description || option.description2);
    return description
      ? `${option.payment_method_code} • ${description}`
      : option.payment_method_code;
  };

  return {
    cardBrands,
    paymentTerminals,
    branchPaymentTerminals,
    checkoutMethods,
    customerCreditOptions,
    checkoutMethodsLoading,
    /** Additive (finding 1.9): true when the checkout-options query errors. */
    checkoutOptionsIsError,
    /** Additive (finding 1.9): refetch the checkout-options query. */
    refetchCheckoutOptions,
    realPaymentOptions,
    creditMethodCodes,
    optionByMethodKey,
    getMethodOption,
    getOptionDisplayName,
    getMethodHint,
  };
}
