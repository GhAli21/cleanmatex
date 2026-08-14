/**
 * OrderActions Component
 * Status change actions with full API integration
 * PRD-005: Basic Workflow & Status Transitions
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  XCircle,
  Wrench,
  RotateCcw,
  Edit,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { CmxButton } from '@ui/primitives/cmx-button';
import { FixOrderDataModal } from './fix-order-data-modal';
import { CancelOrderDialog } from './cancel-order-dialog';
import { CustomerReturnOrderDialog } from './customer-return-order-dialog';
import { WorkflowActionBar } from '@features/workflow/ui/WorkflowActionBar';
import {
  canCancelOrder,
  canReturnOrder,
} from '@/lib/constants/workflow-cancel-return';

interface OrderActionsProps {
  order: {
    id: string;
    status: string;
    tenant_org_id: string;
    preparation_status?: string | null;
  };
}

/**
 *
 * @param root0
 * @param root0.order
 */
export function OrderActions({ order }: OrderActionsProps) {
  const router = useRouter();
  const t = useTranslations('orders.actions');
  const tEngine = useTranslations('workflow.engine');
  const isRTL = useRTL();
  const canTransition = useHasPermissionCode('orders:transition');
  const canUpdate = useHasPermissionCode('orders:update');
  const [showFixOrderDataModal, setShowFixOrderDataModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);

  const currentStatus = (order.status || '').toLowerCase();
  const prepStatus = order.preparation_status ?? null;

  return (
    <>
      <div className="space-y-2">
        {/* Hold / resume / stop (engine V2 order_control) */}
        {canTransition ? (
          <WorkflowActionBar
            orderId={order.id}
            screen="order_control"
            hideWhenEmpty
            title={tEngine('orderControlTitle')}
            onActionSuccess={() => router.refresh()}
          />
        ) : null}

        {/* Customer Return — V1.1 deferred (canReturnOrder always false for now) */}
        {canTransition && canReturnOrder(currentStatus) && (
            <CmxButton
              onClick={() => setShowReturnDialog(true)}
              variant="outline"
              className={`w-full border-amber-300 text-amber-700 hover:bg-amber-50 ${isRTL ? 'flex-row-reverse' : ''}`}
              size="lg"
            >
              <RotateCcw className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('buttons.customerReturn')}
            </CmxButton>
          )}

        {/* Cancel — draft / intake / incomplete preparing only */}
        {canTransition && canCancelOrder(currentStatus, prepStatus) && (
            <CmxButton
              onClick={() => setShowCancelDialog(true)}
              variant="outline"
              className={`w-full border-red-300 text-red-700 hover:bg-red-50 ${isRTL ? 'flex-row-reverse' : ''}`}
              size="lg"
            >
              <XCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('buttons.cancelOrder')}
            </CmxButton>
          )}

        {/* Edit Order - for draft/intake/preparation status */}
        {canUpdate && (['draft', 'intake', 'preparation', 'preparing'] as const).some(
          (status) => status === currentStatus,
        ) && (
          <CmxButton
            variant="outline"
            onClick={() => router.push(`/dashboard/orders/${order.id}/edit`)}
            className={`w-full border-blue-300 text-blue-700 hover:bg-blue-50 ${isRTL ? 'flex-row-reverse' : ''}`}
            size="lg"
          >
            <Edit className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('buttons.editOrder')}
          </CmxButton>
        )}

        {canUpdate ? (
          <CmxButton
            variant="outline"
            onClick={() => setShowFixOrderDataModal(true)}
            className={`w-full border-gray-300 text-gray-700 hover:bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}
            size="lg"
          >
            <Wrench className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('buttons.fixOrderData')}
          </CmxButton>
        ) : null}
      </div>

      {canUpdate ? (
        <FixOrderDataModal
          orderId={order.id}
          open={showFixOrderDataModal}
          onOpenChange={setShowFixOrderDataModal}
          onSuccess={() => {
            router.refresh();
            setShowFixOrderDataModal(false);
          }}
        />
      ) : null}

      <CancelOrderDialog
        orderId={order.id}
        tenantOrgId={order.tenant_org_id}
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onSuccess={() => router.refresh()}
      />

      <CustomerReturnOrderDialog
        orderId={order.id}
        tenantOrgId={order.tenant_org_id}
        open={showReturnDialog}
        onOpenChange={setShowReturnDialog}
        onSuccess={() => router.refresh()}
      />
    </>
  );
}
