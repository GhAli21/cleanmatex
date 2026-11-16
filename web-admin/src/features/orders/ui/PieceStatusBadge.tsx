/**
 * Piece Status Badge Component
 * Reusable status indicator for order item pieces
 */

'use client';

import { useTranslations } from 'next-intl';
import { CmxStatusBadge, type CmxBadgeTone } from '@ui/feedback';
import { cn } from '@/lib/utils';

/** Piece processing stage. */
export type PieceStatus = 'intake' | 'processing' | 'qa' | 'ready';

interface PieceStatusBadgeProps {
  status: PieceStatus | string | null;
  isRejected?: boolean;
  className?: string;
}

const STATUS_TONE: Record<string, CmxBadgeTone> = {
  intake: 'neutral',
  processing: 'info',
  qa: 'warning',
  ready: 'success',
};

/**
 * Piece stage badge; a rejected piece is struck through and says so.
 * @param props - status, isRejected, className
 * @returns The badge, or null without a status
 */
export function PieceStatusBadge({ status, isRejected = false, className }: PieceStatusBadgeProps) {
  const t = useTranslations('orders.pieces');
  if (!status) return null;

  const statusKey = status.toLowerCase();
  const label = t(`status.${statusKey}`) || status;

  return (
    <CmxStatusBadge
      size="sm"
      tone={STATUS_TONE[statusKey] ?? 'info'}
      className={cn(isRejected && 'line-through opacity-75', className)}
      label={isRejected ? `${label} (${t('rejected')})` : label}
    />
  );
}
