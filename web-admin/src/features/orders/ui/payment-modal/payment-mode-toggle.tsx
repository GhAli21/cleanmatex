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
  /** Resolved segment labels (i18n stays in the caller). */
  simpleLabel: string;
  fullLabel: string;
  /** Accessible group label, e.g. "Payment view". */
  groupLabel: string;
  isRTL?: boolean;
  className?: string;
  /** Disables both segments while the payment surface is still hydrating. */
  disabled?: boolean;
}

/**
 * Simple ⇄ Advanced segmented control for Payment Modal v4 (single engine, two
 * faces). Purely presentational: the caller owns the mode state and every
 * label. After hydrate, both segments stay clickable (amended ADR: the modal
 * never locks Simple or drops engine state). `disabled` only covers the initial
 * load so a fast click cannot switch faces against an incomplete catalog.
 *
 * @param root0 Toggle props.
 * @param root0.mode Active face.
 * @param root0.onModeChange Caller-owned mode setter.
 * @param root0.simpleLabel Resolved Simple label.
 * @param root0.fullLabel Resolved Advanced label.
 * @param root0.groupLabel Accessible group label.
 * @param root0.isRTL
 * @param root0.className
 * @param root0.disabled Hydrate lock — both segments inert until the surface is ready.
 */
export function PaymentModeToggle({
  mode,
  onModeChange,
  simpleLabel,
  fullLabel,
  groupLabel,
  isRTL = false,
  className = '',
  disabled = false,
}: PaymentModeToggleProps) {
  const segments: {
    value: PaymentModalMode;
    label: string;
  }[] = [
    { value: PAYMENT_MODAL_MODE.SIMPLE, label: simpleLabel },
    { value: PAYMENT_MODAL_MODE.FULL, label: fullLabel },
  ];

  return (
    <div
      role="group"
      aria-label={groupLabel}
      data-testid="payment-mode-toggle"
      aria-disabled={disabled}
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
            disabled={disabled}
            aria-pressed={selected}
            data-testid={`payment-mode-${segment.value}`}
            onClick={() => {
              if (disabled || selected) return;
              onModeChange(segment.value);
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
