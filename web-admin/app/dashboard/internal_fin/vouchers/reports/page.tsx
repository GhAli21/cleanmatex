/**
 * Voucher Reports Page
 * Route: /dashboard/internal_fin/vouchers/reports
 */

import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import Link from 'next/link';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { FEATURE_INTERNAL_FIN_VOUCHERS_REPORTS_ACCESS } from '@features/finance/vouchers/access/vouchers-access'

/**
 *
 */
export default async function VoucherReportsPage() {
  const t = await getTranslations('finance.vouchers');
  const tCommon = await getTranslations('common');

  try {
    await getAuthContext();
  } catch (error) {
    return (
    <RequireAnyPermission permissions={FEATURE_INTERNAL_FIN_VOUCHERS_REPORTS_ACCESS.page.permissions ?? []}>
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof Error ? error.message : tCommon('error')}
        </div>
      </div>
    </RequireAnyPermission>
  );
  }

  const canViewReports = await hasPermissionServer('fin_vouchers:reports');
  if (!canViewReports) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {tCommon('error')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('reports')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('reportsNote')}</p>
        </div>
        <Link
          href="/dashboard/internal_fin/vouchers"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tCommon('back')}
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">{t('reportsComingSoon')}</p>
      </div>
    </div>
  );
}
