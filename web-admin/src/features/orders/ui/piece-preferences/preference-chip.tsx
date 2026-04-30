/**
 * Single preference chip: label, optional price, copy + remove.
 */

'use client';

import { Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PreferenceChipProps {
  label: string;
  extraPrice: number;
  currencyCode: string;
  kindClassName?: string;
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
  onRemove,
  onCopy,
  removeLabel,
  copyLabel,
}: PreferenceChipProps) {
  const showPrice = extraPrice > 0.0001;

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
        'border-gray-200 bg-gray-50 text-gray-900',
        kindClassName
      )}
    >
      <span className="truncate font-medium">{label}</span>
      {showPrice && (
        <span className="shrink-0 font-semibold text-gray-800">
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
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full text-gray-500 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          aria-label={removeLabel}
          title={removeLabel}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </span>
    </span>
  );
}
