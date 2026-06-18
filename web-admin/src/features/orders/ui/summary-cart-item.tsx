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
import { pieceColorCodesForDisplay } from '@/src/features/orders/lib/piece-color-utils';

function humanizePreferenceCode(code: string): string {
  if (!code) return '';
  return code
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Match catalog keys case-insensitively (DB/API often uses upper snake_case; static lists may differ).
 * @param lookup
 * @param code
 */
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

function resolveExtraByCode(lookup: Record<string, number>, code: string): number {
  if (!code || !lookup || Object.keys(lookup).length === 0) return 0;
  const direct = lookup[code];
  if (direct != null && Number.isFinite(Number(direct))) return Number(direct);
  const needle = code.toLowerCase();
  for (const [key, val] of Object.entries(lookup)) {
    if (key.toLowerCase() === needle && val != null && Number.isFinite(Number(val))) return Number(val);
  }
  return 0;
}

/**
 * When catalog has no row: optional match to legacy `STAIN_CONDITIONS` (POS seed list — not authoritative vs DB).
 * @param code
 * @param getBilingual
 */
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
  /** Packing catalog surcharges by code (aligns with `org_packing_preference_cf.default_extra_price`) */
  packingExtraPriceByCode?: Record<string, number>;
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
  packingExtraPriceByCode = {},
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

    const appendExtra = (base: string, amount: number): string => {
      const n = Number(amount ?? 0);
      if (!Number.isFinite(n) || n <= 0.0001) return base;
      return `${base} +${formatMoneyAmountWithCode(n, {
        currencyCode: currencyCode as string,
        decimalPlaces,
        locale: moneyLocale,
      })}`;
    };

    if (trackByPiece && pieces.length > 0) {
      const colorOpts = colorCatalog && colorCatalog.length > 0 ? colorCatalog : [];
      return pieces.map((piece) => {
        const labels: string[] = [];
        for (const code of pieceColorCodesForDisplay(piece)) {
          const colorEntry = colorOpts.find((c) => c.code === code);
          labels.push(
            labelForCode(code, () =>
              colorEntry ? (getBilingual(colorEntry.name, colorEntry.name2 ?? undefined) || colorEntry.name) : humanizePreferenceCode(code)
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
          const base = labelForCode(sp.preference_code, () => humanizePreferenceCode(sp.preference_code));
          labels.push(appendExtra(base, Number(sp.extra_price ?? 0)));
        });
        if (piece.packingPrefCode) {
          const code = piece.packingPrefCode;
          const base = labelForCode(code, () => humanizePreferenceCode(code));
          const extra = resolveExtraByCode(packingExtraPriceByCode, code);
          labels.push(appendExtra(base, extra));
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
  }, [
    trackByPiece,
    pieces,
    conditions,
    notes,
    colorCatalog,
    getBilingual,
    preferenceLabelByCode,
    packingExtraPriceByCode,
    currencyCode,
    decimalPlaces,
    moneyLocale,
  ]);

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
