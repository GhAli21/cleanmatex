/**
 * CmxStatusBadge - the one badge of the design system (statuses, tags, counts).
 * Colours come from locked semantic tones, so text is readable in light and
 * dark and an Organization theme can never change what "danger" looks like.
 * @module ui/feedback
 */

'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Semantic colour of a badge. Domain badges map their codes to one of these. */
export type CmxBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';

/** `soft` tinted background (default), `outline` border only, `solid` filled (brand and danger only; others render soft). */
export type CmxBadgeAppearance = 'soft' | 'outline' | 'solid';

/** Badge size. */
export type StatusBadgeSize = 'sm' | 'md' | 'lg';

/** Props of {@link CmxStatusBadge}. */
export interface CmxStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Text of the badge; `children` is used when absent. */
  label?: React.ReactNode;
  tone?: CmxBadgeTone;
  appearance?: CmxBadgeAppearance;
  size?: StatusBadgeSize;
  /** Shown before the text; hidden from screen readers. */
  icon?: LucideIcon;
  pulse?: boolean;
  tooltip?: string;
}

const SOFT: Record<CmxBadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  info: 'bg-info-bg text-info-text border-info-border',
  success: 'bg-success-bg text-success-text border-success-border',
  warning: 'bg-warning-bg text-warning-text border-warning-border',
  danger: 'bg-danger-bg text-danger-text border-danger-border',
  brand: 'bg-primary-bg text-primary-text border-primary/30',
};

const OUTLINE: Record<CmxBadgeTone, string> = {
  neutral: 'text-muted-foreground border-border',
  info: 'text-info-text border-info-border',
  success: 'text-success-text border-success-border',
  warning: 'text-warning-text border-warning-border',
  danger: 'text-danger-text border-danger-border',
  brand: 'text-primary-text border-primary',
};

const SOLID: Partial<Record<CmxBadgeTone, string>> = {
  brand: 'bg-primary text-primary-foreground border-transparent',
  danger: 'bg-destructive text-destructive-foreground border-transparent',
};

const SIZE: Record<StatusBadgeSize, { box: string; icon: string }> = {
  sm: { box: 'text-xs px-1.5 py-0.5', icon: 'h-3 w-3' },
  md: { box: 'text-sm px-2 py-1', icon: 'h-3.5 w-3.5' },
  lg: { box: 'text-base px-2.5 py-1.5', icon: 'h-4 w-4' },
};

function toneClasses(tone: CmxBadgeTone, appearance: CmxBadgeAppearance): string {
  if (appearance === 'outline') return cn('bg-transparent', OUTLINE[tone]);
  if (appearance === 'solid' && SOLID[tone]) return SOLID[tone] as string;
  return SOFT[tone];
}

/**
 * Inline badge with a semantic tone.
 * @param props - {@link CmxStatusBadgeProps}
 * @returns The badge element
 */
export function CmxStatusBadge({
  label,
  tone = 'neutral',
  appearance = 'soft',
  size = 'md',
  icon: Icon,
  pulse = false,
  tooltip,
  className,
  children,
  ...props
}: CmxStatusBadgeProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-medium whitespace-nowrap transition-colors',
        toneClasses(tone, appearance),
        SIZE[size].box,
        pulse && 'animate-pulse',
        className
      )}
      title={tooltip}
      {...props}
    >
      {Icon && <Icon className={cn('shrink-0', SIZE[size].icon)} aria-hidden="true" />}
      <span>{label ?? children}</span>
    </span>
  );
}

CmxStatusBadge.displayName = 'CmxStatusBadge';
