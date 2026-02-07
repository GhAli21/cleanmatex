/**
 * Create New Voucher Page
 * Route: /dashboard/billing/vouchers/new
 */

import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import CreateVoucherForm from './create-voucher-form';

export default async function CreateVoucherPage() {
  const t = await getTranslations('billing.receiptVoucher');
  const tCommon = await getTranslations('common');

  await getAuthContext();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('create.title') ?? 'Create Receipt Voucher'}</h1>
        <p className="mt-1 text-gray-600">{t('create.description') ?? 'Create a new receipt voucher manually'}</p>
      </div>

      <CreateVoucherForm />
    </div>
  );
}
