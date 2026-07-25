import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PublicOrderTrackingPage } from '@/src/features/orders/public/order-tracking-page';
import { resolvePublicTrackingTokenByOrderRef } from '@/lib/services/public-order-tracking.service';
import { buildPublicTrackingPath } from '@/lib/utils/public-order-tracking';

interface PublicOrderPageProps {
  params: Promise<{
    tenantId: string;
    orderNo: string;
  }>;
}

/**
 *
 * @param root0
 * @param root0.params
 */
export default async function PublicOrderPage({ params }: PublicOrderPageProps) {
  const { tenantId, orderNo } = await params;

  const publicTrackingToken = await resolvePublicTrackingTokenByOrderRef({
    tenantId,
    orderNo,
  });

  if (publicTrackingToken) {
    redirect(buildPublicTrackingPath(publicTrackingToken));
  }

  // Ensure i18n messages are loaded for this page
  await getTranslations('publicOrderTracking');
  await getLocale();

  return (
    <PublicOrderTrackingPage
      lookupPath={`/api/v1/public/orders/${encodeURIComponent(tenantId)}/${encodeURIComponent(orderNo)}`}
      confirmPath={`/api/v1/public/orders/${encodeURIComponent(tenantId)}/${encodeURIComponent(orderNo)}/confirm-received`}
    />
  );
}


