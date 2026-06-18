'use client';

import { useTranslations } from 'next-intl';
import { CmxSwitch } from '@ui/primitives';
import { Label } from '@ui/primitives';

/**
 *
 */
export type PayExtraIntentToggleProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  isRTL?: boolean;
};

/**
 *
 * @param root0
 * @param root0.checked
 * @param root0.onCheckedChange
 * @param root0.disabled
 * @param root0.disabledReason
 * @param root0.isRTL
 */
export function PayExtraIntentToggle({
  checked,
  onCheckedChange,
  disabled = false,
  disabledReason,
  isRTL = false,
}: PayExtraIntentToggleProps) {
  const t = useTranslations('newOrder.payment.payExtraIntent');
  const textAlign = isRTL ? 'text-right' : 'text-left';

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 ${textAlign}`}
    >
      <CmxSwitch
        id="pay-extra-intent"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={disabled && disabledReason ? 'pay-extra-disabled-reason' : undefined}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor="pay-extra-intent" className="cursor-pointer text-sm font-semibold text-slate-900">
          {t('label')}
        </Label>
        <p className="text-xs text-slate-600">{t('help')}</p>
        {disabled && disabledReason ? (
          <p id="pay-extra-disabled-reason" className="text-xs text-amber-700">
            {disabledReason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
