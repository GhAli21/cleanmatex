'use client';

import { useTranslations } from 'next-intl';
import { WIRING_STATUS } from '@/lib/constants/voucher';

interface WiringStatusBadgeProps {
  status: string;
}

const STATUS_STYLE: Record<string, string> = {
  [WIRING_STATUS.NOT_WIRED]:       'bg-gray-100 text-gray-600',
  [WIRING_STATUS.WIRED]:           'bg-green-100 text-green-800',
  [WIRING_STATUS.PARTIALLY_WIRED]: 'bg-yellow-100 text-yellow-800',
  [WIRING_STATUS.FAILED]:          'bg-red-100 text-red-800',
  [WIRING_STATUS.REVERSED]:        'bg-slate-100 text-slate-700',
};

export function WiringStatusBadge({ status }: WiringStatusBadgeProps) {
  const t = useTranslations('finance.vouchers.wiringStatusLabels');

  const label = (() => {
    try { return t(status as Parameters<typeof t>[0]); } catch { return status; }
  })();

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {label}
    </span>
  );
}
