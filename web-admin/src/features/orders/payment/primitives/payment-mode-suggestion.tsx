'use client';

/**
 * PaymentModeSuggestion — the dismissible "Advanced may help" hint (L4 primitive;
 * amended ADR: complexity is a SUGGESTION, never a forced escalation).
 *
 * Replaces the old auto-escalation banner when the modal is user-controlled: it
 * appears while Simple is selected and advanced conditions are present, offers a
 * one-click switch to Advanced, and can be dismissed — the cashier is never
 * moved automatically and never locked out of Simple. The reasons are surfaced
 * for explainability (resolved by the caller — same i18n convention as the other
 * primitives). Announced politely for screen readers.
 */

import { Lightbulb } from 'lucide-react';
import { CmxButton } from '@ui/primitives';

/**
 * Props for {@link PaymentModeSuggestion}. All copy arrives resolved.
 */
export interface PaymentModeSuggestionProps {
  /** Resolved suggestion title (e.g. "Advanced options may help"). */
  title: string;
  /** Resolved reason labels explaining why Advanced is suggested. */
  reasons: string[];
  /** Resolved label for the accept action (switch to Advanced). */
  actionLabel: string;
  onAccept: () => void;
  /** Resolved accessible label for the dismiss control. */
  dismissLabel: string;
  onDismiss: () => void;
  isRTL?: boolean;
}

/**
 * Renders the dismissible switch-to-Advanced suggestion.
 *
 * @param props - {@link PaymentModeSuggestionProps}.
 * @returns The suggestion banner element.
 */
export function PaymentModeSuggestion({
  title,
  reasons,
  actionLabel,
  onAccept,
  dismissLabel,
  onDismiss,
  isRTL = false,
}: PaymentModeSuggestionProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="payment-mode-suggestion"
      className={`flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 ${
        isRTL ? 'flex-row-reverse text-right' : ''
      }`}
    >
      <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{title}</span>
        {reasons.length > 0 ? (
          <>
            {' — '}
            {reasons.join(' · ')}
          </>
        ) : null}
      </p>
      <CmxButton
        type="button"
        variant="outline"
        size="sm"
        onClick={onAccept}
        data-testid="payment-mode-suggestion-accept"
        className="h-7 shrink-0 rounded-md px-2 text-[11px]"
      >
        {actionLabel}
      </CmxButton>
      <CmxButton
        type="button"
        variant="ghost"
        size="sm"
        onClick={onDismiss}
        aria-label={dismissLabel}
        data-testid="payment-mode-suggestion-dismiss"
        className="h-7 w-7 shrink-0 rounded-md p-0 text-amber-700"
      >
        <span aria-hidden="true">×</span>
      </CmxButton>
    </div>
  );
}
