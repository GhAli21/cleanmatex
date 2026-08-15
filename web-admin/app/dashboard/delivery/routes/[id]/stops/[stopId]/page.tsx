'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Alert, CmxButton, CmxSpinner } from '@ui/primitives';
import { CmxEmptyState } from '@ui/data-display';
import { RequireAllPermissions } from '@features/auth/ui/RequirePermission';
import { DeliveryStopDetail } from '@features/delivery/ui/delivery-stop-detail';
import type { DeliveryStopView } from '@/lib/services/delivery/delivery-route-query.service';

interface ApiResponse {
  success: boolean;
  data?: DeliveryStopView;
  error?: string;
}

export default function DeliveryStopPage() {
  return (
    <RequireAllPermissions permissions={['drivers:read', 'orders:read']}>
      <DeliveryStopPageContent />
    </RequireAllPermissions>
  );
}

function DeliveryStopPageContent() {
  const params = useParams<{ id: string; stopId: string }>();
  const t = useTranslations('workflow.delivery');
  const { data, error, isLoading } = useQuery<ApiResponse>({
    queryKey: ['delivery', 'stop', params.stopId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/delivery/stops/${params.stopId}`);
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.success) throw new Error(payload.error ?? t('stopDetail.loadFailed'));
      return payload;
    },
  });

  if (isLoading) {
    return <div className="flex min-h-80 items-center justify-center"><CmxSpinner size="lg" /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <CmxButton variant="ghost" asChild>
        <Link href={`/dashboard/delivery/routes/${params.id}`}><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />{t('stopDetail.backToRoute')}</Link>
      </CmxButton>
      {error instanceof Error ? <Alert variant="error" message={error.message} /> : null}
      {data?.data ? <DeliveryStopDetail stop={data.data} /> : !error ? <CmxEmptyState title={t('stopDetail.notFound')} /> : null}
    </div>
  );
}
