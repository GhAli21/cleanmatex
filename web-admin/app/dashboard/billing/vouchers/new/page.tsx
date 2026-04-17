/**
 * Create New Voucher Page
 * Route: /dashboard/billing/vouchers/new
 */

import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import CreateVoucherForm from './create-voucher-form';

export default async function CreateVoucherPage() {
  const t = await getTranslations('billing.receiptVoucher');

  await getAuthContext();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{t('create.title')}</h1>
        <p className="mt-1 text-gray-600">{t('create.description')}</p>
      </div>

      <CreateVoucherForm />
    </div>
  );
}
