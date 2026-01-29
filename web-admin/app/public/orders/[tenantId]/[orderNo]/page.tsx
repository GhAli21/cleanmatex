import { getLocale, getTranslations } from 'next-intl/server';
import { PublicOrderTrackingPage } from '@/src/features/orders/public/order-tracking-page';

interface PublicOrderPageProps {
  params: Promise<{
    tenantId: string;
    orderNo: string;
  }>;
}

export default async function PublicOrderPage({ params }: PublicOrderPageProps) {
  const { tenantId, orderNo } = await params;

  // Ensure i18n messages are loaded for this page
  await getTranslations('publicOrderTracking');
  await getLocale();

  return <PublicOrderTrackingPage tenantId={tenantId} orderNo={orderNo} />;
}


