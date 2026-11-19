/**
 * CmxProgressBar - Progress bar with theme tokens and variants
 * Compatible with the legacy ProgressBar from components/ui
 * @module ui/feedback
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 *
 */
export interface CmxProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const CmxProgressBar: React.FC<CmxProgressBarProps> = ({
  value,
  max = 100,
  label,
  showPercentage = false,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  let autoVariant = variant;
  if (variant === 'default') {
    if (percentage >= 100) autoVariant = 'success';
    else if (percentage >= 90) autoVariant = 'danger';
    else if (percentage >= 70) autoVariant = 'warning';
  }

  const variantClasses: Record<string, string> = {
    default: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
  };

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className="text-sm font-medium text-foreground">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="text-sm font-medium text-muted-foreground">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'w-full rounded-full overflow-hidden',
          'bg-muted',
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            variantClasses[autoVariant],
            sizeClasses[size],
            'rounded-full transition-all duration-300 ease-in-out'
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label}
        />
      </div>
    </div>
  );
};

CmxProgressBar.displayName = 'CmxProgressBar';
