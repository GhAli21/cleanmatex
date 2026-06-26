/**
 * Create New Business Voucher Page
 * Route: /dashboard/internal_fin/vouchers/new
 */

import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { NewVoucherClient } from '@features/finance/vouchers/ui/new-voucher-client';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { FEATURE_INTERNAL_FIN_VOUCHERS_NEW_ACCESS } from '@features/finance/vouchers/access/vouchers-access'

/**
 *
 */
export default async function CreateVoucherPage() {
  const t = await getTranslations('finance.vouchers');
  const tCommon = await getTranslations('common');

  await getAuthContext();
  const canCreate = await hasPermissionServer('fin_vouchers:create');

  if (!canCreate) {
    return (
    <RequireAnyPermission permissions={FEATURE_INTERNAL_FIN_VOUCHERS_NEW_ACCESS.page.permissions ?? []}>
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {tCommon('error')}
        </div>
      </div>
    </RequireAnyPermission>
  );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('newVoucher')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('headerStep.hint')}</p>
      </div>
      <NewVoucherClient />
    </div>
  );
}
