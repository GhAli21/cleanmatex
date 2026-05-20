import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getBizVoucherDetailAction } from '@/app/actions/finance/voucher-actions';
import { VoucherDetailClient } from './voucher-detail-client';

interface PageProps {
  params: Promise<{ voucherId: string }>;
}

export default async function VoucherDetailPage({ params }: PageProps) {
  const { voucherId } = await params;
  const t = await getTranslations('finance.vouchers');

  const auth = await getAuthContext();

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{result.data.voucher_no}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('voucherDetail')}</p>
        </div>
      </div>

      <VoucherDetailClient voucher={result.data} userRole={auth.userRole} />
    </div>
  );
}
