/**
 * Payment Modal V4 — thin shell (Phase 2G-2).
 *
 * Owns only:
 *  - The RHF form + zodResolver
 *  - One coordinated initial payment quote
 *  - The open-reset form effect (form.reset on open)
 *  - Derived defaults (defaultPaymentMethod, defaultOutstandingPolicy, isB2BCustomer)
 *  - CSRF token
 *
 * Delegates everything else — engine, refs, focus helpers, section state,
 * submit orchestration, and all JSX — to PaymentFullView.
 */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/lib/auth/auth-context';
import { LOGIN_REASONS } from '@/lib/constants/auth-session';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { usePaymentQuote } from '@features/orders/hooks/use-payment-quote';
import { CmxButton, CmxSpinner } from '@ui/primitives';
import { CmxSummaryMessage } from '@ui/feedback';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import {
  getPaymentFormSchema,
  type PaymentFormData,
} from '@features/orders/model/payment-form-schema';
import {
  type NewOrderPaymentPayload,
  type OutstandingPolicy,
} from '@/lib/validations/new-order-payment-schemas';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { OrderItemServicePref } from '@features/orders/model/new-order-types';
import type { PaymentServerGuard } from '@features/orders/hooks/use-order-submission';
import {
  PAYMENT_MODAL_MODE,
  type PaymentModalMode,
} from './payment-modal-v4.utils';
import { PaymentFullView } from './payment-full-view';
import {
  PaymentCurrencyConfigGate,
} from '@features/orders/payment/primitives/payment-currency-config-gate';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    paymentData: PaymentFormData,
    payload: NewOrderPaymentPayload,
  ) => void;
  total: number;
  /** Order amount for checkout-options eligibility; defaults to preview saleTotal when loaded. */
  checkoutAmount?: number;
  items: {
    productId: string;
    quantity: number;
    priceOverride?: number | null;
    servicePrefCharge?: number;
    packingPrefCharge?: number;
  }[];
  /** B18 — order-level preferences threaded into the totals preview so the modal total includes their charge. */
  orderServicePrefs?: OrderItemServicePref[];
  isExpress?: boolean;
  tenantOrgId: string;
  customerId?: string;
  customerType?: string;
  customerDisplayName?: string;
  customerPhone?: string;
  serviceCategories?: string[];
  branchId?: string;
  userId?: string;
  isRetailOnlyOrder?: boolean;
  loading?: boolean;
  initialPaymentNotes?: string;
  /**
   * Face the modal opens with (Phase 4 — single engine, two modes). Defaults
   * to Simple; the engine auto-escalates to Full when `needsAdvanced` trips.
   */
  initialPaymentMode?: PaymentModalMode;
  /** Phase 5 — server rejection routed to its owning capability (in-view guard). */
  serverGuard?: PaymentServerGuard | null;
  /** Clears the routed server guard (called on modal open reset). */
  onServerGuardClear?: () => void;
}

// ---------------------------------------------------------------------------
// Main component (thin shell)
// ---------------------------------------------------------------------------
/**
 * Coordinates the V4 cashier payment experience without changing the order
 * payment payload contract used by the submit flow.
 *
 * @param root0 Payment modal props.
 * @param root0.open Controls modal visibility.
 * @param root0.onClose Closes the modal after cancel or successful submit.
 * @param root0.onSubmit Persists the validated payment payload.
 * @param root0.total Trusted order total from the order workspace.
 * @param root0.items Order items used for cashier-facing payment context.
 * @param root0.isExpress Marks whether the order is an express order.
 * @param root0.tenantOrgId Tenant scope required by payment preview lookups.
 * @param root0.customerId Customer identifier for credit, wallet, and gift-card context.
 * @param root0.customerType Customer account type for B2B and AR rules.
 * @param root0.customerDisplayName Cashier-facing customer name.
 * @param root0.customerPhone Cashier-facing customer phone or reference.
 * @param root0.serviceCategories Service categories attached to the order.
 * @param root0.branchId Branch scope used by payment methods and drawer sessions.
 * @param root0.userId Current cashier user identifier for drawer and audit context.
 * @param root0.isRetailOnlyOrder Marks retail-only orders for payment method rules.
 * @param root0.loading Disables submit while the parent order flow is busy.
 * @param root0.initialPaymentNotes Existing payment notes restored when reopening.
 * @param root0.initialPaymentMode Face the modal opens with (defaults to Simple).
 * @param root0.serverGuard Server rejection routed to its owning capability (in-view guard).
 * @param root0.onServerGuardClear Clears the routed server guard on modal open reset.
 * @param root0.checkoutAmount
 * @returns Payment modal JSX for the active order.
 */
