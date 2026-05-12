import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getOrderForPrep } from '@/app/actions/orders/get-order';
import { getAuthContext } from '@/lib/auth/server-auth';
import { FastItemizer } from '@features/workflow/ui/FastItemizer';

interface PreparationPageProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ returnUrl?: string }>;
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

  // Get tenant ID from auth context
  let tenantId: string;
  try {
    const authContext = await getAuthContext();
    tenantId = authContext.tenantId;
  } catch (error) {
    console.error('[PreparationPage] Auth error:', error);
    return notFound();
  }

  const result = await getOrderForPrep(tenantId, orderId);
  if (!result.success || !result.data) return notFound();

  const { order, productCatalog } = result.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={returnUrl || '/dashboard/preparation'}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="w-4 h-4 mr-1 rtl:rotate-180" /> {tPrep('backToPreparation')}
          </Link>
          <Link
            href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/preparation')}&returnLabel=${encodeURIComponent(
              tPrep('backToPreparation')
            )}`}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900"
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
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
        </dl>
      </section>

      <FastItemizer order={order} productCatalog={productCatalog} />
    </div>
  );
}

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


