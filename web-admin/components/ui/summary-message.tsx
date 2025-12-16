/**
 * Summary Message Component
 *
 * Display operation results with success/warning/info/error styling.
 * Shows a title and list of result items, with optional dismiss functionality.
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  X,
} from 'lucide-react';

export interface SummaryMessageProps {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  items: string[];
  onDismiss?: () => void;
  className?: string;
  autoHide?: boolean;
  autoHideDuration?: number; // milliseconds
}

const iconMap = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  error: XCircle,
};

const colorMap = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
    title: 'text-green-800',
    text: 'text-green-700',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: 'text-yellow-600',
    title: 'text-yellow-800',
    text: 'text-yellow-700',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-800',
    text: 'text-blue-700',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    title: 'text-red-800',
    text: 'text-red-700',
  },
};

export function SummaryMessage({
  type,
  title,
  items,
  onDismiss,
  className,
  autoHide = false,
  autoHideDuration = 5000,
}: SummaryMessageProps) {
  const Icon = iconMap[type];
  const colors = colorMap[type];

  // Auto-hide functionality
  React.useEffect(() => {
    if (autoHide && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDuration, onDismiss]);

  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        colors.bg,
        colors.border,
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', colors.icon)} />

        {/* Content */}
        <div className="flex-1 space-y-2">
          {/* Title */}
          <h4 className={cn('font-semibold text-sm', colors.title)}>
            {title}
          </h4>

          {/* Items List */}
          {items.length > 0 && (
            <ul className={cn('text-sm space-y-1', colors.text)}>
              {items.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-xs mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={cn(
              'flex-shrink-0 rounded-md p-1',
              'hover:bg-black/5 transition-colors',
              colors.icon
            )}
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
