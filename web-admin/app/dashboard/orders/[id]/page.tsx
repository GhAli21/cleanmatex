import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import { getOrder } from '@/app/actions/orders/get-order';
import { getAuthContext } from '@/lib/auth/server-auth';
import { OrderDetailClient } from './order-detail-client';

interface OrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function OrderDetailContent({ orderId }: { orderId: string }) {
  // Get authenticated user and tenant context
  const { tenantId } = await getAuthContext();
  const t = await getTranslations('orders.detail');
  const locale = await getLocale();

  // Fetch order with tenant context
  const result = await getOrder(tenantId, orderId);

  if (!result.success || !result.data) {
    notFound();
  }

  const order = result.data;

  return (
    <OrderDetailClient 
      order={order} 
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
      }}
      locale={locale as 'en' | 'ar'}
    />
  );
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <OrderDetailContent orderId={id} />
    </Suspense>
  );
}
