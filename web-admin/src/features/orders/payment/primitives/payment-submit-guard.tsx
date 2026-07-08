'use client';

/**
 * PaymentSubmitGuard — the inline guard banner for blocked submits (L4
 * primitive; ADR: a blocking condition is an error guard, NOT a mode change).
 *
 * Renders the reason the submit is blocked in place — the cashier is never
 * ejected to another view — plus an optional corrective action (e.g. "Open a
 * drawer session"). Announced politely for screen readers. Carries its reason
 * code as a data attribute so QA/support can always answer "why is this
 * blocked" (explainability rule).
 */

import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import type { PaymentReasonCode } from '../domain/payment-reasons';

/**
 * Props for {@link PaymentSubmitGuard}.
 */
export interface PaymentSubmitGuardProps {
  /** Why the submit is blocked — the unified reason code. */
  reason: PaymentReasonCode;
  /** Resolved guard message (i18n stays in the caller). */
  message: string;
  /** Optional resolved label for a corrective action button. */
  actionLabel?: string;
  onAction?: () => void;
  isRTL?: boolean;
  /** Optional leading icon override (defaults to an alert circle). */
  icon?: ReactNode;
}

/**
 * Renders the blocked-submit guard banner.
 *
 * @param props - {@link PaymentSubmitGuardProps}.
 * @returns The guard banner element.
 */
export function PaymentSubmitGuard({
  reason,
  message,
  actionLabel,
  onAction,
  isRTL = false,
  icon,
}: PaymentSubmitGuardProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="payment-submit-guard"
      data-reason={reason}
      className={`flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 ${
        isRTL ? 'flex-row-reverse text-right' : 'text-left'
      }`}
    >
      <span className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true">
        {icon ?? <CircleAlert className="h-4 w-4" />}
      </span>
      <div className={`flex min-w-0 flex-1 flex-col gap-1 ${isRTL ? 'items-end' : 'items-start'}`}>
        <p className="min-w-0">{message}</p>
        {onAction && actionLabel ? (
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onAction}
            className="h-7 rounded-md px-2 text-[11px]"
          >
            {actionLabel}
          </CmxButton>
        ) : null}
      </div>
    </div>
  );
}
