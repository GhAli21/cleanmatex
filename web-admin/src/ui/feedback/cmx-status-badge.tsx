/**
 * CmxStatusBadge - Enhanced status badge with icon support and variants
 * @module ui/feedback
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Badge } from '@/src/ui/primitives/badge';

export type StatusBadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'processing'
  | 'outline';

export type StatusBadgeSize = 'sm' | 'md' | 'lg';

export interface CmxStatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  variant?: StatusBadgeVariant;
  size?: StatusBadgeSize;
  icon?: LucideIcon;
  showIcon?: boolean;
  pulse?: boolean;
  tooltip?: string;
}

const variantStyles: Record<StatusBadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800 border-gray-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  processing: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  outline: 'bg-transparent border-gray-300 text-gray-700',
};

const sizeStyles: Record<StatusBadgeSize, { text: string; icon: string; padding: string }> = {
  sm: {
    text: 'text-xs',
    icon: 'h-3 w-3',
    padding: 'px-1.5 py-0.5',
  },
  md: {
    text: 'text-sm',
    icon: 'h-3.5 w-3.5',
    padding: 'px-2 py-1',
  },
  lg: {
    text: 'text-base',
    icon: 'h-4 w-4',
    padding: 'px-2.5 py-1.5',
  },
};

export function CmxStatusBadge({
  label,
  variant = 'default',
  size = 'md',
  icon: Icon,
  showIcon = false,
  pulse = false,
  tooltip,
  className,
  ...props
}: CmxStatusBadgeProps) {
  const sizeStyle = sizeStyles[size];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors',
        variantStyles[variant],
        sizeStyle.text,
        sizeStyle.padding,
        pulse && 'animate-pulse',
        className
      )}
      title={tooltip}
      role="status"
      aria-label={label}
      {...props}
    >
      {showIcon && Icon && (
        <Icon className={cn('shrink-0', sizeStyle.icon)} aria-hidden="true" />
      )}
      <span>{label}</span>
    </div>
  );
}

CmxStatusBadge.displayName = 'CmxStatusBadge';

