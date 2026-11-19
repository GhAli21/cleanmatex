'use client';

import { useTranslations } from 'next-intl';
import { PayExtraIntentToggle } from './pay-extra-intent-toggle';

export type PayExtraTopStripProps = {
  checked: boolean;
  onAttemptChange: (next: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  ariaDisabled?: boolean;
  /** Formatted extra amount when > epsilon (e.g. "OMR 2.103"). */
  extraAmountLabel?: string | null;
  /** Destination label when resolved (read-only mirror). */
  extraDestinationLabel?: string | null;
  /** True when excess exists and is not yet routed. */
  extraUnresolved?: boolean;
  /** True when excess exists and resolution payload is ready. */
  extraResolved?: boolean;
};

/**
 * Shared chrome under the payment dialog header: pay-extra toggle + read-only
 * Extra mirror (QA-R4.5). Amber while unresolved, emerald when resolved — never red.
 *
 * @param root0 - Strip props
 */
export function PayExtraTopStrip({
  checked,
  onAttemptChange,
  disabled = false,
  disabledReason,
  ariaDisabled = false,
  extraAmountLabel,
  extraDestinationLabel,
  extraUnresolved = false,
  extraResolved = false,
}: PayExtraTopStripProps) {
  const t = useTranslations('newOrder.payment.payExtraIntent');
  const hasExtra = Boolean(extraAmountLabel);
  const stripTone = extraResolved
    ? 'border-success-border bg-success-bg/80'
    : extraUnresolved
      ? 'border-warning-border bg-warning-bg/80'
      : 'border-border bg-muted/80';

  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-b px-4 py-2.5 ${stripTone} `}
      data-testid="pay-extra-top-strip"
    >
      <PayExtraIntentToggle
        checked={checked}
        onAttemptChange={onAttemptChange}
        disabled={disabled}
        disabledReason={disabledReason}
        ariaDisabled={ariaDisabled}
        compact
      />
      {hasExtra ? (
        <div
          className={`ms-auto text-xs font-medium tabular-nums ${
            extraResolved ? 'text-success-text' : 'text-warning-text'
          } text-end`}
          role="status"
          aria-live="polite"
        >
          {extraResolved && extraDestinationLabel
            ? t('extraResolvedTo', {
                amount: extraAmountLabel,
                destination: extraDestinationLabel,
              })
            : extraUnresolved
              ? `${t('extraAmount', { amount: extraAmountLabel })} — ${t('extraUnresolved')}`
              : t('extraAmount', { amount: extraAmountLabel })}
        </div>
      ) : null}
    </div>
  );
}
