'use client';

import { useTranslations } from 'next-intl';
import { CmxSwitch } from '@ui/primitives';
import { Label } from '@ui/primitives';

/**
 * Pay-extra intent toggle with hard-gate click-through messaging (QA-R4.5).
 */
export type PayExtraIntentToggleProps = {
  checked: boolean;
  onAttemptChange: (next: boolean) => void;
  /** True native disable — no methods allow retained overpay. */
  disabled?: boolean;
  disabledReason?: string;
  /**
   * Soft lock (permission missing or cannot turn OFF while extra remains).
   * Uses aria-disabled so click still fires `onAttemptChange`.
   */
  ariaDisabled?: boolean;
  /** Compact layout for the top strip. */
  compact?: boolean;
};

/**
 * @param root0 - Toggle props
 */
export function PayExtraIntentToggle({
  checked,
  onAttemptChange,
  disabled = false,
  disabledReason,
  ariaDisabled = false,
  compact = false,
}: PayExtraIntentToggleProps) {
  const t = useTranslations('newOrder.payment.payExtraIntent');
  const textAlign = 'text-start';

  return (
    <div
      className={`flex items-start gap-3 ${
        compact
          ? 'min-w-0 flex-1'
          : 'rounded-xl border border-border bg-card px-4 py-3'
      } ${textAlign}`}
    >
      <CmxSwitch
        id="pay-extra-intent"
        checked={checked}
        onCheckedChange={onAttemptChange}
        disabled={disabled}
        ariaDisabled={ariaDisabled}
        aria-describedby={
          disabled && disabledReason
            ? 'pay-extra-disabled-reason'
            : undefined
        }
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <Label
          htmlFor="pay-extra-intent"
          className="cursor-pointer text-sm font-semibold text-foreground"
        >
          {t('label')}
        </Label>
        {!compact ? <p className="text-xs text-muted-foreground">{t('help')}</p> : null}
        {disabled && disabledReason ? (
          <p id="pay-extra-disabled-reason" className="text-xs text-warning-text">
            {disabledReason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
