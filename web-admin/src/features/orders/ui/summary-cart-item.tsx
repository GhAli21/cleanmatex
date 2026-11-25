/**
 * Summary Cart Item Component
 * POS-style cart item for the Order Summary right panel
 * Matches the Order_Summary_Item_Summary_02 design:
 *   seq | ✏ name | price ✏ 🗑
 *   conditions / notes as teal text lines
 */

'use client';

import { memo, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { useBilingual } from '@/lib/utils/bilingual';
import { cn } from '@/lib/utils';
import { CmxButton } from '@ui/primitives';
import { ChevronDown, Pencil, Percent, Trash2 } from 'lucide-react';
import { DISCOUNT_SOURCE_TYPE } from '@/lib/constants/discount-source-type';
import { STAIN_CONDITIONS } from '@/lib/types/order-creation';
import type { PreSubmissionPiece } from '@/src/features/orders/model/new-order-types';
import { pieceColorCodesForDisplay } from '@/src/features/orders/lib/piece-color-utils';
import type { CartQuoteLine } from '@/lib/types/cart-quote';
import type { OrderItemMeasure, OrderItemUom } from '../model/new-order-types';
import { CartMeasureNote } from './cart-measure-note';
import { ServiceSpeedSelect } from './service-speed-select';
import { useServiceSpeeds } from '../hooks/use-service-speeds';
import type { SpeedOptionPreviewSource } from '../hooks/use-speed-option-previews';

/** This line's quoted figures (New Order, P5-03b) and its speed menu (also Order Edit, P6-02b). */
export interface SummaryCartItemQuote {
  /** Null before the first answer for this line. */
  line: CartQuoteLine | null;
  pending: boolean;
  /** Order Edit: no quoted figures; the stored line price shows. */
  unquoted?: boolean;
  orderSpeed: string;
  /** The line's own speed; null follows the order speed. */
  lineSpeed: string | null;
  onLineSpeedChange?: (serviceSpeed: string | null) => void;
  lineSpeedDisabled?: boolean;
  /** Prices this line's speed options (New Order only). */
  speedPreview?: SpeedOptionPreviewSource;
  /** Opens the line discount dialog (P5-03c); absent without `orders:discount`. */
  onEditLineDiscount?: () => void;
  /** Sets a piece's own speed (PIECE level, P9-01); null follows the line. */
  onPieceSpeedChange?: (pieceId: string, serviceSpeed: string | null) => void;
  /** Opens the discount dialog for one piece; absent without `orders:discount`. */
  onEditPieceDiscount?: (pieceId: string) => void;
  /** Order Edit has no quote: the stored line says it is priced per piece. */
  piecePriced?: boolean;
}

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
  /** A measured line: its unit, what staff measured, and the re-measure action. */
  uom?: OrderItemUom;
  measure?: OrderItemMeasure;
  onEditMeasure?: () => void;
  /** The line's number among its product's lines; set only when the product has more than one line (Cart Line Grouping §5.5). */
  lineNumber?: number | null;
  /** A measured line with 2+ pieces: move one equal share and its last piece to a new line (§4.3). */
  onSplitMeasuredShare?: () => void;
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
  onEditPreferences?: () => void;
  onDelete: () => void;
  /** When set, the price shown is the server's (Order Edit keeps its own until P6-02). */
  quote?: SummaryCartItemQuote;
}

