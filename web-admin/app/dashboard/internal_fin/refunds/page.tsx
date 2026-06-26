/**
 * Billing Refunds Page
 *
 * Tenant-wide list of all refunds across all orders.
 * Route: /dashboard/internal_fin/refunds
 */

import { getTranslations } from 'next-intl/server';
import { getAllRefunds } from '@/app/actions/billing/refund-actions';
import RefundsListClient from '@features/billing/ui/refunds-list-client';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_REFUNDS_ACCESS } from '@features/billing/access/billing-access'

interface PageProps {
  searchParams?: Promise<{ page?: string }>;
}

/**
 *
 * @param root0
 * @param root0.searchParams
 */
export default async function BillingRefundsPage({ searchParams }: PageProps) {
  const t = await getTranslations('billing.refunds');

  const resolved = await searchParams;
  const page = resolved?.page && !Number.isNaN(Number(resolved.page))
    ? Number(resolved.page)
    : 1;

  const result = await getAllRefunds(page, 20);

  if (!result.success) {
    return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_REFUNDS_ACCESS.page.permissions ?? []}>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-gray-600">{t('description')}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error}
        </div>
      </div>
    </RequireAnyPermission>
  );
  }

  const { items, total, pageSize } = result.data;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-gray-600">{t('description')}</p>
      </div>

      <RefundsListClient
        refunds={items}
        pagination={{ page, pageSize, total }}
      />
    </div>
  );
}
