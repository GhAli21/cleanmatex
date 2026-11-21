/**
 * Assembly Screen - List Page
 * Shows orders based on screen contract for "assembly"
 */

'use client';

import { CmxCodeChip, CmxEmptyState, CmxKpiStatCard } from '@ui/data-display';
import { CMX_DEFAULT_PAGE_SIZE, CMX_PAGE_SIZE_OPTIONS } from '@ui/data-display/cmx-table-defaults';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useScreenOrders } from '@/lib/hooks/use-screen-orders';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useAssemblyDashboard, useCreateAssemblyTask } from '@/src/features/assembly/hooks/use-assembly';
import { AssemblyTaskModal } from '@/src/features/assembly/ui/assembly-task-modal';
import { CmxStatusBadge, CmxSummaryMessage } from '@ui/feedback';
import { useMessage } from '@ui/feedback/useMessage';
import { CmxPagination } from '@ui/navigation';
import { CmxButton, CmxSkeleton } from '@ui/primitives';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AssemblyOrder {
  id: string;
  order_no: string;
  customer: { name: string; phone: string };
  total_items: number;
  current_status: string;
}

/**
 *
 */
export default function AssemblyPage() {
  const t = useTranslations('workflow');
  const tCommon = useTranslations('common');
  const { currentTenant } = useAuth();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const { showSuccess, showError: showErrorMsg } = useMessage();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(CMX_DEFAULT_PAGE_SIZE);
  const [creatingOrderId, setCreatingOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderNo, setSelectedOrderNo] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: dashboardData } = useAssemblyDashboard();
  const { mutateAsync: createTask } = useCreateAssemblyTask();

  const { orders: rawOrders, pagination, isLoading, isFetching, error, refetch } = useScreenOrders<any>('assembly', {
    page,
    limit: pageSize,
    enabled: !!currentTenant,
    useOldWfCodeOrNew: useNewWorkflowSystem,
    fallbackStatuses: ['ready', 'assembly'],
  });

  const orders: AssemblyOrder[] = useMemo(() => {
    return (rawOrders ?? []).map((order: any) => ({
      id: order.id,
      order_no: order.order_no,
      total_items: order.total_items || 0,
      current_status: order.current_status || order.status || 'assembly',
      customer: {
        name: order.customer?.name || t('assembly.unknownCustomer'),
        phone: order.customer?.phone || t('assembly.phoneUnavailable'),
      },
    }));
  }, [rawOrders, t]);

  const handleAssembleOrder = async (
    order: AssemblyOrder,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    setCreatingOrderId(order.id);
    try {
      const result = await createTask(order.id);
      if (result.success && result.taskId) {
        setSelectedOrderId(order.id);
        setSelectedOrderNo(order.order_no);
        setSelectedTaskId(result.taskId);
        showSuccess(t('assembly.messages.taskCreated'));
      }
    } catch (err: unknown) {
      showErrorMsg(
        err instanceof Error
          ? err.message
          : t('assembly.messages.taskCreateFailed')
      );
    } finally {
      setCreatingOrderId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-6">
        <CmxSkeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CmxSkeleton className="h-44 w-full" />
          <CmxSkeleton className="h-44 w-full" />
          <CmxSkeleton className="h-44 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('screens.assembly')}</h1>
          <p className="text-muted-foreground mt-1">{t('assembly.description')}</p>
        </div>
        <CmxButton
          type="button"
          variant="outline"
          size="sm"
          loading={isFetching}
          onClick={() => void refetch()}
        >
          {tCommon('refresh')}
        </CmxButton>
      </div>

      {dashboardData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <CmxKpiStatCard title={t('assembly.stats.pending')} value={dashboardData.pendingTasks} icon={<Package className="h-5 w-5" aria-hidden="true" />} />
          <CmxKpiStatCard title={t('assembly.stats.inProgress')} value={dashboardData.inProgressTasks} icon={<Package className="h-5 w-5" aria-hidden="true" />} />
          <CmxKpiStatCard title={t('assembly.stats.qaPending')} value={dashboardData.qaPendingTasks} icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} />
          <CmxKpiStatCard title={t('assembly.stats.completedToday')} value={dashboardData.completedToday} icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} />
          <CmxKpiStatCard title={t('assembly.stats.openExceptions')} value={dashboardData.exceptionsOpen} icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />} />
        </div>
      )}

      {error && (
        <div className="mb-6 space-y-2">
          <CmxSummaryMessage type="error" message={error} />
          <CmxButton type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            {tCommon('retry')}
          </CmxButton>
        </div>
      )}

      {orders.length === 0 ? (
        <CmxEmptyState title={t('assembly.empty')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <CmxCard key={order.id} className="hover:shadow-lg transition-all">
              <CmxCardContent className="p-6">
                <div className="flex justify-between items-start gap-2 mb-4">
                  <Link
                    href={`/dashboard/assembly/${order.id}?returnUrl=${encodeURIComponent('/dashboard/assembly')}`}
                    className="text-xl font-bold text-primary-text hover:underline"
                  >
                    <CmxCodeChip code={order.order_no} kind="order" size="md" copyable={false} />
                  </Link>
                  <CmxStatusBadge
                    size="sm"
                    tone="neutral"
                    label={`${order.total_items} ${t('assembly.items')}`}
                  />
                </div>

                <div className="space-y-2 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('labels.customer')}:</span>
                    <span>{order.customer.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t('labels.phone')}:</span>
                    <bdi dir="ltr" className="tabular-nums">{order.customer.phone}</bdi>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <CmxButton
                    className="w-full"
                    onClick={(e) => handleAssembleOrder(order, e)}
                    loading={creatingOrderId === order.id}
                    disabled={creatingOrderId !== null}
                  >
                    <Package className="h-4 w-4 me-2" aria-hidden="true" />
                    {t('assembly.actions.assembleOrder')}
                  </CmxButton>
                </div>
              </CmxCardContent>
            </CmxCard>
          ))}
        </div>
      )}

      <div className="mt-6">
        <CmxPagination
          currentPage={pagination.page}
          totalPages={Math.max(1, pagination.totalPages)}
          pageSize={pageSize}
          totalItems={pagination.total}
          pageSizeOptions={[...CMX_PAGE_SIZE_OPTIONS]}
          onPageChange={(nextPage) => setPage(nextPage)}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
          showPageSizeSelector
          showWhenSinglePage={false}
          disabled={isLoading || isFetching}
          labels={{ noItems: t('assembly.empty') }}
        />
      </div>

      {selectedOrderId && selectedTaskId && (
        <AssemblyTaskModal
          orderId={selectedOrderId}
          orderNo={selectedOrderNo}
          taskId={selectedTaskId}
          onClose={() => {
            setSelectedOrderId(null);
            setSelectedOrderNo(null);
            setSelectedTaskId(null);
          }}
          onComplete={() => {
            setSelectedOrderId(null);
            setSelectedOrderNo(null);
            setSelectedTaskId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}


