/**
 * Piece Status Badge Component
 * Reusable status indicator for order item pieces
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@ui/primitives';

export type PieceStatus = 'intake' | 'processing' | 'qa' | 'ready';

interface PieceStatusBadgeProps {
  status: PieceStatus | string | null;
  isRejected?: boolean;
  className?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  intake: { bg: 'bg-gray-100', text: 'text-gray-700' },
  processing: { bg: 'bg-blue-100', text: 'text-blue-700' },
  qa: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  ready: { bg: 'bg-green-100', text: 'text-green-700' },
};

export function PieceStatusBadge({
  status,
  isRejected = false,
  className = '',
}: PieceStatusBadgeProps) {
  const t = useTranslations('orders.pieces');

  if (!status) {
    return null;
  }

  const statusKey = status.toLowerCase();
  const colors = STATUS_COLORS[statusKey] || STATUS_COLORS.processing;

  return (
    <Badge
      className={`${colors.bg} ${colors.text} ${isRejected ? 'line-through opacity-75' : ''} ${className}`}
    >
      {isRejected ? (
        <>
          {t(`status.${statusKey}`) || status} ({t('rejected')})
        </>
      ) : (
        t(`status.${statusKey}`) || status
      )}
    </Badge>
  );
}

