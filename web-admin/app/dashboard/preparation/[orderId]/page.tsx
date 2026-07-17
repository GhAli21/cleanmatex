import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getOrderForPrep } from '@/app/actions/orders/get-order';
import { getAuthContext } from '@/lib/auth/server-auth';
import { FastItemizer } from '@features/workflow/ui/FastItemizer';
import { Alert, AlertDescription, CmxButton } from '@ui/primitives';

interface PreparationPageProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ returnUrl?: string }>;
}

/**
 * Workflow statuses allowed on the preparation detail screen.
 * `preparation_status` is a separate field (`pending` | `in_progress` | `completed`):
 * - pending + intake/preparing → allowed (processing not started yet)
 * - pending + processing → blocked (workflow already left prep; prep flag may be stale)
 */
const PREPARATION_ELIGIBLE_STATUSES = new Set(['intake', 'preparing', 'preparation']);

function resolveWorkflowStatus(order: {
  current_status?: string | null;
  status?: string | null;
}): string {
  return String(order.current_status || order.status || '').toLowerCase();
}

function canPrepareOrder(order: {
  current_status?: string | null;
  status?: string | null;
  preparation_status?: string | null;
}): boolean {
  const workflowStatus = resolveWorkflowStatus(order);
  const prepStatus = String(order.preparation_status || '').toLowerCase();
  if (prepStatus === 'completed') return false;
  return PREPARATION_ELIGIBLE_STATUSES.has(workflowStatus);
}

async function PreparationContent({
  orderId,
  returnUrl,
}: {
  orderId: string;
  returnUrl?: string;
}) {
  const tWorkflow = await getTranslations('workflow');
  const tPrep = await getTranslations('preparation');

  let tenantId: string;
  try {
    const authContext = await getAuthContext();
    tenantId = authContext.tenantId;
  } catch (error) {
    console.error('[PreparationPage] Auth error:', error);
    return notFound();
  }

  const result = await getOrderForPrep(tenantId, orderId);
  if (result.success === false || !result.data) return notFound();

  const { order, productCatalog } = result.data;
  const workflowStatus = resolveWorkflowStatus(order);
  const knownStatuses = ['intake', 'preparing', 'processing', 'assembly', 'qa', 'ready', 'delivered'] as const;
  const statusLabel = (knownStatuses as readonly string[]).includes(workflowStatus)
    ? tWorkflow(`statuses.${workflowStatus}`)
    : workflowStatus || '—';
  const canPrepare = canPrepareOrder(order);
  const backHref = returnUrl || '/dashboard/preparation';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="w-4 h-4 me-1 rtl:rotate-180" /> {tPrep('backToPreparation')}
          </Link>
          <Link
            href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/preparation')}&returnLabel=${encodeURIComponent(
              tPrep('backToPreparation')
            )}`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            {tWorkflow('actions.transitionStatus')}
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">
            {tWorkflow('screens.preparation')} – {order.order_no}
          </h1>
        </div>
      </div>

      <section
        className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700"
        aria-label={tWorkflow('preparation.detail.summaryTitle')}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          {tWorkflow('preparation.detail.summaryTitle')}
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <dt className="text-gray-500">{tWorkflow('labels.customer')}</dt>
            <dd className="font-medium text-gray-900">{order.customer?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">{tWorkflow('labels.phone')}</dt>
            <dd className="font-medium text-gray-900">{order.customer?.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">{tWorkflow('labels.received')}</dt>
            <dd className="font-medium text-gray-900">
              {order.received_at
                ? new Date(order.received_at as unknown as string).toLocaleString()
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">{tWorkflow('preparation.detail.bagsLabel')}</dt>
            <dd className="font-medium text-gray-900">{order.bag_count}</dd>
          </div>
          <div>
            <dt className="text-gray-500">{tWorkflow('preparation.detail.statusLabel')}</dt>
            <dd className="font-medium text-gray-900">{statusLabel}</dd>
          </div>
        </dl>
      </section>

      {!canPrepare ? (
        <Alert
          variant="warning"
          title={tWorkflow('preparation.detail.cannotPrepareTitle')}
        >
          <AlertDescription className="space-y-3">
            <p>
              {tWorkflow('preparation.detail.cannotPrepareBody', { status: statusLabel })}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {workflowStatus === 'processing' && (
                <CmxButton asChild variant="primary" size="sm">
                  <Link href={`/dashboard/processing/${order.id}`}>
                    {tWorkflow('preparation.detail.viewProcessing')}
                  </Link>
                </CmxButton>
              )}
              <CmxButton asChild variant="outline" size="sm">
                <Link href={`/dashboard/orders/${order.id}`}>
                  {tWorkflow('preparation.detail.viewOrder')}
                </Link>
              </CmxButton>
              <CmxButton asChild variant="ghost" size="sm">
                <Link href={backHref}>{tPrep('backToPreparation')}</Link>
              </CmxButton>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <FastItemizer order={order} productCatalog={productCatalog} />
      )}
    </div>
  );
}

/**
 * Preparation detail — itemize Quick Drop orders before processing.
 */
export default async function PreparationPage({ params, searchParams }: PreparationPageProps) {
  const { orderId } = await params;
  const { returnUrl } = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <PreparationContent orderId={orderId} returnUrl={returnUrl} />
    </Suspense>
  );
}
