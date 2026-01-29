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
  const { tenantId } = await getAuthContext();
  const t = await getTranslations('orders.detail');
  const locale = await getLocale();

  // Fetch order with tenant context
  const result = await getOrder(tenantId, orderId);

  if (!result.success || !result.data) {
    notFound();
  }

  const order = result.data;

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

  return (
    <OrderDetailClient 
      order={serializedOrder} 
      returnUrl={searchParams?.returnUrl}           // ✅ Pass returnUrl
      returnLabel={searchParams?.returnLabel}       // ✅ Pass returnLabel
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
