'use client';

import { CmxButton } from '@ui/primitives';
import type { QuickTenderChipModel } from '../payment-modal-v4.utils';

/**
 * Display-ready quick-tender chip: the pure model from
 * `deriveQuickTenderChips` plus the labels the caller resolved (i18n +
 * currency formatting stay in the view so this part is locale-agnostic and
 * storybook-friendly).
 */
export interface PaymentQuickTenderChipItem extends QuickTenderChipModel {
  /** Visible chip text, e.g. `Exact` or `50.000`. */
  label: string;
  /** Screen-reader label; falls back to `label`. */
  ariaLabel?: string;
}

/**
 * Props for {@link PaymentQuickTenderChips}.
 */
export interface PaymentQuickTenderChipsProps {
  items: PaymentQuickTenderChipItem[];
  onSelect: (item: PaymentQuickTenderChipItem) => void;
  /** Disables every chip (no active leg / submit busy). */
  disabled?: boolean;
  className?: string;
}

/**
 * Quick-tender fast lane (UX finding 1.2): one-tap denomination chips
 * (cash round-ups / notes). Exact is owned by {@link PaymentAmountMoneyField}
 * so this row does not duplicate it. Purely presentational: values come from
 * `deriveQuickTenderChips`; selection uses the same capped `updateLeg` path as
 * the keypad.
 */
export function PaymentQuickTenderChips({
  items,
  onSelect,
  disabled = false,
  className = '',
}: PaymentQuickTenderChipsProps) {
  if (items.length === 0) return null;

  return (
    <div
      data-testid="payment-quick-tender-chips"
      className={`flex flex-wrap gap-2  ${className}`}
    >
      {items.map((item) => (
        <CmxButton
          key={item.id}
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          data-testid={`payment-quick-tender-${item.id}`}
          aria-label={item.ariaLabel ?? item.label}
          onClick={() => onSelect(item)}
          className={`h-11 min-w-[64px] rounded-xl px-3 text-sm font-semibold tabular-nums ${
            item.kind === 'exact'
              ? 'border-info-border bg-info-bg text-info-text hover:bg-info-border/50'
              : 'border-border bg-card text-foreground hover:border-info-border hover:text-info-text'
          }`}
        >
          {item.label}
        </CmxButton>
      ))}
    </div>
  );
}
