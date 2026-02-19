import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import { getOrder } from '@/app/actions/orders/get-order';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getPaymentsForOrder } from '@/app/actions/payments/process-payment';
import { getOrderInvoices } from '@/app/actions/payments/invoice-actions';
import { OrderDetailClient } from './order-detail-client';

interface OrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    returnUrl?: string;
    returnLabel?: string;
  }>;
}

async function OrderDetailContent({
  orderId,
  searchParams
}: {
  orderId: string;
  searchParams: { returnUrl?: string; returnLabel?: string };
}) {
  // Get authenticated user and tenant context
  const { tenantId, userId } = await getAuthContext();
  const t = await getTranslations('orders.detail');
  const locale = await getLocale();

  const { processPayment } = await import('@/app/actions/payments/process-payment');
  const { applyPaymentToInvoice } = await import('@/app/actions/payments/process-payment');

  // Fetch order, payments for order, and order invoices
  const [orderResult, paymentsResult, invoicesResult] = await Promise.all([
    getOrder(tenantId, orderId),
    getPaymentsForOrder(orderId),
    getOrderInvoices(orderId),
  ]);

  if (!orderResult.success || !orderResult.data) {
    notFound();
  }

  const order = orderResult.data;
  const allPayments = paymentsResult.success && paymentsResult.data ? paymentsResult.data : [];
  const unappliedPayments = allPayments.filter((p) => !p.invoice_id);
  const orderInvoices = invoicesResult.success && invoicesResult.data ? invoicesResult.data : [];

  // Serialize Decimal fields to numbers for Client Component
  // Next.js cannot serialize Decimal objects from Supabase/PostgreSQL
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
    // Serialize items if they exist - convert all Decimal fields
    items: order.items?.map((item: any) => {
      const serializedItem: any = { ...item };
      // Convert all numeric fields that might be Decimal
      if (item.price_per_unit !== undefined && item.price_per_unit !== null) {
        serializedItem.price_per_unit = Number(item.price_per_unit);
      }
      if (item.total_price !== undefined && item.total_price !== null) {
        serializedItem.total_price = Number(item.total_price);
      }
      if (item.quantity !== undefined && item.quantity !== null) {
        serializedItem.quantity = Number(item.quantity);
      }
      if (item.quantity_ready !== undefined && item.quantity_ready !== null) {
        serializedItem.quantity_ready = Number(item.quantity_ready);
      }
      return serializedItem;
    }) || [],
  };

  const tInvoices = await getTranslations('invoices');

  return (
    <OrderDetailClient 
      order={serializedOrder}
      unappliedPayments={unappliedPayments}
      orderInvoices={orderInvoices}
      tenantOrgId={tenantId}
      userId={userId ?? ''}
      processPaymentAction={processPayment}
      applyPaymentToInvoiceAction={applyPaymentToInvoice}
      returnUrl={searchParams?.returnUrl}
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

export default async function OrderDetailPage({ params, searchParams }: OrderDetailPageProps) {
  const { id } = await params;
  const search = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <OrderDetailContent orderId={id} searchParams={search} />
    </Suspense>
  );
}
