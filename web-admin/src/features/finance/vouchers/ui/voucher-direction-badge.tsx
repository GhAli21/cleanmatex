'use client';

import { VOUCHER_DIRECTION } from '@/lib/constants/voucher';
import { ArrowDownLeft, ArrowUpRight, Minus } from 'lucide-react';

interface VoucherDirectionBadgeProps {
  direction: string | null | undefined;
}

/**
 *
 * @param root0
 * @param root0.direction
 */
export function VoucherDirectionBadge({ direction }: VoucherDirectionBadgeProps) {
  if (!direction) return null;

  if (direction === VOUCHER_DIRECTION.IN) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 rtl:flex-row-reverse">
        <ArrowDownLeft className="h-3 w-3" />
        IN
      </span>
    );
  }
  if (direction === VOUCHER_DIRECTION.OUT) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 rtl:flex-row-reverse">
        <ArrowUpRight className="h-3 w-3" />
        OUT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      <Minus className="h-3 w-3" />
      NEUTRAL
    </span>
  );
}
