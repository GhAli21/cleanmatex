/**
 * Single preference chip: label, optional price, copy + remove.
 */

'use client';

import type { CSSProperties } from 'react';
import { Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { catalogColorChipStyle, parseKindBgHex } from './piece-pref-kind-styles';

export interface PreferenceChipProps {
  label: string;
  extraPrice: number;
  currencyCode: string;
  kindClassName?: string;
  /** Kind color accent (hex from DB) layered under optional Tailwind kindClassName */
  accentStyle?: CSSProperties;
  /** When set (e.g. color prefs), chip uses catalog swatch hex — overrides kind accent */
  catalogColorHex?: string | null;
  onRemove: () => void;
  onCopy: () => void;
  removeLabel: string;
  copyLabel: string;
}

export function PreferenceChip({
  label,
  extraPrice,
  currencyCode,
  kindClassName,
  accentStyle,
  catalogColorHex,
  onRemove,
  onCopy,
  removeLabel,
  copyLabel,
}: PreferenceChipProps) {
  const showPrice = extraPrice > 0.0001;
  const swatchHex = catalogColorHex ? parseKindBgHex(catalogColorHex) : null;
  const swatchStyle = swatchHex ? catalogColorChipStyle(swatchHex) : undefined;

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-sm shadow-sm',
        swatchStyle ? 'border-transparent' : 'border-gray-200/90 bg-white text-gray-900',
        !swatchStyle && kindClassName
      )}
      style={swatchStyle ? swatchStyle : accentStyle}
    >
      <span className="truncate font-medium">{label}</span>
      {showPrice && (
        <span
          className={cn(
            'shrink-0 text-xs font-bold tabular-nums',
            swatchStyle ? 'text-emerald-200' : 'text-emerald-700'
          )}
        >
          +{extraPrice.toFixed(3)} {currencyCode}
        </span>
      )}
      <span className="inline-flex shrink-0 items-center gap-0.5 ps-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className={cn(
            'inline-flex min-h-9 min-w-9 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500',
            swatchStyle
              ? 'text-white/90 hover:bg-white/15'
              : 'text-gray-500 hover:bg-gray-200 hover:text-gray-800'
          )}
          aria-label={copyLabel}
          title={copyLabel}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            'inline-flex min-h-9 min-w-9 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-red-500',
            swatchStyle
              ? 'text-white/85 hover:bg-red-500/35 hover:text-white'
              : 'text-gray-500 hover:bg-red-50 hover:text-red-700'
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
