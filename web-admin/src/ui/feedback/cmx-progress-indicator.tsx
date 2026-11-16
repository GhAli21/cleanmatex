/**
 * CmxProgressIndicator - Progress bar component with percentage display
 * @module ui/feedback
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 *
 */
export interface CmxProgressIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  max?: number;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  animated?: boolean;
  showPercentage?: boolean;
}

const sizeStyles = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const variantStyles = {
  default: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-destructive',
  info: 'bg-info',
};

/**
 *
 * @param root0
 * @param root0.value
 * @param root0.max
 * @param root0.showLabel
 * @param root0.label
 * @param root0.size
 * @param root0.variant
 * @param root0.animated
 * @param root0.showPercentage
 * @param root0.className
 */
export function CmxProgressIndicator({
  value,
  max = 100,
  showLabel = false,
  label,
  size = 'md',
  variant = 'default',
  animated = true,
  showPercentage = true,
  className,
  ...props
}: CmxProgressIndicatorProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn('w-full', className)} {...props}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-muted-foreground">
            {label || 'Progress'}
          </span>
          {showPercentage && (
            <span className="text-sm text-muted-foreground">{Math.round(percentage)}%</span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full bg-muted rounded-full overflow-hidden',
          sizeStyles[size]
        )}
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            variantStyles[variant],
            animated && 'ease-out'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

CmxProgressIndicator.displayName = 'CmxProgressIndicator';

