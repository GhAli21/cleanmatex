import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import { getOrderByRef } from '@/app/actions/orders/get-order';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getOrderInvoices } from '@/app/actions/payments/invoice-actions';
import { getOrderFinancialAction } from '@/app/actions/orders/get-order-financial';
import { getOrderPreferencesAction } from '@/app/actions/orders/get-order-preferences';
import { getOrderEditHistoryAction } from '@/app/actions/orders/get-order-edit-history';
import { getVouchersForOrder } from '@/lib/services/voucher-service';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { CREDIT_APPLICATION_TYPES } from '@/lib/constants/order-financial';
import { readCanonicalOrderFinancialSnapshot } from '@/lib/utils/order-financial-snapshot';
import { getPublicTrackingPathForOrderId } from '@/lib/services/public-order-tracking.service';
import {
  ORDER_PREF_DTL_DISPLAY_COLUMNS,
  type OrderPreferenceDtlColumn,
} from '@/lib/orders/order-preferences-dtl';
import {
  isUuidLike,
  sanitizeOrderDetailsReturnUrl,
} from '@/lib/orders/order-details-navigation';
import { OrderDetailClient } from './order-detail-client';
import { OrderDetailError } from './order-detail-error';

interface OrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    tenantOrgId?: string;
    returnUrl?: string;
    returnLabel?: string;
    tab?: string;
  }>;
}

