/**
 * CmxSummaryMessage - persistent status banner (success / warning / info / error).
 * Theme status tokens and logical (RTL-safe) layout. Replaces the legacy `Alert`:
 * pass `title` + `items` for an operation summary, or `message` / `children` for free content.
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

/** Props of {@link CmxSummaryMessage}. Other div attributes (`id`, `role`, `aria-*`) reach the root. */
export interface CmxSummaryMessageProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  type: 'success' | 'warning' | 'info' | 'error';
  title?: string;
  /** Bullet list under the title. */
  items?: string[];
  /** Body text; `children` is used when it is absent. */
  message?: React.ReactNode;
  children?: React.ReactNode;
  onDismiss?: () => void;
  /** Accessible name of the dismiss button; pass the translated "Close". */
  dismissLabel?: string;
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

// Locked status tones (PR-02): bg + border + readable text, contrast-tested in light and dark.
const colorMap = {
  success: { bg: 'bg-success-bg', border: 'border-success-border', icon: 'text-success-text', text: 'text-success-text' },
  warning: { bg: 'bg-warning-bg', border: 'border-warning-border', icon: 'text-warning-text', text: 'text-warning-text' },
  info: { bg: 'bg-info-bg', border: 'border-info-border', icon: 'text-info-text', text: 'text-info-text' },
  error: { bg: 'bg-danger-bg', border: 'border-danger-border', icon: 'text-danger-text', text: 'text-danger-text' },
} as const;

/**
 * Status banner with an icon, optional title, bullet items or free content, and an optional dismiss button.
 * @param props See {@link CmxSummaryMessageProps}.
 */
export function CmxSummaryMessage({
  type,
  title,
  items = [],
  message,
  children,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
  autoHide = false,
  autoHideDuration = 5000,
  ...rest
}: CmxSummaryMessageProps) {
  const Icon = iconMap[type];
  const colors = colorMap[type];

  const safeTitle = title === undefined ? undefined : typeof title === 'string' ? title : String(title);
  const safeItems = items.map((item) => (typeof item === 'string' ? item : String(item)));
  const body = message ?? children;

  React.useEffect(() => {
    if (autoHide && onDismiss) {
      const timer = setTimeout(onDismiss, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDuration, onDismiss]);

  return (
    <div
      role="alert"
      {...rest}
      className={cn('rounded-lg border p-4', colors.bg, colors.border, colors.text, className)}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', colors.icon)} aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2">
          {safeTitle && <h4 className="font-semibold text-sm">{safeTitle}</h4>}
          {safeItems.length > 0 && (
            <ul className="text-sm space-y-1">
              {safeItems.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-xs mt-0.5" aria-hidden="true">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
          {body !== undefined && body !== null && body !== false && <div className="text-sm">{body}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className={cn('shrink-0 rounded-md p-1 hover:bg-foreground/5 transition-colors', colors.icon)}
            aria-label={dismissLabel}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
