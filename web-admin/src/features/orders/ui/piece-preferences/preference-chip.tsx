/**
 * Single preference chip: label, optional price, copy + remove.
 */

'use client';

import type { CSSProperties } from 'react';
import { useLocale } from 'next-intl';
import { Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { catalogColorChipStyle, parseKindBgHex } from './piece-pref-kind-styles';

/**
 *
 */
export interface PreferenceChipProps {
  label: string;
  extraPrice: number;
  /** @deprecated Use tenant currency from context for formatting (kept for call-site compatibility). */
  currencyCode: string;
  kindClassName?: string;
  /** Kind color accent (hex from DB) layered under optional Tailwind kindClassName */
  accentStyle?: CSSProperties;
  /** When set (e.g. color prefs), chip uses catalog swatch hex — overrides kind accent */
  catalogColorHex?: string | null;
  onRemove: () => void;
  /** Omit to hide the copy action (e.g. order/item-level chips, which have no siblings to copy to). */
  onCopy?: () => void;
  removeLabel: string;
  copyLabel?: string;
}

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.extraPrice
 * @param root0.currencyCode
 * @param root0.kindClassName
 * @param root0.accentStyle
 * @param root0.catalogColorHex
 * @param root0.onRemove
 * @param root0.onCopy
 * @param root0.removeLabel
 * @param root0.copyLabel
 */
export function PreferenceChip({
  label,
  extraPrice,
  currencyCode: _currencyCode,
  kindClassName,
  accentStyle,
  catalogColorHex,
  onRemove,
  onCopy,
  removeLabel,
  copyLabel,
}: PreferenceChipProps) {
  const locale = useLocale();
  const { formatMoneyWithCode } = useTenantCurrency();
  const showPrice = extraPrice > 0.0001;
  const priceText = showPrice ? `+${formatMoneyWithCode(extraPrice)}` : '';
  const swatchHex = catalogColorHex ? parseKindBgHex(catalogColorHex) : null;
  const swatchStyle = swatchHex ? catalogColorChipStyle(swatchHex) : undefined;

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-sm shadow-sm',
        swatchStyle ? 'border-transparent' : 'border-border/90 bg-card text-foreground',
        !swatchStyle && kindClassName
      )}
      style={swatchStyle ? swatchStyle : accentStyle}
    >
      <span className="truncate font-medium">{label}</span>
      {showPrice && (
        <span
          className={cn(
            'shrink-0 text-xs font-bold tabular-nums',
            swatchStyle ? 'text-success-text' : 'text-success-text'
          )}
          lang={locale === 'ar' ? 'ar' : 'en'}
        >
          {priceText}
        </span>
      )}
      <span className="inline-flex shrink-0 items-center gap-0.5 ps-1">
        {onCopy && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            className={cn(
              'inline-flex min-h-9 min-w-9 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring',
              swatchStyle
                ? 'text-on-solid/90 hover:bg-on-solid/15'
                : 'text-muted-foreground hover:bg-border hover:text-foreground'
            )}
            aria-label={copyLabel}
            title={copyLabel}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'inline-flex min-h-9 min-w-9 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-destructive',
            swatchStyle
              ? 'text-on-solid/85 hover:bg-destructive/35 hover:text-on-solid'
              : 'text-muted-foreground hover:bg-danger-bg hover:text-danger-text'
          )}
          aria-label={removeLabel}
          title={removeLabel}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </span>
    </span>
  );
}
