'use client';

import { useTranslations } from 'next-intl';
import { WIRING_STATUS } from '@/lib/constants/voucher';

interface WiringStatusBadgeProps {
  status: string;
}

const STATUS_STYLE: Record<string, string> = {
  [WIRING_STATUS.NOT_WIRED]:       'bg-muted text-muted-foreground',
  [WIRING_STATUS.WIRED]:           'bg-success-bg text-success-text',
  [WIRING_STATUS.PARTIALLY_WIRED]: 'bg-warning-bg text-warning-text',
  [WIRING_STATUS.FAILED]:          'bg-danger-bg text-danger-text',
  [WIRING_STATUS.REVERSED]:        'bg-muted text-foreground',
};

/**
 *
 * @param root0
 * @param root0.status
 */
export function WiringStatusBadge({ status }: WiringStatusBadgeProps) {
  const t = useTranslations('finance.vouchers.wiringStatusLabels');

  const label = (() => {
    try { return t(status as Parameters<typeof t>[0]); } catch { return status; }
  })();

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {label}
    </span>
  );
}
