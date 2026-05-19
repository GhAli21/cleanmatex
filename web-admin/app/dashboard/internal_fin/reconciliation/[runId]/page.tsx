/**
 * Reconciliation Run Detail Page
 *
 * Shows the full details and issues for a single reconciliation run.
 * Route: /dashboard/internal_fin/reconciliation/[runId]
 */

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getReconRunAction } from '@/app/actions/billing/reconciliation-actions';
import ReconciliationDetailClient from '@features/billing/ui/reconciliation-detail-client';

interface PageProps {
  params: Promise<{ runId: string }>;
}

export default async function ReconciliationDetailPage({ params }: PageProps) {
  const t = await getTranslations('billing.reconciliation');
  const { runId } = await params;

  const result = await getReconRunAction(runId);

  if (!result.success) {
    return (
      <div className="space-y-4 p-6">
        <Link
          href="/dashboard/internal_fin/reconciliation"
          className="text-sm text-blue-600 hover:underline"
        >
          â† Back to Reconciliation
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Link
        href="/dashboard/internal_fin/reconciliation"
        className="text-sm text-blue-600 hover:underline"
      >
        â† {t('title')}
      </Link>

      <ReconciliationDetailClient run={result.data} />
    </div>
  );
}
