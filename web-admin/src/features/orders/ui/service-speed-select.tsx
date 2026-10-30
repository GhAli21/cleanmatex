/**
 * Service speed menu (Line-Level P5-03b, PLAN §5.4).
 *
 * The options are the active rows of `sys_service_speed_cd`, never a
 * hard-coded list. Two uses: the order speed (new lines follow it), and a
 * line's own speed, which adds "Order speed" to make the line follow the order again.
 */

'use client';

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
}: ServiceSpeedSelectProps) {
  const t = useTranslations('newOrder.serviceSpeed');
  const isRTL = useRTL();
  const { speeds, labelOf, isLoading, isError } = useServiceSpeeds();
  const isLine = orderSpeed !== undefined;
  const selected = isLine && value == null ? FOLLOW_ORDER_SPEED : value ?? '';
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
          {speeds.map((speed) => (
            <CmxSelectDropdownItem key={speed.code} value={speed.code}>
              {labelOf(speed.code)}
            </CmxSelectDropdownItem>
          ))}
        </CmxSelectDropdownContent>
      </CmxSelectDropdown>
    </div>
  );
}
