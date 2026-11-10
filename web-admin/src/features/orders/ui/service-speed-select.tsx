/**
 * Service speed menu (Line-Level P5-03b, PLAN §5.4).
 *
 * The options are the active rows of `sys_service_speed_cd`, never a
 * hard-coded list. Two uses: the order speed (new lines follow it), and a
 * line's own speed, which adds "Order speed" to make the line follow the order again.
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import { useRTL } from '@/lib/hooks/useRTL';
import { cn } from '@/lib/utils';
import { useServiceSpeeds } from '../hooks/use-service-speeds';
import { useSpeedOptionPreviews, type SpeedOptionPreviewSource } from '../hooks/use-speed-option-previews';

/** UI-only option value of a line that follows the order speed (never sent; the request carries null). */
const FOLLOW_ORDER_SPEED = '__FOLLOW_ORDER__';

/** Props of the speed menu. */
export interface ServiceSpeedSelectProps {
  /** The selected code; null on a line means it follows the order speed. */
  value: string | null;
  onChange: (serviceSpeed: string | null) => void;
  /** Set on a line menu: the order speed it follows when `value` is null. */
  orderSpeed?: string;
  disabled?: boolean;
  /** Why the menu is disabled, shown as its tooltip. */
  disabledReason?: string;
  ariaLabel: string;
  /** `line` renders a compact trigger for a cart row. */
  size?: 'default' | 'line';
  className?: string;
  /** New Order only: prices each option and shows its promised ready time when the menu opens. */
  preview?: SpeedOptionPreviewSource;
}

/**
 * Speed menu for the order or one line.
 * @param props - value, change handler, and the order speed for a line menu
 * @returns the menu
 */
export function ServiceSpeedSelect({
  value,
  onChange,
  orderSpeed,
  disabled = false,
  disabledReason,
  ariaLabel,
  size = 'default',
  className,
  preview,
}: ServiceSpeedSelectProps) {
  const t = useTranslations('newOrder.serviceSpeed');
  const isRTL = useRTL();
  const { speeds, labelOf, isLoading, isError } = useServiceSpeeds();
  const isLine = orderSpeed !== undefined;
  const selected = isLine && value == null ? FOLLOW_ORDER_SPEED : value ?? '';
  // Only what this organization offers, but a speed already on the order or line stays visible.
  const options = speeds.filter((s) => s.is_offered || s.code === value || s.code === orderSpeed);
  const [open, setOpen] = useState(false);
  const previews = useSpeedOptionPreviews(options.map((s) => s.code), preview, open);
  const display = selected === FOLLOW_ORDER_SPEED
    ? t('followOrder', { speed: labelOf(orderSpeed ?? '') })
    : labelOf(selected);

  return (
    <div className={className} title={disabled ? disabledReason : undefined}>
      <CmxSelectDropdown
        value={selected}
        onValueChange={(next) => onChange(next === FOLLOW_ORDER_SPEED ? null : next)}
        disabled={disabled || isError}
        isLoading={isLoading}
        loadingLabel={t('loading')}
        emptyLabel={t('unavailable')}
        onOpenChange={setOpen}
      >
        <CmxSelectDropdownTrigger
          aria-label={ariaLabel}
          dir={isRTL ? 'rtl' : 'ltr'}
          className={cn('bg-white', size === 'line' ? 'h-6 min-h-0 px-1.5 py-0 text-[11px]' : 'h-9 text-sm')}
        >
          <CmxSelectDropdownValue displayValue={isError ? t('unavailable') : display} />
        </CmxSelectDropdownTrigger>
        <CmxSelectDropdownContent>
          {isLine ? (
            <CmxSelectDropdownItem value={FOLLOW_ORDER_SPEED}>
              {t('followOrder', { speed: labelOf(orderSpeed ?? '') })}
            </CmxSelectDropdownItem>
          ) : null}
          {options.map((speed) => {
            const option = previews.get(speed.code);
            return (
              <CmxSelectDropdownItem key={speed.code} value={speed.code} disabled={option?.notOffered && speed.code !== selected}>
                <span className="flex flex-col">
                  <span>{labelOf(speed.code)}</span>
                  {option?.notOffered ? <span className="text-[11px] opacity-70">{t('notOfferedForItems')}</span> : null}
                  {option?.total ? <span className="text-[11px] opacity-70">{t('optionPreview', { total: option.total, ready: option.ready })}</span> : null}
                </span>
              </CmxSelectDropdownItem>
            );
          })}
        </CmxSelectDropdownContent>
      </CmxSelectDropdown>
    </div>
  );
}
