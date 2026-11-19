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
  /** Disables both segments while the surface is hydrating or submit has frozen the modal. */
  disabled?: boolean;
}

/**
 * Simple ⇄ Advanced segmented control for Payment Modal v4 (single engine, two
 * faces). Purely presentational: the caller owns the mode state and every
 * label. After hydrate, both segments stay clickable unless submit has frozen
 * the modal (amended ADR: the modal never locks Simple or drops engine state
 * as a mode policy). `disabled` covers the initial load and an in-flight
 * submit so a click cannot switch faces against an incomplete catalog or a
 * payment already being sent.
 *
 * @param root0 Toggle props.
 * @param root0.mode Active face.
 * @param root0.onModeChange Caller-owned mode setter.
 * @param root0.simpleLabel Resolved Simple label.
 * @param root0.fullLabel Resolved Advanced label.
 * @param root0.groupLabel Accessible group label.
 * @param root0.isRTL
 * @param root0.className
 * @param root0.disabled Hydrate or submit lock — both segments stay inert.
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
      className={`inline-flex items-center gap-1 rounded-xl border border-border bg-muted p-1  ${className}`}
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
                ? 'bg-card text-primary-text shadow-sm hover:bg-card'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {segment.label}
          </CmxButton>
        );
      })}
    </div>
  );
}
