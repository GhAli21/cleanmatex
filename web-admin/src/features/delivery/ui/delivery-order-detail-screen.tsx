'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useHasAllPermissions, useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { Alert, CmxSpinner } from '@ui/primitives';
import { WorkflowActionBar } from '@features/workflow/ui/WorkflowActionBar';
import { OrderCollectPaymentModal } from '@features/orders/ui/collect-payment/order-collect-payment-modal';
import { DeliveryHandoverCard } from '@features/delivery/ui/delivery-handover-card';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens';
import { getOrderFromStateResponse, mapOrderCustomerFromStateRow } from '@/lib/utils/order-state-response';
import { resolveSafeDashboardReturnUrl } from '@/lib/utils/safe-dashboard-return-url';

interface DeliveryFloorOrder {
  id: string;
  orderNo: string;
  customerId?: string | null;
  branchId?: string | null;
  currencyCode: string;
  paymentTypeCode?: string | null;
  outstandingAmount: number;
  customer: { name: string; phone: string };
}

/**
 * Delivery floor detail — same action-bar + stage-owned complete pattern as Ready.
 */
export function DeliveryOrderDetailScreen() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const { formatMoneyWithCode } = useTenantCurrency();
  const canCollectPayment = useHasPermissionCode('orders:collect_payment');
  const canCompleteDelivery = useHasAllPermissions(['delivery:pod', 'orders:transition']);
  const orderId = params.id;
  const returnUrl = resolveSafeDashboardReturnUrl(searchParams.get('returnUrl'), '/dashboard/delivery');

  const [order, setOrder] = useState<DeliveryFloorOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [actionBarKey, setActionBarKey] = useState(0);

  const loadOrder = useCallback(async () => {
    if (!currentTenant || !orderId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/orders/${orderId}/state`);
      const json = await response.json() as {
        success?: boolean;
        error?: string;
        paymentSummary?: { remaining?: number };
      };
      const rawOrder = getOrderFromStateResponse(json);
      if (!rawOrder || typeof rawOrder !== 'object') {
        setError(json.error || t('delivery.messages.loadFailed'));
        return;
      }
      const raw = rawOrder as Record<string, unknown>;
      const remaining = Number(
        json.paymentSummary?.remaining ?? raw.outstanding_amount ?? 0,
      );
      const orgCustomer = raw.org_customers_mst as { id?: string } | Array<{ id?: string }> | null;
      setOrder({
        id: String(raw.id),
        orderNo: String(raw.order_no ?? ''),
        customerId: Array.isArray(orgCustomer) ? orgCustomer[0]?.id : orgCustomer?.id,
        branchId: (raw.branch_id as string | null | undefined) ?? null,
        currencyCode: String(raw.currency_code || 'OMR'),
        paymentTypeCode: (raw.payment_type_code as string | null | undefined) ?? null,
        outstandingAmount: Number.isFinite(remaining) ? remaining : 0,
        customer: mapOrderCustomerFromStateRow(raw),
      });
    } catch {
      setError(t('delivery.messages.loadFailed'));
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
    return (
      <Alert variant="error" message={error || t('delivery.messages.notFound')} />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <Link href={returnUrl} className="mb-2 inline-block text-blue-600 hover:underline">
          ← {t('delivery.actions.backToDelivery')}
        </Link>
        <h1 className="text-3xl font-bold">
          {t('screens.delivery')} - {order.orderNo}
        </h1>
        <p className="mt-1 text-gray-600">
          {order.customer.name} • {order.customer.phone}
        </p>
      </div>

      {error ? <Alert variant="error" message={error} /> : null}

      <DeliveryHandoverCard
        key={`delivery-handover-${actionBarKey}`}
        orderId={orderId}
        orderNo={order.orderNo}
        customerName={order.customer.name}
        paymentTypeCode={order.paymentTypeCode}
        outstandingAmount={order.outstandingAmount}
        formattedOutstandingAmount={formatMoneyWithCode(order.outstandingAmount)}
        canComplete={canCompleteDelivery}
        onCollectPayment={() => setCollectOpen(true)}
        onCompleted={() => {
          setActionBarKey((key) => key + 1);
          router.replace(returnUrl);
        }}
      />

      <WorkflowActionBar
        key={`delivery-actions-${actionBarKey}`}
        orderId={orderId}
        screen={WORKFLOW_SCREENS.DRIVER_DELIVERY}
        hideWhenEmpty
        emptyBackHref={returnUrl}
        hiddenActionCodes={[WORKFLOW_ACTIONS.CONFIRM_DELIVERY]}
        onActionSuccess={() => {
          void loadOrder();
        }}
      />

      {collectOpen && canCollectPayment ? (
        <OrderCollectPaymentModal
          open
          onOpenChange={(open) => {
            if (!open) setCollectOpen(false);
          }}
          orderId={order.id}
          customerId={order.customerId}
          branchId={order.branchId}
          outstandingAmount={order.outstandingAmount}
          currencyCode={order.currencyCode}
          onCollected={() => {
            setCollectOpen(false);
            void loadOrder();
            setActionBarKey((key) => key + 1);
          }}
        />
      ) : null}
    </div>
  );
}
