/**
 * Create New Business Voucher Page
 * Route: /dashboard/internal_fin/vouchers/new
 */

import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { NewVoucherClient } from '@features/finance/vouchers/ui/new-voucher-client';

export default async function CreateVoucherPage() {
  const t = await getTranslations('finance.vouchers');

  await getAuthContext();

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
