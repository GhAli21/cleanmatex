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
  isRTL?: boolean;
  className?: string;
}

/**
 * Quick-tender fast lane (UX finding 1.2): a one-tap chip row above the keypad
 * — `[Exact] [Next 5] [Next 10] [50] [100]` — shared by the Full view now and
 * the Simple view in Phase 4. Purely presentational: chip values come from the
 * pure `deriveQuickTenderChips` deriver and every selection is applied by the
 * caller through the same capped `updateLeg` path as the keypad, so chips can
 * never bypass overpayment / pay-extra gates.
 */
export function PaymentQuickTenderChips({
  items,
  onSelect,
  disabled = false,
  isRTL = false,
  className = '',
}: PaymentQuickTenderChipsProps) {
  if (items.length === 0) return null;

  return (
    <div
      data-testid="payment-quick-tender-chips"
      className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''} ${className}`}
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
              ? 'border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100'
              : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-800'
          }`}
        >
          {item.label}
        </CmxButton>
      ))}
    </div>
  );
}
