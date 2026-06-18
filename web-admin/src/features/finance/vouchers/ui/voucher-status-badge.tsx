'use client';

import { useTranslations } from 'next-intl';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';

interface VoucherStatusBadgeProps {
  status: string;
}

const STATUS_STYLE: Record<string, string> = {
  [VOUCHER_STATUS.DRAFT]:              'bg-gray-100 text-gray-700',
  [VOUCHER_STATUS.POSTED]:             'bg-green-100 text-green-800',
  [VOUCHER_STATUS.CANCELLED]:          'bg-red-100 text-red-800',
  [VOUCHER_STATUS.REVERSED]:           'bg-yellow-100 text-yellow-800',
  [VOUCHER_STATUS.PARTIALLY_REVERSED]: 'bg-orange-100 text-orange-800',
};

/**
 *
 * @param root0
 * @param root0.status
 */
export function VoucherStatusBadge({ status }: VoucherStatusBadgeProps) {
  const t = useTranslations('finance.vouchers.statusLabels');

  const label = (() => {
    try { return t(status as Parameters<typeof t>[0]); } catch { return status; }
  })();

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  );
}