export function PaymentModalV4({
  open,
  onClose,
  onSubmit,
  total,
  checkoutAmount,
  items,
  orderServicePrefs,
  isExpress = false,
  tenantOrgId,
  customerId,
  customerType,
  customerDisplayName,
  customerPhone,
  serviceCategories,
  branchId,
  userId,
  isRetailOnlyOrder = false,
  loading = false,
  initialPaymentNotes = '',
  initialPaymentMode = PAYMENT_MODAL_MODE.SIMPLE,
  serverGuard = null,
  onServerGuardClear,
}: PaymentModalProps) {
  const isB2BCustomer = customerType === 'b2b';
  const defaultOutstandingPolicy: OutstandingPolicy = isRetailOnlyOrder
    ? 'NONE'
    : isB2BCustomer
      ? 'CREDIT_INVOICE'
      : 'PAY_ON_COLLECTION';
  const defaultPaymentMethod: PaymentFormData['paymentMethod'] =
    isRetailOnlyOrder
      ? PAYMENT_METHODS.CASH
      : isB2BCustomer
        ? PAYMENT_METHODS.INVOICE
        : PAYMENT_METHODS.PAY_ON_COLLECTION;

  const { token: csrfToken, loading: csrfLoading } = useCSRFToken();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(
      getPaymentFormSchema(total, ''),
    ) as Resolver<PaymentFormData>,
    defaultValues: {
      paymentMethod: defaultPaymentMethod,
      checkNumber: '',
      checkBank: '',
      checkDate: '',
      percentDiscount: 0,
      amountDiscount: 0,
      promoCode: '',
      promoCodeId: '',
      promoDiscount: 0,
      giftCardNumber: '',
      giftCardAmount: 0,
      payAllOrders: false,
      paymentNotes: '',
      outstandingPolicy: defaultOutstandingPolicy,
      b2bContractId: '',
      costCenterCode: '',
      poNumber: '',
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
    criteriaMode: 'all',
  });

  const { reset } = form;

  const { signOut } = useAuth();
  const t = useTranslations('newOrder.payment');
  const tCommon = useTranslations('common');
  const tNewOrderErrors = useTranslations('newOrder.errors');
  const identity = JSON.stringify([open, tenantOrgId, branchId ?? '', customerId ?? '', userId ?? '']);
  const initialRequest = {
    items,
    branchId: branchId || undefined,
    customerId: customerId || undefined,
    isExpress,
    percentDiscount: 0,
    amountDiscount: 0,
    serviceCategories: serviceCategories?.length ? serviceCategories : undefined,
    orderServicePrefs: orderServicePrefs?.length ? orderServicePrefs : undefined,
  };
  // Freeze bootstrap inputs for this opening. After hydration only the engine
  // refreshes quotes; the shell must not issue a second zero-discount request.
  const [session, setSession] = useState(() => ({ identity, key: crypto.randomUUID(), request: initialRequest }));
  const quoteSession = session.identity === identity ? session : { identity, key: crypto.randomUUID(), request: initialRequest };
  if (quoteSession !== session) setSession(quoteSession);
  const quote = usePaymentQuote({
    open,
    sessionKey: quoteSession.key,
    tenantOrgId,
    userId,
    csrfReady: !csrfLoading,
    csrfToken,
    request: quoteSession.request,
  });
  const currencyConfig = quote.snapshot ? {
    currencyCode: quote.snapshot.currencyCode,
    decimalPlaces: quote.snapshot.decimalPlaces,
    currencyExRate: quote.snapshot.currencyExRate,
  } : null;

  // Reset the form on open. View-local state resets live in PaymentFullView.
  useEffect(() => {
    if (open) {
      reset({
        paymentMethod: defaultPaymentMethod,
        checkNumber: '',
        checkBank: '',
        checkDate: '',
        percentDiscount: 0,
        amountDiscount: 0,
        promoCode: '',
        promoCodeId: '',
        promoDiscount: 0,
        giftCardNumber: '',
        giftCardAmount: 0,
        giftCardId: '',
        payAllOrders: false,
        paymentNotes: initialPaymentNotes ?? '',
        outstandingPolicy: defaultOutstandingPolicy,
        b2bContractId: '',
        costCenterCode: '',
        poNumber: '',
      });
    }
  }, [
    open,
    reset,
    defaultPaymentMethod,
    defaultOutstandingPolicy,
    initialPaymentNotes,
  ]);

  if (!open) return null;

  if (!currencyConfig || items.length === 0) {
    if (quote.errorCode === 'MISSING_TENANT_CURRENCY' || quote.errorCode === 'TENANT_CURRENCY_UNAVAILABLE') {
      return <PaymentCurrencyConfigGate open={open}
        state={{ status: quote.errorCode === 'MISSING_TENANT_CURRENCY' ? 'missing-config' : 'unavailable' }}
        onClose={onClose} onRetry={() => void quote.refetch()} />;
    }
    return (
      <CmxDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <CmxDialogContent className="max-w-lg" data-testid="payment-initialization-gate">
          <CmxDialogHeader><CmxDialogTitle>{t('title')}</CmxDialogTitle></CmxDialogHeader>
          {quote.failed || items.length === 0 ? <CmxSummaryMessage type="error" title={t('messages.loadFailedTitle')}
            items={[items.length === 0 ? tNewOrderErrors('addItems') : quote.errorCode === 'PAYMENT_CONTEXT_UNAVAILABLE' ? t('messages.sessionUnavailable') : quote.errorCode === 'PAYMENT_QUOTE_TIMEOUT' ? t('messages.loadTimedOut') : t('messages.loadFailedDescription')]} />
            : <div className="flex items-center gap-3" role="status"><CmxSpinner />{t('messages.preparing')}</div>}
          <CmxDialogFooter>
            <CmxButton type="button" variant="outline" onClick={onClose}>{tCommon('cancel')}</CmxButton>
            {quote.errorCode === 'PAYMENT_CONTEXT_UNAVAILABLE' ? <CmxButton type="button" onClick={() => void signOut('user', { loginReason: LOGIN_REASONS.SESSION_EXPIRED, returnTo: '/dashboard/orders/new' })}>{t('currencyConfig.signOutAndSignIn')}</CmxButton> : null}
            {quote.failed && items.length > 0 ? <CmxButton type="button" onClick={() => void quote.refetch()}>{tCommon('retry')}</CmxButton> : null}
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    );
  }

  return (
    <PaymentFullView
      quoteSessionKey={quoteSession.key}
      form={form}
      defaultPaymentMethod={defaultPaymentMethod}
      defaultOutstandingPolicy={defaultOutstandingPolicy}
      isB2BCustomer={isB2BCustomer}
      currencyConfig={currencyConfig}
      csrfToken={csrfToken}
      csrfReady={!csrfLoading}
      open={open}
      items={items}
      orderServicePrefs={orderServicePrefs}
      total={total}
      checkoutAmount={checkoutAmount}
      isExpress={isExpress}
      tenantOrgId={tenantOrgId}
      customerId={customerId}
      customerType={customerType}
      customerDisplayName={customerDisplayName}
      customerPhone={customerPhone}
      serviceCategories={serviceCategories}
      branchId={branchId}
      userId={userId}
      isRetailOnlyOrder={isRetailOnlyOrder}
      loading={loading}
      initialPaymentNotes={initialPaymentNotes}
      initialMode={initialPaymentMode}
      serverGuard={serverGuard}
      onServerGuardClear={onServerGuardClear}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
