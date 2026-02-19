/**
 * CmxSummaryMessage - Operation results with success/warning/info/error styling
 * Theme tokens and RTL support. Compatible with legacy summary-message.
 * @module ui/feedback
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

export interface CmxSummaryMessageProps {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  items: string[];
  onDismiss?: () => void;
  className?: string;
  autoHide?: boolean;
  autoHideDuration?: number;
}

const iconMap = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  error: XCircle,
};

const colorMap = {
  success: {
    bg: 'bg-[rgb(var(--cmx-success-bg-rgb,240_253_244))]',
    border: 'border-[rgb(var(--cmx-success-border-rgb,187_247_208))]',
    icon: 'text-[rgb(var(--cmx-success-rgb,34_197_94))]',
    title: 'text-[rgb(var(--cmx-success-dark-rgb,22_163_74))]',
    text: 'text-[rgb(var(--cmx-success-darker-rgb,21_128_61))]',
  },
  warning: {
    bg: 'bg-[rgb(var(--cmx-warning-bg-rgb,254_252_232))]',
    border: 'border-[rgb(var(--cmx-warning-border-rgb,253_224_71))]',
    icon: 'text-[rgb(var(--cmx-warning-rgb,234_179_8))]',
    title: 'text-[rgb(var(--cmx-warning-dark-rgb,202_138_4))]',
    text: 'text-[rgb(var(--cmx-warning-darker-rgb,161_98_7))]',
  },
  info: {
    bg: 'bg-[rgb(var(--cmx-info-bg-rgb,239_246_255))]',
    border: 'border-[rgb(var(--cmx-info-border-rgb,191_219_254))]',
    icon: 'text-[rgb(var(--cmx-primary-rgb,14_165_233))]',
    title: 'text-[rgb(var(--cmx-primary-hover-rgb,3_105_161))]',
    text: 'text-[rgb(var(--cmx-primary-hover-rgb,3_105_161))]',
  },
  error: {
    bg: 'bg-[rgb(var(--cmx-error-bg-rgb,254_242_242))]',
    border: 'border-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
    icon: 'text-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
    title: 'text-[rgb(var(--cmx-destructive-hover-rgb,185_28_28))]',
    text: 'text-[rgb(var(--cmx-destructive-hover-rgb,185_28_28))]',
  },
} as const;

export function CmxSummaryMessage({
  type,
  title,
  items,
  onDismiss,
  className,
  autoHide = false,
  autoHideDuration = 5000,
}: CmxSummaryMessageProps) {
  const Icon = iconMap[type];
  const colors = colorMap[type];

  const safeTitle = typeof title === 'string' ? title : String(title);
  const safeItems = items.map((item) => (typeof item === 'string' ? item : String(item)));

  React.useEffect(() => {
    if (autoHide && onDismiss) {
      const timer = setTimeout(onDismiss, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDuration, onDismiss]);

  return (
    <div
      className={cn('rounded-lg border p-4', colors.bg, colors.border, className)}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', colors.icon)} />
        <div className="flex-1 space-y-2">
          <h4 className={cn('font-semibold text-sm', colors.title)}>
            {safeTitle}
          </h4>
          {safeItems.length > 0 && (
            <ul className={cn('text-sm space-y-1', colors.text)}>
              {safeItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-xs mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
