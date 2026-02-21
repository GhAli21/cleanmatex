import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import { getOrder } from '@/app/actions/orders/get-order';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getPaymentsForOrder } from '@/app/actions/payments/process-payment';
import { getOrderInvoices } from '@/app/actions/payments/invoice-actions';
import { getVouchersForOrder } from '@/lib/services/voucher-service';
import { getStockTransactionsForOrder } from '@/lib/services/inventory-service';
import { ReceiptService } from '@/lib/services/receipt-service';
import { OrderDetailsFullClient } from './order-details-full-client';

interface OrderDetailsFullPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    returnUrl?: string;
    returnLabel?: string;
    tab?: string;
    invoiceId?: string;
    voucherId?: string;
  }>;
}

async function OrderDetailsFullContent({
  orderId,
  searchParams,
}: {
  orderId: string;
  searchParams: {
    returnUrl?: string;
    returnLabel?: string;
    tab?: string;
    invoiceId?: string;
    voucherId?: string;
  };
}) {
  const { tenantId, userId } = await getAuthContext();
  const t = await getTranslations('orders.detail');
  const tFull = await getTranslations('orders.detailFull');
  const locale = await getLocale();

  const { processPayment } = await import('@/app/actions/payments/process-payment');
  const { applyPaymentToInvoice } = await import('@/app/actions/payments/process-payment');

  const [
    orderResult,
    paymentsResult,
    invoicesResult,
    vouchersResult,
    stockResult,
    receiptsResult,
  ] = await Promise.all([
    getOrder(tenantId, orderId),
    getPaymentsForOrder(orderId),
    getOrderInvoices(orderId),
    getVouchersForOrder(orderId),
    getStockTransactionsForOrder(orderId),
    ReceiptService.getReceipts({ orderId, tenantId }),
  ]);

  if (!orderResult.success || !orderResult.data) {
    notFound();
  }

  const order = orderResult.data;
  const allPayments = paymentsResult.success && paymentsResult.data ? paymentsResult.data : [];
  const unappliedPayments = allPayments.filter((p) => !p.invoice_id);
  const orderInvoices = invoicesResult.success && invoicesResult.data ? invoicesResult.data : [];
  const vouchers = vouchersResult ?? [];
  const stockTransactions = stockResult ?? [];
  const receipts = receiptsResult ?? [];

  const serializedOrder = {
    ...order,
    subtotal: order.subtotal ? Number(order.subtotal) : 0,
    discount: order.discount ? Number(order.discount) : 0,
    tax: order.tax ? Number(order.tax) : 0,
    total: order.total ? Number(order.total) : 0,
    paid_amount: order.paid_amount ? Number(order.paid_amount) : null,
    bag_count: order.bag_count ? Number(order.bag_count) : null,
    priority_multiplier:
      order.priority_multiplier !== undefined && order.priority_multiplier !== null
        ? Number(order.priority_multiplier)
        : null,
    items: order.items?.map((item: Record<string, unknown>) => {
      const serializedItem = { ...item };
      if (item.price_per_unit != null) serializedItem.price_per_unit = Number(item.price_per_unit);
      if (item.total_price != null) serializedItem.total_price = Number(item.total_price);
      if (item.quantity != null) serializedItem.quantity = Number(item.quantity);
      if (item.quantity_ready != null) serializedItem.quantity_ready = Number(item.quantity_ready);
      return serializedItem;
    }) ?? [],
  };

  const tInvoices = await getTranslations('invoices');

  return (
    <OrderDetailsFullClient
      order={serializedOrder}
      allPayments={allPayments}
      unappliedPayments={unappliedPayments}
      orderInvoices={orderInvoices}
      vouchers={vouchers}
      stockTransactions={stockTransactions}
      receipts={receipts}
      tenantOrgId={tenantId}
      userId={userId ?? ''}
      processPaymentAction={processPayment}
      applyPaymentToInvoiceAction={applyPaymentToInvoice}
      initialTab={searchParams?.tab}
      initialInvoiceId={searchParams?.invoiceId}
      initialVoucherId={searchParams?.voucherId}
      returnUrl={searchParams?.returnUrl ?? `/dashboard/orders/${orderId}`}
      returnLabel={searchParams?.returnLabel}
      translations={{
        ...Object.fromEntries(
          [
            'backToOrders',
            'edit',
            'totalAmount',
            'paid',
            'pendingPayment',
            'preparationStatus',
            'startPreparation',
            'continuePreparation',
            'completed',
            'numberOfBags',
            'qrCode',
            'retail',
            'customerInformation',
            'name',
            'phone',
            'email',
            'address',
            'loyaltyPoints',
            'points',
            'orderItems',
            'notes',
            'customerNotes',
            'internalNotes',
            'photos',
            'orderTimeline',
            'quickActions',
            'paymentDetails',
            'subtotal',
            'discount',
            'tax',
            'total',
            'paidAmount',
            'balance',
            'paymentMethod',
            'received',
            'readyBy',
            'unappliedPayments',
            'applyToInvoice',
            'noUnappliedPayments',
            'recordDepositPos',
            'selectInvoiceToApply',
            'paymentKind',
          ].map((k) => [k, t(k)])
        ),
        viewFullDetails: tFull('viewFullDetails'),
        backToSimpleView: tFull('backToSimpleView'),
        noActionsForClosedOrder: tFull('noActionsForClosedOrder'),
        tabsMaster: tFull('tabs.master'),
        tabsItems: tFull('tabs.items'),
        tabsHistory: tFull('tabs.history'),
        tabsInvoices: tFull('tabs.invoices'),
        tabsVouchers: tFull('tabs.vouchers'),
        tabsPayments: tFull('tabs.payments'),
        tabsStock: tFull('tabs.stock'),
        tabsReceipts: tFull('tabs.receipts'),
        tabsActions: tFull('tabs.actions'),
        orderSummary: tFull('orderSummary'),
        viewPayments: tFull('viewPayments'),
        viewReceiptVouchers: tFull('viewReceiptVouchers'),
        emptyInvoices: tFull('emptyInvoices'),
        emptyVouchers: tFull('emptyVouchers'),
        emptyPayments: tFull('emptyPayments'),
        emptyStock: tFull('emptyStock'),
        emptyReceipts: tFull('emptyReceipts'),
        searchByInvoiceId: tFull('searchByInvoiceId'),
        searchByVoucherId: tFull('searchByVoucherId'),
        invoiceNo: tFull('invoiceNo'),
        voucherNo: tFull('voucherNo'),
        paymentId: tFull('paymentId'),
        invoiceId: tFull('invoiceId'),
        voucherId: tFull('voucherId'),
        transactionId: tFull('transactionId'),
        gateway: tFull('gateway'),
        notes: tFull('notes'),
        masterSectionOrderIdentity: tFull('masterSections.orderIdentity'),
        masterSectionCustomerReference: tFull('masterSections.customerReference'),
        masterSectionFinancial: tFull('masterSections.financial'),
        masterSectionPayment: tFull('masterSections.payment'),
        masterSectionDatesAndTimeline: tFull('masterSections.datesAndTimeline'),
        masterSectionPreparationAndWorkflow: tFull('masterSections.preparationAndWorkflow'),
        masterSectionNotes: tFull('masterSections.notes'),
        masterSectionOther: tFull('masterSections.other'),
        masterCustomerData: tFull('masterCustomerData'),
        masterItemsCount: tFull('masterItemsCount'),
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
      }}
      locale={locale as 'en' | 'ar'}
    />
  );
}

export default async function OrderDetailsFullPage({ params, searchParams }: OrderDetailsFullPageProps) {
  const { id } = await params;
  const search = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <OrderDetailsFullContent orderId={id} searchParams={search} />
    </Suspense>
  );
}