async function OrderDetailContent({
  orderId,
  searchParams,
}: {
  orderId: string;
  searchParams: {
    tenantOrgId?: string;
    returnUrl?: string;
    returnLabel?: string;
    tab?: string;
  };
}) {
  const { tenantId, userId } = await getAuthContext();
  const t = await getTranslations('orders.detail');
  const tFull = await getTranslations('orders.detailFull');
  const locale = await getLocale();
  const safeReturnUrl = sanitizeOrderDetailsReturnUrl(searchParams?.returnUrl);
  const requestedTenantOrgId = searchParams?.tenantOrgId?.trim();
  const hasTenantMismatch = !!requestedTenantOrgId && requestedTenantOrgId !== tenantId;

  if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
    return (
      <OrderDetailError
        orderId={orderId || ''}
        title={t('errorInvalidOrderId')}
        description={t('errorInvalidOrderIdDesc')}
        backToOrders={t('backToOrders')}
        returnUrl={safeReturnUrl}
        returnLabel={searchParams?.returnLabel}
        debug={{
          condition: 'Invalid order reference (empty identifier)',
          tenantId,
          userId,
        }}
      />
    );
  }

  if (hasTenantMismatch) {
    return (
      <OrderDetailError
        orderId={orderId}
        title={t('errorOrderNotFound')}
        description={t('errorOrderNotFoundDesc')}
        backToOrders={t('backToOrders')}
        returnUrl={safeReturnUrl}
        returnLabel={searchParams?.returnLabel}
        debug={{
          condition: 'Requested tenant_org_id does not match authenticated tenant',
          tenantId,
          userId,
        }}
      />
    );
  }

  const orderResult = await getOrderByRef(tenantId, orderId);

  if (!orderResult.success || !orderResult.data) {
    return (
      <OrderDetailError
        orderId={orderId}
        title={t('errorOrderNotFound')}
        description={t('errorOrderNotFoundDesc')}
        backToOrders={t('backToOrders')}
        returnUrl={safeReturnUrl}
        returnLabel={searchParams?.returnLabel}
        debug={{
          condition: isUuidLike(orderId)
            ? 'getOrderByRef returned no data for UUID reference'
            : 'getOrderByRef returned no data for order_no reference',
          serverError: orderResult.error,
          tenantId,
          userId,
        }}
      />
    );
  }

  const order = orderResult.data as typeof orderResult.data & {
    total_paid_amount?: number | string | null;
    total_credit_applied_amount?: number | string | null;
    outstanding_amount?: number | string | null;
    pay_on_collection_amount?: number | string | null;
    service_charge?: number | string | null;
    rounding_adjustment_amount?: number | string | null;
    financial_engine_version?: number | null;
  };
  const resolvedOrderId = String(order.id);
  const [
    invoicesResult,
    financialResult,
    preferencesResult,
    editHistoryResult,
    vouchersResult,
    canViewFinancialDebug,
  ] = await Promise.all([
    getOrderInvoices(resolvedOrderId),
    getOrderFinancialAction(tenantId, resolvedOrderId),
    getOrderPreferencesAction(resolvedOrderId),
    getOrderEditHistoryAction(resolvedOrderId),
    getVouchersForOrder(resolvedOrderId),
    hasPermissionServer('orders:view_financial_breakdown'),
  ]);
  const orderInvoices = invoicesResult.success && invoicesResult.data ? invoicesResult.data : [];
  const financialData = financialResult.success ? financialResult.data : undefined;
  const orderPreferences =
    preferencesResult.success && preferencesResult.data ? preferencesResult.data : [];
  const editHistory =
    editHistoryResult.success && editHistoryResult.data ? editHistoryResult.data : [];
  const vouchers = vouchersResult ?? [];
  const headerFinancialSnapshot = readCanonicalOrderFinancialSnapshot(
    order as unknown as Record<string, unknown>,
  );
  const canonicalGiftCardApplied = financialData?.creditApplications
    ?.filter((row) => row.credit_type === CREDIT_APPLICATION_TYPES.GIFT_CARD)
    .reduce((sum, row) => sum + Number(row.applied_amount ?? 0), 0);

  const serializedOrder = {
    ...order,
    subtotal: financialData?.snapshot.subtotalAmount ?? headerFinancialSnapshot.subtotalAmount,
    discount: financialData?.snapshot.totalDiscountAmount ?? headerFinancialSnapshot.totalDiscountAmount,
    tax: financialData?.snapshot.totalTaxAmount ?? headerFinancialSnapshot.totalTaxAmount,
    total: financialData?.snapshot.totalAmount ?? headerFinancialSnapshot.totalAmount,
    paid_amount:
      financialData?.snapshot.totalPaidAmount ?? headerFinancialSnapshot.totalPaidAmount,
    total_paid_amount:
      financialData?.snapshot.totalPaidAmount
      ?? (order.total_paid_amount != null ? Number(order.total_paid_amount) : null),
    total_credit_applied_amount:
      financialData?.snapshot.totalCreditAppliedAmount
      ?? (order.total_credit_applied_amount != null
        ? Number(order.total_credit_applied_amount)
        : null),
    outstanding_amount:
      financialData?.snapshot.outstandingAmount
      ?? (order.outstanding_amount != null ? Number(order.outstanding_amount) : null),
    pay_on_collection_amount:
      financialData?.snapshot.payOnCollectionAmount
      ?? headerFinancialSnapshot.payOnCollectionAmount,
    service_charge:
      financialData?.snapshot.serviceChargeAmount
      ?? headerFinancialSnapshot.serviceChargeAmount,
    rounding_adjustment_amount:
      order.rounding_adjustment_amount != null
        ? Number(order.rounding_adjustment_amount)
        : null,
    ar_receivable_amount:
      financialData?.snapshot.arReceivableAmount
      ?? headerFinancialSnapshot.arReceivableAmount,
    gift_card_credit_applied_amount:
      canonicalGiftCardApplied != null ? canonicalGiftCardApplied : null,
    bag_count: order.bag_count ? Number(order.bag_count) : null,
    priority_multiplier:
      order.priority_multiplier !== undefined && order.priority_multiplier !== null
        ? Number(order.priority_multiplier)
        : null,
    items:
      order.items?.map((item) => {
        const serializedItem = { ...item } as Record<string, unknown>;
        if (item.price_per_unit != null) serializedItem.price_per_unit = Number(item.price_per_unit);
        if (item.total_price != null) serializedItem.total_price = Number(item.total_price);
        if (item.quantity != null) serializedItem.quantity = Number(item.quantity);
        if (item.quantity_ready != null) {
          serializedItem.quantity_ready = Number(item.quantity_ready);
        }
        return serializedItem;
      }) ?? [],
  };

  const tInvoices = await getTranslations('invoices');
  const publicTrackingPath = await getPublicTrackingPathForOrderId({
    tenantId,
    orderId: resolvedOrderId,
    fallbackOrderNo: typeof order.order_no === 'string' ? order.order_no : null,
  });
  const preferenceDtlColumnLabels = Object.fromEntries(
    ORDER_PREF_DTL_DISPLAY_COLUMNS.map((col) => [col, tFull(`preferences.dtlColumns.${col}`)])
  ) as Record<OrderPreferenceDtlColumn, string>;

  return (
    <OrderDetailClient
      order={serializedOrder}
      publicTrackingPath={publicTrackingPath}
      financialData={financialData}
      orderPreferences={orderPreferences}
      orderPreferenceDtlColumnLabels={preferenceDtlColumnLabels}
      orderInvoices={orderInvoices}
      vouchers={vouchers}
      editHistory={editHistory}
      tenantOrgId={tenantId}
      userId={userId ?? ''}
      canViewFinancialDebug={canViewFinancialDebug}
      returnUrl={safeReturnUrl}
      returnLabel={searchParams?.returnLabel}
      translations={{
        backToOrders: t('backToOrders'),
        edit: t('edit'),
        totalAmount: t('totalAmount'),
        paid: t('paid'),
        pendingPayment: t('pendingPayment'),
        preparationStatus: t('preparationStatus'),
        startPreparation: t('startPreparation'),
        continuePreparation: t('continuePreparation'),
        completed: t('completed'),
        numberOfBags: t('numberOfBags'),
        qrCode: t('qrCode'),
        retail: t('retail'),
        customerInformation: t('customerInformation'),
        name: t('name'),
        phone: t('phone'),
        email: t('email'),
        address: t('address'),
        loyaltyPoints: t('loyaltyPoints'),
        points: t('points'),
        orderItems: t('orderItems'),
        notes: t('notes'),
        customerNotes: t('customerNotes'),
        internalNotes: t('internalNotes'),
        paymentNotes: t('paymentNotes'),
        cancelledNote: t('cancelledNote'),
        returnReason: t('returnReason'),
        cancelledAt: t('cancelledAt'),
        returnedAt: t('returnedAt'),
        cancellationReturn: t('cancellationReturn'),
        photos: t('photos'),
        orderTimeline: t('orderTimeline'),
        quickActions: t('quickActions'),
        paymentDetails: t('paymentDetails'),
        subtotal: t('subtotal'),
        discount: t('discount'),
        tax: t('tax'),
        total: t('total'),
        paidAmount: t('paidAmount'),
        balance: t('balance'),
        paymentMethod: t('paymentMethod'),
        received: t('received'),
        readyBy: t('readyBy'),
        unappliedPayments: t('unappliedPayments'),
        applyToInvoice: t('applyToInvoice'),
        noUnappliedPayments: t('noUnappliedPayments'),
        recordDepositPos: t('recordDepositPos'),
        selectInvoiceToApply: t('selectInvoiceToApply'),
        paymentKind: t('paymentKind'),
        viewFullDetails: t('viewFullDetails'),
        publicTrackingLink: t('publicTrackingLink'),
        emptyInvoices: tFull('emptyInvoices'),
        emptyVouchers: tFull('emptyVouchers'),
        viewPayments: tFull('viewPayments'),
        viewReceiptVouchers: tFull('viewReceiptVouchers'),
        invoiceNo: tFull('invoiceNo'),
        voucherNo: tFull('voucherNo'),
        kindDeposit: tInvoices('history.kind_deposit'),
        kindPos: tInvoices('history.kind_pos'),
        recordPaymentTitle: tInvoices('recordPayment.title'),
        recordPaymentAmount: tInvoices('recordPayment.amount'),
        recordPaymentMethod: tInvoices('recordPayment.paymentMethod'),
        recordPaymentCash: tInvoices('recordPayment.cash'),
        recordPaymentCard: tInvoices('recordPayment.card'),
        recordPaymentSubmit: tInvoices('recordPayment.submit'),
        recordPaymentProcessing: tInvoices('recordPayment.processing'),
        recordPaymentCancel: tInvoices('recordPayment.cancel'),
        recordPaymentSuccess: tInvoices('recordPayment.success'),
        recordPaymentError: tInvoices('recordPayment.error'),
        emptyEditHistory: tFull('editHistory.empty'),
        editHistoryTitle: tFull('editHistory.title'),
        editNo: tFull('editHistory.editNo'),
        editedBy: tFull('editHistory.editedBy'),
        editedAt: tFull('editHistory.editedAt'),
        changeSummary: tFull('editHistory.changeSummary'),
        fieldChanges: tFull('editHistory.fieldChanges'),
        itemChanges: tFull('editHistory.itemChanges'),
        pricingChanges: tFull('editHistory.pricingChanges'),
        paymentAdjustment: tFull('editHistory.paymentAdjustment'),
        fieldName: tFull('editHistory.fieldName'),
        oldValue: tFull('editHistory.oldValue'),
        newValue: tFull('editHistory.newValue'),
        itemAdded: tFull('editHistory.itemAdded'),
        itemRemoved: tFull('editHistory.itemRemoved'),
        itemModified: tFull('editHistory.itemModified'),
        oldSubtotal: tFull('editHistory.oldSubtotal'),
        newSubtotal: tFull('editHistory.newSubtotal'),
        oldTotal: tFull('editHistory.oldTotal'),
        newTotal: tFull('editHistory.newTotal'),
        difference: tFull('editHistory.difference'),
        noChangesRecorded: tFull('editHistory.noChangesRecorded'),
        charge: tFull('editHistory.charge'),
        refund: tFull('editHistory.refund'),
        ipAddress: tFull('editHistory.ipAddress'),
        viewDetails: tFull('editHistory.viewDetails'),
        hideDetails: tFull('editHistory.hideDetails'),
        qty: tFull('editHistory.qty'),
        price: tFull('editHistory.price'),
        totalPrice: tFull('editHistory.totalPrice'),
        stain: tFull('editHistory.stain'),
        damage: tFull('editHistory.damage'),
        stainNotes: tFull('editHistory.stainNotes'),
        damageNotes: tFull('editHistory.damageNotes'),
        commonYes: 'Yes',
        commonNo: 'No',
      }}
      locale={locale as 'en' | 'ar'}
    />
  );
}

/**
 *
 * @param root0
 * @param root0.params
 * @param root0.searchParams
 */
export default async function OrderDetailPage({ params, searchParams }: OrderDetailPageProps) {
  const { id } = await params;
  const search = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      }
    >
      <OrderDetailContent orderId={id} searchParams={search} />
    </Suspense>
  );
}
