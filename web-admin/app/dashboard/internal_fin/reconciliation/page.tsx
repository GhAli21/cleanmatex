/**
 * Reconciliation List Page
 *
 * Displays all financial reconciliation runs for the tenant.
 * Route: /dashboard/internal_fin/reconciliation
 */

import { getTranslations } from 'next-intl/server';
import { listReconRunsAction } from '@/app/actions/billing/reconciliation-actions';
import ReconciliationListClient from '@features/billing/ui/reconciliation-list-client';

interface PageProps {
  searchParams?: Promise<{ page?: string }>;
}

export default async function ReconciliationPage({ searchParams }: PageProps) {
  const t = await getTranslations('billing.reconciliation');

  const resolved = await searchParams;
  const page = resolved?.page && !Number.isNaN(Number(resolved.page))
    ? Number(resolved.page)
    : 1;

  const result = await listReconRunsAction(page, 20);

  if (!result.success) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-gray-600">{t('description')}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    );
  }

  const { items, total, pageSize } = result.data;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-gray-600">{t('description')}</p>
      </div>

      <ReconciliationListClient
        runs={items}
        pagination={{ page, pageSize, total }}
      />
    </div>
  );
}
