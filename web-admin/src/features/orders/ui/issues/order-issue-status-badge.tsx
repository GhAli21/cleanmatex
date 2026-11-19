/**
 * High-visibility red/green issue status badge (circle + white !).
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Tooltip } from '@ui/primitives/tooltip';
import { CmxButton } from '@ui/primitives';
import { cn } from '@/lib/utils';

export interface OrderIssueStatusBadgeProps {
  openCount: number;
  totalCount: number;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Hidden when totalCount is 0. Red = open issues; green = all solved.
 */
export function OrderIssueStatusBadge({
  openCount,
  totalCount,
  onClick,
  className,
  size = 'md',
}: OrderIssueStatusBadgeProps) {
  const t = useTranslations('orders.issues');

  if (totalCount <= 0) {
    return null;
  }

  const hasOpen = openCount > 0;
  const dim = size === 'sm' ? 'h-5 w-5 text-xs' : 'h-6 w-6 text-sm';
  const label = hasOpen
    ? t('badgeManageOpen', { count: openCount })
    : t('badgeManageSolved');

  return (
    <Tooltip content={label}>
      <CmxButton
        type="button"
        variant="ghost"
        size="xs"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        aria-label={label}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full p-0 font-bold text-on-solid shadow-none',
          hasOpen ? 'bg-destructive hover:bg-destructive/90' : 'bg-success hover:bg-success/90',
          dim,
          className
        )}
      >
        !
      </CmxButton>
    </Tooltip>
  );
}
