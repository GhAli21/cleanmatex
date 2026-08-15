'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Alert, CmxButton, CmxSpinner } from '@ui/primitives';
import { CmxEmptyState } from '@ui/data-display';
import { RequireAllPermissions } from '@features/auth/ui/RequirePermission';
import { DeliveryRouteManifest } from '@features/delivery/ui/delivery-route-manifest';
import type { DeliveryRouteManifest as DeliveryRouteManifestData } from '@/lib/services/delivery/delivery-route-query.service';

interface ApiResponse {
  success: boolean;
  data?: DeliveryRouteManifestData;
  error?: string;
}

export default function DeliveryRoutePage() {
  return (
    <RequireAllPermissions permissions={['drivers:read', 'orders:read']}>
      <DeliveryRoutePageContent />
    </RequireAllPermissions>
  );
}

function DeliveryRoutePageContent() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('workflow.delivery');
  const routeId = params.id;
  const { data, error, isLoading } = useQuery<ApiResponse>({
    queryKey: ['delivery', 'route-manifest', routeId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/delivery/routes/${routeId}`);
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.success) throw new Error(payload.error ?? t('manifest.loadFailed'));
      return payload;
    },
  });

  if (isLoading) {
    return <div className="flex min-h-80 items-center justify-center"><CmxSpinner size="lg" /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <CmxButton variant="ghost" asChild>
        <Link href="/dashboard/delivery"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />{t('manifest.backToDelivery')}</Link>
      </CmxButton>
      {error instanceof Error ? <Alert variant="error" message={error.message} /> : null}
      {data?.data ? <DeliveryRouteManifest route={data.data} /> : !error ? <CmxEmptyState title={t('manifest.notFound')} /> : null}
    </div>
  );
}