function SummaryCartItemComponent({
  itemNumber,
  productName,
  productName2,
  uom,
  measure,
  onEditMeasure,
  lineNumber,
  onSplitMeasuredShare,
  quantity,
  totalPrice,
  conditions = [],
  notes,
  pieces = [],
  priceOverride,
  currencyCode = '',
  trackByPiece = false,
  colorCatalog,
  preferenceLabelByCode = {},
  packingExtraPriceByCode = {},
  onEditPrice,
  onEditPreferences,
  onDelete,
  quote,
}: SummaryCartItemProps) {
  const locale = useLocale();
  const tPieces = useTranslations('newOrder.pieces');
  const tSpeed = useTranslations('newOrder.serviceSpeed');
  const tLine = useTranslations('newOrder.lineBreakdown');
  const tLines = useTranslations('newOrder.lines');
  const [expanded, setExpanded] = useState(false);
  const { labelOf: speedLabel } = useServiceSpeeds();
  const { decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const getBilingual = useBilingual();

  const baseName = getBilingual(productName, productName2) || '—';
  const displayName = lineNumber ? `${baseName} · ${tLines('lineNumber', { number: lineNumber })}` : baseName;

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

  const fmt = (amount: number) => formatMoneyAmountWithCode(amount, {
    currencyCode: currencyCode as string,
    decimalPlaces,
    locale: moneyLocale,
  });
  // New Order shows the server's line gross only; before its first answer, a placeholder (never a client sum).
  const shownPrice = quote && !quote.unquoted ? quote.line?.grossAmount ?? null : totalPrice;
  const displayPrice = shownPrice == null ? '…' : fmt(shownPrice);
  const effectiveSpeed = quote ? quote.lineSpeed ?? quote.orderSpeed : null;
  const premium = quote?.line && quote.line.speedPremiumAmount > 0 ? quote.line.speedPremiumAmount : 0;

  // A piece's own speed and discount, for a line priced per piece once pieces are tracked (P9-01).
  const showPieceRows = trackByPiece && pieces.length > 0
    && (quote?.line ? quote.line.pieces.length === pieces.length : quote?.piecePriced === true);
  const pieceRows = pieces.map((piece, k) => (
    <div key={piece.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-1">
      <dt className="min-w-16">{tPieces('pieceNumber', { number: k + 1 })}</dt>
      <dd className="flex items-center gap-2">
        {quote?.onPieceSpeedChange ? (
          <ServiceSpeedSelect
            size="line"
            className="w-32"
            value={piece.serviceSpeed ?? null}
            orderSpeed={quote.lineSpeed ?? quote.orderSpeed}
            onChange={(code) => quote.onPieceSpeedChange?.(piece.id, code)}
            disabled={quote.lineSpeedDisabled}
            disabledReason={tSpeed('locked')}
            ariaLabel={tSpeed('lineAria', { item: `${displayName} ${k + 1}` })}
          />
        ) : null}
        {quote?.onEditPieceDiscount ? (
          <CmxButton
            type="button"
            variant="ghost"
            size="xs"
            onClick={(e) => { e.stopPropagation(); quote.onEditPieceDiscount?.(piece.id); }}
            className="h-auto shrink-0 p-0.5 text-muted-foreground hover:text-success-text"
            aria-label={tLine('discountActionFor', { item: `${displayName} ${k + 1}` })}
          >
            <Percent className="w-3 h-3" />
          </CmxButton>
        ) : null}
        {quote?.line?.pieces[k] ? <span className="tabular-nums">{fmt(quote.line.pieces[k].netAmount)}</span> : null}
      </dd>
    </div>
  ));

  return (
    <div className="border-b border-dashed border-border last:border-b-0 text-start">
      {/* Main row */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        {/* Seq / quantity */}
        <span className="shrink-0 w-5 text-xs font-bold text-foreground text-center">
          {quantity}
        </span>

        {/* Pen — edit item preferences */}
        {onEditPreferences && (
          <CmxButton
            type="button"
            variant="ghost"
            size="xs"
            onClick={(e) => { e.stopPropagation(); onEditPreferences(); }}
            className="h-auto shrink-0 p-0.5 text-muted-foreground hover:text-primary-text"
            title={tPieces('editItemPreferences')}
            aria-label={tPieces('editItemPreferences')}
          >
            <Pencil className="w-3 h-3" />
          </CmxButton>
        )}

        {/* Item name */}
        <span className="flex-1 min-w-0 text-sm text-foreground truncate text-start">
          {displayName}
          {priceOverride !== null && priceOverride !== undefined && (
            <span
              className="ms-1 text-xs text-warning-text"
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
        <span className="shrink-0 text-[10px] text-muted-foreground hidden sm:inline">{itemNumber}</span>

        {/* Price */}
        <span
          className={cn('shrink-0 text-sm font-semibold text-foreground tabular-nums', quote?.pending && 'opacity-50')}
          aria-busy={quote?.pending || undefined}
        >
          {displayPrice}
        </span>

        {/* Line discount (P5-03c) */}
        {quote?.onEditLineDiscount && (
          <CmxButton
            type="button"
            variant="ghost"
            size="xs"
            onClick={(e) => { e.stopPropagation(); quote.onEditLineDiscount?.(); }}
            className="h-auto shrink-0 p-0.5 text-muted-foreground hover:text-success-text"
            title={tLine('discountAction')}
            aria-label={tLine('discountActionFor', { item: displayName })}
          >
            <Percent className="w-3 h-3" />
          </CmxButton>
        )}

        {/* Line breakdown toggle: gross, discounts, net, tax (server figures) */}
        {(quote?.line || (quote?.piecePriced && showPieceRows)) && (
          <CmxButton
            type="button"
            variant="ghost"
            size="xs"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="h-auto shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
            aria-expanded={expanded}
            aria-label={expanded ? tLine('hide', { item: displayName }) : tLine('show', { item: displayName })}
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
          </CmxButton>
        )}

        {/* Pen — edit price override */}
        {onEditPrice && (
          <CmxButton
            type="button"
            variant="ghost"
            size="xs"
            onClick={(e) => { e.stopPropagation(); onEditPrice(); }}
            className="h-auto shrink-0 p-0.5 text-muted-foreground hover:text-primary-text"
            title="Override price"
            aria-label="Override price"
          >
            <Pencil className="w-3 h-3" />
          </CmxButton>
        )}

        {/* Delete */}
        <CmxButton
          type="button"
          variant="ghost"
          size="xs"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-auto shrink-0 p-0.5 text-muted-foreground hover:text-danger-text hover:bg-danger-bg"
          title="Remove item"
          aria-label="Remove item"
        >
          <Trash2 className="w-3 h-3" />
        </CmxButton>
      </div>

      {quote?.piecePriced && !quote.line && expanded && showPieceRows ? (
        <dl className={cn('mx-2 mb-1.5 space-y-0.5 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground', 'ms-8')}>
          {pieceRows}
        </dl>
      ) : null}

      {uom && (
        <div className="px-2 pb-1 ps-8">
          <CartMeasureNote uom={uom} measure={measure} quoted={quote?.line?.measure} onEdit={onEditMeasure} />
          {onSplitMeasuredShare && quantity >= 2 && (
            <CmxButton
              type="button"
              variant="ghost"
              size="xs"
              className="h-auto px-1 py-0.5 text-xs text-primary-text pointer-coarse:min-h-11"
              aria-label={tLines('moveOneShareFor', { item: displayName })}
              onClick={onSplitMeasuredShare}
            >
              {tLines('moveOneShare')}
            </CmxButton>
          )}
        </div>
      )}

      {quote?.line && expanded ? (
        <dl
          className={cn('mx-2 mb-1.5 space-y-0.5 rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground', 'ms-8', quote.pending && 'opacity-50')}
          aria-busy={quote.pending || undefined}
        >
          <div className="flex justify-between gap-2"><dt>{tLine('gross')}</dt><dd className="tabular-nums">{fmt(quote.line.grossAmount)}</dd></div>
          {quote.line.discounts.map((d, i) => (
            <div key={i} className="flex justify-between gap-2 text-success-text">
              <dt>
                {d.source === DISCOUNT_SOURCE_TYPE.PRICE_LIST ? tLine('priceListDiscount') : tLine('lineDiscount')}
                {d.rate != null ? ` (${d.rate}%)` : ''}
              </dt>
              <dd className="tabular-nums">− {fmt(d.amount)}</dd>
            </div>
          ))}
          {quote.line.orderDiscountAllocAmount > 0 ? (
            <div className="flex justify-between gap-2 text-success-text">
              <dt>{tLine('orderDiscountShare')}</dt>
              <dd className="tabular-nums">− {fmt(quote.line.orderDiscountAllocAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-2"><dt>{tLine('net')}</dt><dd className="tabular-nums">{fmt(quote.line.netAmount)}</dd></div>
          <div className="flex justify-between gap-2"><dt>{tLine('tax')}</dt><dd className="tabular-nums">{fmt(quote.line.taxAmount)}</dd></div>
          {showPieceRows ? pieceRows : null}
          <div className="flex justify-between gap-2 font-semibold text-foreground"><dt>{tLine('lineTotal')}</dt><dd className="tabular-nums">{fmt(quote.line.lineTotalAmount)}</dd></div>
        </dl>
      ) : null}

      {quote && (premium > 0 || quote.onLineSpeedChange) ? (
        <div className="flex items-center gap-2 px-2 pb-1.5 ps-8">
          {quote.onLineSpeedChange ? (
            <ServiceSpeedSelect
              size="line"
              className="w-36"
              value={quote.lineSpeed}
              orderSpeed={quote.orderSpeed}
              onChange={quote.onLineSpeedChange}
              preview={quote.speedPreview}
              disabled={quote.lineSpeedDisabled}
              disabledReason={tSpeed('locked')}
              ariaLabel={tSpeed('lineAria', { item: displayName })}
            />
          ) : null}
          {premium > 0 && effectiveSpeed ? (
            <span className={cn('text-[11px] text-warning-text', quote.pending && 'opacity-50')}>
              {tSpeed('premiumIncluded', { speed: speedLabel(effectiveSpeed), amount: fmt(premium) })}
            </span>
          ) : null}
        </div>
      ) : null}

      {piecePreferenceRows.some((r) => r.labels.length > 0) && (
        <div className="px-2 pb-1.5 space-y-1.5 ps-8">
          {piecePreferenceRows.map((row, i) =>
            row.labels.length === 0 ? null : (
              <div
                key={i}
                className={cn('flex flex-wrap gap-1', '')}
              >
                {row.labels.map((label, j) => (
                  <span
                    key={`${i}-${j}`}
                    className="inline-flex max-w-full rounded-md border border-info-border/90 bg-info-bg/90 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-info-text"
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
