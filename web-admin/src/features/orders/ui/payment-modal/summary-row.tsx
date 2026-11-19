'use client';

import { CmxSkeleton } from '@ui/primitives';

/**
 * Props for {@link SummaryRow}.
 */
export interface SummaryRowProps {
  label: string;
  value: string;
  /** Renders a skeleton in place of the value while totals load. */
  loading?: boolean;
  /** Total-style row: bold text with a top divider. */
  bold?: boolean;
  /** Negative amounts (discounts, deductions) render in rose. */
  negative?: boolean;
}

/**
 * Label + right-aligned tabular value row used across the payment receipt
 * surfaces (Full-view right rail, submit-confirm summary, Simple-view receipt
 * card). Extracted from `payment-full-view.tsx` in Phase 4 so both faces share
 * one implementation. Locale-agnostic: the caller resolves label/value text.
 */
export function SummaryRow({
  label,
  value,
  loading,
  bold,
  negative,
}: SummaryRowProps) {
  return (
    <div className={`flex justify-between items-center gap-2 ${bold ? 'font-bold border-t border-border pt-1.5 mt-1' : ''}`}>
      <span className={`text-sm ${bold ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      {loading ? (
        <CmxSkeleton className="h-4 w-20" />
      ) : (
        <span className={`text-sm tabular-nums ${bold ? 'text-foreground' : negative ? 'text-danger-text' : 'text-foreground'} font-medium`}>
          {value}
        </span>
      )}
    </div>
  );
}
