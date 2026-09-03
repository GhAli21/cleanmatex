'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { Alert, CmxSpinner } from '@ui/primitives';
import { WorkflowActionBar } from '@features/workflow/ui/WorkflowActionBar';
import { HomeCollectionHandoverCard } from '@features/home-collection/ui/home-collection-handover-card';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens';
import { getOrderFromStateResponse, mapOrderCustomerFromStateRow } from '@/lib/utils/order-state-response';
import { resolveSafeDashboardReturnUrl } from '@/lib/utils/safe-dashboard-return-url';

interface HomeCollectionFloorOrder {
  id: string;
  orderNo: string;
  customer: { name: string; phone: string };
}

export function HomeCollectionOrderDetailScreen() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('workflow.homeCollection');
  const tWorkflow = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const orderId = params.id;
  const returnUrl = resolveSafeDashboardReturnUrl(
    searchParams.get('returnUrl'),
    '/dashboard/home-collection',
  );

  const [order, setOrder] = useState<HomeCollectionFloorOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBarKey, setActionBarKey] = useState(0);

  const loadOrder = useCallback(async () => {
    if (!currentTenant || !orderId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/state`);
      const json = await response.json() as { success?: boolean; error?: string };
      const rawOrder = getOrderFromStateResponse(json);
      if (!rawOrder || typeof rawOrder !== 'object') {
        setError(json.error || t('messages.loadFailed'));
        return;
      }
      const raw = rawOrder as Record<string, unknown>;
      setOrder({
        id: String(raw.id),
        orderNo: String(raw.order_no ?? ''),
        customer: mapOrderCustomerFromStateRow(raw),
      });
    } catch {
      setError(t('messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [currentTenant, orderId, t]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <CmxSpinner size="lg" />
      </div>
    );
  }

  if (!order || !orderId) {
    return <Alert variant="error" message={error || t('messages.notFound')} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <Link href={returnUrl} className="mb-2 inline-block text-blue-600 hover:underline">
          ← {t('actions.backToList')}
        </Link>
        <h1 className="text-3xl font-bold">
          {tWorkflow('screens.homeCollection')} - {order.orderNo}
        </h1>
        <p className="mt-1 text-gray-600">
          {order.customer.name} • {order.customer.phone}
        </p>
      </div>

      {error ? <Alert variant="error" message={error} /> : null}

      <RequireAnyPermission permissions={[ORDERS_PERMISSIONS.TRANSITION]}>
        <HomeCollectionHandoverCard
          key={`hc-handover-${actionBarKey}`}
          orderId={orderId}
          orderNo={order.orderNo}
          customerName={order.customer.name}
          onCompleted={() => {
            setActionBarKey((key) => key + 1);
            router.replace(returnUrl);
          }}
        />

        <WorkflowActionBar
          key={`hc-actions-${actionBarKey}`}
          orderId={orderId}
          screen={WORKFLOW_SCREENS.HOME_COLLECTION}
          hideWhenEmpty
          emptyBackHref={returnUrl}
          hiddenActionCodes={[WORKFLOW_ACTIONS.CONFIRM_HOME_COLLECTION]}
          onActionSuccess={() => {
            void loadOrder();
          }}
        />
      </RequireAnyPermission>
    </div>
  );
}
