/**
 * Read-only preference chips for Processing surfaces (Simple + full modal).
 * Color chips use catalog hex for border/fill when available.
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ListChecks } from 'lucide-react';
import { CmxStatusBadge } from '@ui/feedback';
import { CmxButton, Tooltip } from '@ui/primitives';
import { cn } from '@/lib/utils';
import {
  catalogColorChipStyle,
  parseKindBgHex,
} from './piece-pref-kind-styles';
import { labelForPrefCode } from './pref-display-labels';

/** Fallback when catalog has no color_hex — common laundry color codes. */
const NAMED_COLOR_HEX: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  gray: '#6B7280',
  grey: '#6B7280',
  blue: '#2563EB',
  red: '#DC2626',
  green: '#16A34A',
  yellow: '#EAB308',
  brown: '#92400E',
  orange: '#EA580C',
  purple: '#9333EA',
  pink: '#DB2777',
  beige: '#D4B896',
  navy: '#1E3A8A',
  cream: '#FFFDD0',
  ivory: '#FFFFF0',
};

/**
 * Resolve a display hex for a color preference code.
 */
export function resolveColorPrefHex(
  code: string,
  colorHexByCode?: Map<string, string | null> | null
): string | null {
  const key = code.trim();
  if (!key) return null;
  const fromCatalog =
    colorHexByCode?.get(key) ??
    colorHexByCode?.get(key.toUpperCase()) ??
    colorHexByCode?.get(key.toLowerCase());
  const parsedCatalog = fromCatalog ? parseKindBgHex(fromCatalog) : null;
  if (parsedCatalog) return parsedCatalog;
  const named = NAMED_COLOR_HEX[key.toLowerCase().replace(/\s+/g, '_')];
  return named ? parseKindBgHex(named) : null;
}

/**
 * Minimal piece shape needed for read-only preference chips.
 */
export interface PiecePreferenceReadonlySource {
  colorPrefs?: string[] | null;
  packingPrefCode?: string | null;
  servicePrefs?: Array<{ preference_code: string }> | null;
  has_stain?: boolean | null;
  has_damage?: boolean | null;
}

export interface PiecePreferenceReadonlyChipsProps {
  piece: PiecePreferenceReadonlySource;
  /** code → color_hex from catalog (optional). */
  colorHexByCode?: Map<string, string | null> | null;
  /** code → bilingual catalog display name (optional). */
  nameByCode?: Map<string, string> | null;
  /** Max chips before "+N"; omit or 0 = show all. */
  maxVisible?: number;
  /** Item packing default — shows Override when piece differs. */
  itemDefaultPacking?: string | null;
  className?: string;
  /** Compact density for table cells. */
  size?: 'sm' | 'md';
  /** Open full prefs dialog (always-visible button + +N click). */
  onOpenPrefs?: () => void;
  /** Accessible label for the open prefs control. */
  openPrefsLabel?: string;
}

type ChipItem = {
  key: string;
  label: string;
  kind: 'color' | 'packing' | 'service' | 'flag' | 'override';
  colorHex?: string | null;
};

/**
 * Compact read-only preference chip row (display only — no edit/remove).
 */
