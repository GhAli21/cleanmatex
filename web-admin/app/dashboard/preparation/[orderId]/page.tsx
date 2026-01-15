import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getOrderForPrep } from '@/app/actions/orders/get-order';
import { FastItemizer } from '../components/FastItemizer';

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
  // Note: tenant id is handled within server action
  const tWorkflow = await getTranslations('workflow');
  const tPrep = await getTranslations('preparation');

  const result = await getOrderForPrep('', orderId);
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


