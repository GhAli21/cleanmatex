import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import {
  getBizVoucherDetailAction,
  getVoucherLinkedEffectsAction,
} from '@/app/actions/finance/voucher-actions';
import { VoucherDetailClient } from './voucher-detail-client';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';

interface PageProps {
  params: Promise<{ voucherId: string }>;
}

export default async function VoucherDetailPage({ params }: PageProps) {
  const { voucherId } = await params;
  const t = await getTranslations('finance.vouchers');
  const tCommon = await getTranslations('common');

  const auth = await getAuthContext();
  const canView = await hasPermissionServer('fin_vouchers:view');
  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {tCommon('error')}
        </div>
      </div>
    );
  }

  const result = await getBizVoucherDetailAction(voucherId);
  if (!result.success || !result.data) {
    const msg = result.error ?? '';
    // Only show 404 for genuine "not found" — surface all other errors
    if (msg.toLowerCase().includes('not found') || msg === '') {
      notFound();
    }
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {msg}
        </div>
      </div>
    );
  }

  const voucher = result.data;

  // Fetch linked operational effects when the voucher is already posted
  const linkedEffectsResult =
    voucher.voucher_status === VOUCHER_STATUS.POSTED
      ? await getVoucherLinkedEffectsAction(voucherId)
      : null;

  return (
    <div className="space-y-6 overflow-x-hidden p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{voucher.voucher_no}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('voucherDetail')}</p>
        </div>
      </div>

      <VoucherDetailClient
        voucher={voucher}
        userRole={auth.userRole}
        linkedEffects={linkedEffectsResult?.data ?? null}
      />
    </div>
  );
}