export function PiecePreferenceReadonlyChips({
  piece,
  colorHexByCode,
  nameByCode = null,
  maxVisible = 5,
  itemDefaultPacking,
  className,
  size = 'sm',
  onOpenPrefs,
  openPrefsLabel,
}: PiecePreferenceReadonlyChipsProps) {
  const tModal = useTranslations('processing.modal');
  const tSimple = useTranslations('processing.simpleModal');
  const openLabel = openPrefsLabel ?? tSimple('prefsOpen');

  const chips = React.useMemo((): ChipItem[] => {
    const list: ChipItem[] = [];

    for (const code of piece.colorPrefs ?? []) {
      if (!code) continue;
      list.push({
        key: `color-${code}`,
        label: `${tModal('color')}: ${labelForPrefCode(code, nameByCode)}`,
        kind: 'color',
        colorHex: resolveColorPrefHex(code, colorHexByCode),
      });
    }

    if (piece.packingPrefCode) {
      list.push({
        key: `packing-${piece.packingPrefCode}`,
        label: `${tModal('packing')}: ${labelForPrefCode(piece.packingPrefCode, nameByCode)}`,
        kind: 'packing',
      });
      if (
        itemDefaultPacking != null &&
        itemDefaultPacking !== '' &&
        piece.packingPrefCode !== itemDefaultPacking
      ) {
        list.push({
          key: 'packing-override',
          label: tModal('packingOverride'),
          kind: 'override',
        });
      }
    }

    for (const p of piece.servicePrefs ?? []) {
      if (!p?.preference_code) continue;
      list.push({
        key: `svc-${p.preference_code}`,
        label: labelForPrefCode(p.preference_code, nameByCode),
        kind: 'service',
      });
    }

    if (piece.has_stain) {
      list.push({
        key: 'flag-stain',
        label: tModal('hasStain'),
        kind: 'flag',
      });
    }
    if (piece.has_damage) {
      list.push({
        key: 'flag-damage',
        label: tModal('hasDamage'),
        kind: 'flag',
      });
    }

    return list;
  }, [piece, colorHexByCode, nameByCode, itemDefaultPacking, tModal]);

  const limit = maxVisible > 0 ? maxVisible : chips.length;
  const visible = chips.slice(0, limit);
  const overflow = chips.slice(limit);

  if (chips.length === 0 && !onOpenPrefs) return null;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      role="list"
      aria-label={tSimple('prefsAria')}
    >
      {visible.map((chip) => (
        <span key={chip.key} role="listitem">
          <ReadonlyPrefChip chip={chip} size={size} />
        </span>
      ))}
      {overflow.length > 0 ? (
        onOpenPrefs ? (
          <CmxButton
            type="button"
            variant="outline"
            size="xs"
            className="h-6 px-1.5 text-[11px]"
            onClick={onOpenPrefs}
            aria-label={tSimple('prefsMoreOpen', { count: overflow.length })}
          >
            {tSimple('prefsMore', { count: overflow.length })}
          </CmxButton>
        ) : (
          <Tooltip content={overflow.map((c) => c.label).join(' · ')}>
            <span
              role="listitem"
              className="inline-flex cursor-default items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {tSimple('prefsMore', { count: overflow.length })}
            </span>
          </Tooltip>
        )
      ) : null}
      {onOpenPrefs ? (
        <CmxButton
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 w-6 shrink-0 p-0"
          onClick={onOpenPrefs}
          aria-label={openLabel}
        >
          <ListChecks className="h-3.5 w-3.5" aria-hidden />
        </CmxButton>
      ) : null}
    </div>
  );
}

function ReadonlyPrefChip({
  chip,
  size,
}: {
  chip: ChipItem;
  size: 'sm' | 'md';
}) {
  if (chip.kind === 'override') {
    return (
      <CmxStatusBadge label={chip.label} variant="warning" size={size} />
    );
  }
  if (chip.kind === 'flag') {
    return (
      <CmxStatusBadge
        label={chip.label}
        variant={chip.key === 'flag-damage' ? 'error' : 'warning'}
        size={size}
      />
    );
  }

  if (chip.kind === 'color' && chip.colorHex) {
    const style = catalogColorChipStyle(chip.colorHex);
    return (
      <span
        className={cn(
          'inline-flex max-w-full items-center truncate rounded-md border font-medium shadow-sm',
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        )}
        style={style}
        title={chip.label}
      >
        {chip.label}
      </span>
    );
  }

  // Color without hex, packing, service — outline badge
  return (
    <CmxStatusBadge label={chip.label} variant="outline" size={size} />
  );
}

/**
 * Build code → color_hex map from catalog color preferences.
 */
export function buildColorHexByCode(
  colors: Array<{ code: string; color_hex?: string | null }>
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const c of colors) {
    if (!c?.code) continue;
    map.set(c.code, c.color_hex ?? null);
    map.set(c.code.toLowerCase(), c.color_hex ?? null);
    map.set(c.code.toUpperCase(), c.color_hex ?? null);
  }
  return map;
}
