/**
 * Summary Cart Item Component
 * POS-style cart item for the Order Summary right panel
 * Matches the Order_Summary_Item_Summary_02 design:
 *   seq | ✏ name | price ✏ 🗑
 *   conditions / notes as teal text lines
 */

'use client';

import { memo, useMemo } from 'react';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useLocale } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { useBilingual } from '@/lib/utils/bilingual';
import { cn } from '@/lib/utils';
import { Pencil, Trash2 } from 'lucide-react';
import { STAIN_CONDITIONS } from '@/lib/types/order-creation';
import type { PreSubmissionPiece } from '@/src/features/orders/model/new-order-types';

function humanizePreferenceCode(code: string): string {
  if (!code) return '';
  return code
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Match catalog keys case-insensitively (DB/API often uses upper snake_case; static lists may differ). */
function resolveCatalogLabel(lookup: Record<string, string>, code: string): string | undefined {
  if (!code) return undefined;
  const direct = lookup[code]?.trim();
  if (direct) return direct;
  const needle = code.toLowerCase();
  for (const [key, val] of Object.entries(lookup)) {
    if (key.toLowerCase() === needle && val?.trim()) return val.trim();
  }
  return undefined;
}

/** When catalog has no row: optional match to legacy `STAIN_CONDITIONS` (POS seed list — not authoritative vs DB). */
function legacyStaticConditionLabel(
  code: string,
  getBilingual: (a: string | null | undefined, b: string | null | undefined) => string
): string | undefined {
  const row = STAIN_CONDITIONS.find((s) => s.code.toLowerCase() === code.toLowerCase());
  if (!row) return undefined;
  return getBilingual(row.label, row.label2 ?? null) || row.label;
}

interface ColorCatalogEntry {
  code: string;
  name: string;
  name2?: string | null;
  color_hex?: string | null;
}

interface SummaryCartItemProps {
  itemNumber: number;
  itemId: string;
  productName: string;
  productName2?: string;
  quantity: number;
  totalPrice: number;
  conditions?: string[];
  notes?: string;
  pieces?: PreSubmissionPiece[];
  priceOverride?: number | null;
  overrideReason?: string | null;
  currencyCode?: string;
  trackByPiece?: boolean;
  colorCatalog?: ColorCatalogEntry[];
  /** Bilingual labels for preference / packing codes (piece-level summary chips) */
  preferenceLabelByCode?: Record<string, string>;
  onEditPrice?: () => void;
  onEditNotes?: () => void;
  onDelete: () => void;
}

function SummaryCartItemComponent({
  itemNumber,
  productName,
  productName2,
  quantity,
  totalPrice,
  conditions = [],
  notes,
  pieces = [],
  priceOverride,
  currencyCode = ORDER_DEFAULTS.CURRENCY,
  trackByPiece = false,
  colorCatalog,
  preferenceLabelByCode = {},
  onEditPrice,
  onEditNotes,
  onDelete,
}: SummaryCartItemProps) {
  const isRTL = useRTL();
  const locale = useLocale();
  const { decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const getBilingual = useBilingual();

  const displayName = getBilingual(productName, productName2) || '—';

  // Per-piece preference labels as mini-chips (readable; includes service + packing)
  const piecePreferenceRows = useMemo((): { labels: string[] }[] => {
    const lookup = preferenceLabelByCode;

    const labelForCode = (code: string, fallback: () => string): string => {
      const mapped = resolveCatalogLabel(lookup, code);
      if (mapped) return mapped;
      return fallback();
    };

    if (trackByPiece && pieces.length > 0) {
      const colorOpts = colorCatalog && colorCatalog.length > 0 ? colorCatalog : [];
      return pieces.map((piece) => {
        const labels: string[] = [];
        if (piece.color) {
          const colorEntry = colorOpts.find((c) => c.code === piece.color);
          labels.push(
            labelForCode(piece.color, () =>
              colorEntry ? (getBilingual(colorEntry.name, colorEntry.name2 ?? undefined) || colorEntry.name) : humanizePreferenceCode(piece.color!)
            )
          );
        }
        (piece.conditions ?? []).forEach((code) => {
          labels.push(
            labelForCode(code, () => {
              const legacy = legacyStaticConditionLabel(code, getBilingual);
              return legacy ?? humanizePreferenceCode(code);
            })
          );
        });
        (piece.servicePrefs ?? []).forEach((sp) => {
          labels.push(
            labelForCode(sp.preference_code, () => humanizePreferenceCode(sp.preference_code))
          );
        });
        if (piece.packingPrefCode) {
          labels.push(
            labelForCode(piece.packingPrefCode, () => humanizePreferenceCode(piece.packingPrefCode!))
          );
        }
        if (piece.notes?.trim()) labels.push(piece.notes.trim());
        return { labels };
      });
    }

    const parts: string[] = conditions.map((code) =>
      labelForCode(code, () => {
        const legacy = legacyStaticConditionLabel(code, getBilingual);
        return legacy ?? humanizePreferenceCode(code);
      })
    );
    if (notes?.trim()) parts.push(notes.trim());
    return parts.length > 0 ? [{ labels: parts }] : [];
  }, [trackByPiece, pieces, conditions, notes, colorCatalog, getBilingual, preferenceLabelByCode]);

  const displayPrice = formatMoneyAmountWithCode(totalPrice, {
    currencyCode: currencyCode as string,
    decimalPlaces,
    locale: moneyLocale,
  });

  return (
    <div className={`border-b border-dashed border-gray-200 last:border-b-0 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Main row */}
      <div className={`flex items-center gap-1 px-2 py-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {/* Seq / quantity */}
        <span className="shrink-0 w-5 text-xs font-bold text-gray-700 text-center">
          {quantity}
        </span>

        {/* Pen — edit notes/pieces */}
        {onEditNotes && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditNotes(); }}
            className="shrink-0 p-0.5 text-gray-500 hover:text-purple-600 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-purple-400"
            title="Edit notes / pieces"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}

        {/* Item name */}
        <span className={`flex-1 min-w-0 text-sm text-gray-800 truncate ${isRTL ? 'text-right' : 'text-left'}`}>
          {displayName}
          {priceOverride !== null && priceOverride !== undefined && (
            <span
              className="ms-1 text-xs text-orange-500"
              title={`Price overridden${
                priceOverride != null
                  ? `: ${formatMoneyAmountWithCode(priceOverride, {
                      currencyCode: currencyCode as string,
                      decimalPlaces,
                      locale: moneyLocale,
                    })}`
                  : ''
              }`}
            >
              *
            </span>
          )}
        </span>

        {/* Item number badge */}
        <span className="shrink-0 text-[10px] text-gray-400 hidden sm:inline">{itemNumber}</span>

        {/* Price */}
        <span className="shrink-0 text-sm font-semibold text-gray-900 tabular-nums">
          {displayPrice}
        </span>

        {/* Pen — edit price override */}
        {onEditPrice && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditPrice(); }}
            className="shrink-0 p-0.5 text-gray-500 hover:text-blue-600 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-400"
            title="Override price"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}

        {/* Delete */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="shrink-0 p-0.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
          title="Remove item"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {piecePreferenceRows.some((r) => r.labels.length > 0) && (
        <div className={`px-2 pb-1.5 space-y-1.5 ${isRTL ? 'pe-8' : 'ps-8'}`}>
          {piecePreferenceRows.map((row, i) =>
            row.labels.length === 0 ? null : (
              <div
                key={i}
                className={cn('flex flex-wrap gap-1', isRTL ? 'flex-row-reverse justify-end' : '')}
              >
                {row.labels.map((label, j) => (
                  <span
                    key={`${i}-${j}`}
                    className="inline-flex max-w-full rounded-md border border-teal-200/90 bg-teal-50/90 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-teal-900"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export const SummaryCartItem = memo(SummaryCartItemComponent);
