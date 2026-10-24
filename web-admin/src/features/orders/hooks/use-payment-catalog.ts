'use client';

import type { CheckoutOptionsResponse, CheckoutSettlementOption } from '@/lib/types/payment-quote';

/**
 * Payment catalog queries for Payment Modal V4.
 *
 * Brands and terminals retain their lookup caches. Amount-sensitive settlement
 * options come only from the same quote as the financial totals, avoiding a
 * second browser request and placeholder options for a previous amount.
 */

import { fetchPaymentMetadata } from '../api/payment-quote-api';
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
export type { CheckoutSettlementOption, CheckoutOptionsResponse } from '@/lib/types/payment-quote';


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
  quoteOptions: CheckoutOptionsResponse | null;
  quotePending: boolean;
  quoteFailed: boolean;
  refetchQuote: () => unknown;
  /** Gates every query; matches the modal `open` flag. */
  open: boolean;
  tenantOrgId: string;
  userId?: string;
  branchId?: string;
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
 * @param params.branchId - Active branch id for terminal scoping.
 * @param params.userId - Authenticated cashier identity for metadata isolation.
 * @param params.quoteOptions - Amount-matched methods and credits from the coordinated quote.
 * @param params.isRetailOnlyOrder - Hides INVOICE / PAY_ON_COLLECTION when true.
 * @param params.isRTL - Selects RTL display fields for option names/hints.
 * @param params.t - Translate function for fallback method labels.
 * @returns Catalog data, explicit failure/retry states, and lookup helpers.
 * @example usePaymentCatalog({ open, tenantOrgId, userId, branchId, quoteOptions, quotePending, quoteFailed, refetchQuote, isRetailOnlyOrder, isRTL, t });
 */
export function usePaymentCatalog({
  quoteOptions,
  quotePending,
  quoteFailed,
  refetchQuote,
  open,
  tenantOrgId,
  userId,
  branchId,
  isRetailOnlyOrder,
  isRTL,
  t,
}: UsePaymentCatalogParams) {
  // Active card brands for CARD leg dropdown
  const brandsQuery = useQuery<OrgCardBrandConfig[]>({
    queryKey: ['card-brands-active', tenantOrgId, userId ?? ''],
    queryFn: async ({ signal }) => (await fetchPaymentMetadata<OrgCardBrandConfig>('/api/v1/settings/payments/card-brands', signal)).filter((brand) => brand.is_active),
    enabled: open && !!tenantOrgId && !!userId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const terminalsQuery = useQuery<PaymentTerminalOption[]>({
    queryKey: ['payment-terminals-checkout', tenantOrgId, userId ?? '', branchId ?? ''],
    queryFn: async ({ signal }) => (await fetchPaymentMetadata<PaymentTerminalOption>('/api/v1/settings/payments/terminals', signal)).filter((terminal) => terminal.is_active),
    enabled: open && !!tenantOrgId && !!userId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const cardBrands = brandsQuery.data ?? [];
  const paymentTerminals = terminalsQuery.data ?? [];
  const branchPaymentTerminals = useMemo(
    () =>
      paymentTerminals.filter(
        (terminal) => !branchId || !terminal.branch_id || terminal.branch_id === branchId
      ),
    [branchId, paymentTerminals]
  );

  const checkoutOptions = quoteOptions;
  const checkoutMethodsLoading = !quoteOptions && quotePending;
  const checkoutOptionsIsError = quoteFailed;
  const refetchCheckoutOptions = refetchQuote;

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
    brandsFailed: brandsQuery.isError,
    terminalsFailed: terminalsQuery.isError,
    terminalsPending: terminalsQuery.isFetching || terminalsQuery.isPending,
    refetchMetadata: () => Promise.all([brandsQuery.refetch(), terminalsQuery.refetch()]),
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
