import { getLocale, getTranslations } from 'next-intl/server';
import { PublicOrderTrackingPage } from '@/src/features/orders/public/order-tracking-page';

interface PublicOrderTokenPageProps {
  params: Promise<{
    token: string;
  }>;
}

/**
 * Opaque public tracking page entrypoint.
 *
 * @param root0 Route params wrapper.
 * @param root0.params Promise-wrapped route params.
 */
export default async function PublicOrderTokenPage({ params }: PublicOrderTokenPageProps) {
  const { token } = await params;

  await getTranslations('publicOrderTracking');
  await getLocale();

  return (
    <PublicOrderTrackingPage
      lookupPath={`/api/v1/public/track/${encodeURIComponent(token)}`}
      confirmPath={`/api/v1/public/track/${encodeURIComponent(token)}/confirm-received`}
    />
  );
}
