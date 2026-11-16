'use client';

import { useTranslations } from 'next-intl';
import { CmxStatusBadge, type CmxBadgeTone } from '@ui/feedback';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';

interface VoucherStatusBadgeProps {
  status: string;
}

const STATUS_TONE: Record<string, CmxBadgeTone> = {
  [VOUCHER_STATUS.DRAFT]: 'neutral',
  [VOUCHER_STATUS.POSTED]: 'success',
  [VOUCHER_STATUS.CANCELLED]: 'danger',
  [VOUCHER_STATUS.REVERSED]: 'warning',
  [VOUCHER_STATUS.PARTIALLY_REVERSED]: 'warning',
};

/**
 * Voucher status badge with a translated label; an unknown code shows as-is.
 * @param props - status code
 * @returns The badge
 */
export function VoucherStatusBadge({ status }: VoucherStatusBadgeProps) {
  const t = useTranslations('finance.vouchers.statusLabels');

  const label = (() => {
    try { return t(status as Parameters<typeof t>[0]); } catch { return status; }
  })();

  return <CmxStatusBadge size="sm" tone={STATUS_TONE[status] ?? 'neutral'} label={label} />;
}
