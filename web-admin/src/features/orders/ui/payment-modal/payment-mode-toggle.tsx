'use client';

import { CmxButton } from '@ui/primitives';
import {
  PAYMENT_MODAL_MODE,
  type PaymentModalMode,
} from '../payment-modal-v4.utils';

/**
 * Props for {@link PaymentModeToggle}.
 */
export interface PaymentModeToggleProps {
  mode: PaymentModalMode;
  onModeChange: (mode: PaymentModalMode) => void;
  /** Locks the Simple segment while `needsAdvanced` holds. */
  simpleDisabled?: boolean;
  /** Tooltip/title explaining why Simple is locked. */
  simpleDisabledReason?: string;
  /** Resolved segment labels (i18n stays in the caller). */
  simpleLabel: string;
  fullLabel: string;
  /** Accessible group label, e.g. "Payment view". */
  groupLabel: string;
  isRTL?: boolean;
  className?: string;
}

/**
 * Simple ⇄ Advanced segmented control for Payment Modal v4 (Phase 4 — single
 * engine, two faces). Purely presentational: the caller owns the mode state,
 * the auto-escalation rule, and every label. The Simple segment is disabled
 * while advanced conditions hold (`simpleDisabled`), matching the locked
 * program decision — the modal never silently drops advanced state.
 */
export function PaymentModeToggle({
  mode,
  onModeChange,
  simpleDisabled = false,
  simpleDisabledReason,
  simpleLabel,
  fullLabel,
  groupLabel,
  isRTL = false,
  className = '',
}: PaymentModeToggleProps) {
  const segments: {
    value: PaymentModalMode;
    label: string;
    disabled: boolean;
    title?: string;
  }[] = [
    {
      value: PAYMENT_MODAL_MODE.SIMPLE,
      label: simpleLabel,
      disabled: simpleDisabled,
      title: simpleDisabled ? simpleDisabledReason : undefined,
    },
    { value: PAYMENT_MODAL_MODE.FULL, label: fullLabel, disabled: false },
  ];

  return (
    <div
      role="group"
      aria-label={groupLabel}
      data-testid="payment-mode-toggle"
      className={`inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 ${isRTL ? 'flex-row-reverse' : ''} ${className}`}
    >
      {segments.map((segment) => {
        const selected = mode === segment.value;
        return (
          <CmxButton
            key={segment.value}
            type="button"
            variant="ghost"
            size="sm"
            disabled={segment.disabled}
            aria-pressed={selected}
            title={segment.title}
            data-testid={`payment-mode-${segment.value}`}
            onClick={() => {
              if (!selected && !segment.disabled) onModeChange(segment.value);
            }}
            className={`min-h-[44px] rounded-lg px-3 text-sm font-semibold ${
              selected
                ? 'bg-white text-teal-800 shadow-sm hover:bg-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {segment.label}
          </CmxButton>
        );
      })}
    </div>
  );
}
