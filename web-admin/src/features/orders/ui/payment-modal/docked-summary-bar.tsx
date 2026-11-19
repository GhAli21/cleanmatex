'use client';

/**
 * Docked footer summary bar for Payment Modal v4 (Phase 6 — tablet layout).
 *
 * Below the `xl` breakpoint the receipt rail collapses into a slide-over, so
 * the two numbers a cashier must never lose — Final Total and Change — dock
 * into the shared footer next to the CTA. Purely presentational and
 * locale-agnostic: the caller resolves labels and formatted values, and the
 * same bar serves both the Simple and Full faces (the footer is shared).
 */

/**
 * Props for {@link PaymentDockedSummaryBar}.
 */
export interface PaymentDockedSummaryBarProps {
  finalTotalLabel: string;
  /** Formatted final total, e.g. `OMR 50.000`. */
  finalTotalValue: string;
  changeLabel: string;
  /** Formatted change amount, e.g. `OMR 12.500`. */
  changeValue: string;
  /** Hides the change cell while nothing is returned. */
  showChange?: boolean;
  className?: string;
}

/**
 * Renders the docked Final Total + Change strip (the CTA lives beside it in
 * the shared dialog footer).
 *
 * @param props - {@link PaymentDockedSummaryBarProps}.
 * @returns The docked summary strip.
 */
export function PaymentDockedSummaryBar({
  finalTotalLabel,
  finalTotalValue,
  changeLabel,
  changeValue,
  showChange = false,
  className = '',
}: PaymentDockedSummaryBarProps) {
  return (
    <div
      data-testid="payment-docked-summary-bar"
      className={`flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted px-4 py-2.5  ${className}`}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-xs font-semibold text-muted-foreground">{finalTotalLabel}</span>
        <span
          data-testid="payment-docked-final-total"
          className="text-lg font-bold tabular-nums text-foreground"
        >
          {finalTotalValue}
        </span>
      </div>
      {showChange ? (
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-xs font-semibold text-success-text">{changeLabel}</span>
          <span
            data-testid="payment-docked-change"
            className="text-lg font-bold tabular-nums text-success-text"
          >
            {changeValue}
          </span>
        </div>
      ) : null}
    </div>
  );
}
