/**
 * Payment Modal V4 — thin shell (Phase 2G-2).
 *
 * Owns only:
 *  - The RHF form + zodResolver
 *  - Currency-config loading
 *  - The open-reset form effect (form.reset on open)
 *  - Derived defaults (defaultPaymentMethod, defaultOutstandingPolicy, isB2BCustomer)
 *  - CSRF token
 *
 * Delegates everything else — engine, refs, focus helpers, section state,
 * submit orchestration, and all JSX — to PaymentFullView.
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCSRFToken } from '@/lib/hooks/use-csrf-token';
import { getCurrencyConfigAction } from '@/app/actions/tenant/get-currency-config';
import { getPaymentFormSchema, type PaymentFormData } from '@features/orders/model/payment-form-schema';
import {
  type NewOrderPaymentPayload,
  type OutstandingPolicy,
} from '@/lib/validations/new-order-payment-schemas';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import { type PaymentEngineCurrencyConfig } from '@features/orders/hooks/use-payment-engine';
import { PaymentFullView } from './payment-full-view';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (paymentData: PaymentFormData, payload: NewOrderPaymentPayload) => void;
  total: number;
  /** Order amount for checkout-options eligibility; defaults to preview saleTotal when loaded. */
  checkoutAmount?: number;
  items: { productId: string; quantity: number; priceOverride?: number | null; servicePrefCharge?: number; packingPrefCharge?: number }[];
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
}: PaymentModalProps) {
  const isB2BCustomer = customerType === 'b2b';
  const defaultOutstandingPolicy: OutstandingPolicy = isRetailOnlyOrder
    ? 'NONE'
    : isB2BCustomer
      ? 'CREDIT_INVOICE'
      : 'PAY_ON_COLLECTION';
  const defaultPaymentMethod: PaymentFormData['paymentMethod'] = isRetailOnlyOrder
    ? PAYMENT_METHODS.CASH
    : isB2BCustomer
      ? PAYMENT_METHODS.INVOICE
      : PAYMENT_METHODS.PAY_ON_COLLECTION;

  const { token: csrfToken } = useCSRFToken();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(
      getPaymentFormSchema(total, '')
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

  const [currencyConfig, setCurrencyConfig] = useState<PaymentEngineCurrencyConfig | null>(null);

  // Load currency config on open.
  useEffect(() => {
    if (open && tenantOrgId) {
      getCurrencyConfigAction(tenantOrgId, branchId, userId).then(config => {
        setCurrencyConfig(config);
      }).catch(() => {
        setCurrencyConfig({ currencyCode: ORDER_DEFAULTS.CURRENCY, decimalPlaces: 3, currencyExRate: 1 });
      });
    }
  }, [open, tenantOrgId, branchId, userId]);

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
  }, [open, reset, defaultPaymentMethod, defaultOutstandingPolicy, initialPaymentNotes]);

  if (!open) return null;

  return (
    <PaymentFullView
      form={form}
      defaultPaymentMethod={defaultPaymentMethod}
      defaultOutstandingPolicy={defaultOutstandingPolicy}
      isB2BCustomer={isB2BCustomer}
      currencyConfig={currencyConfig}
      csrfToken={csrfToken}
      open={open}
      items={items}
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
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}
