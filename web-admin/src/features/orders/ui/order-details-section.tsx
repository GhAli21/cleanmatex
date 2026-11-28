/**
 * Order Details Section
 * Tab 2: Detailed view of all items in the current new order
 */

'use client';

import { Fragment, useMemo, useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Trash2, Minus, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import {
  CmxButton,
  CmxInput,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/primitives';
import { useBilingual } from '@/lib/utils/bilingual';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { useOrderTotals } from '../hooks/use-order-totals';
import { usePreferenceCatalog } from '../hooks/use-preference-catalog';
import { PackingPreferenceSelector } from './preferences/PackingPreferenceSelector';
import { PreferencesTabsSection } from './preferences/PreferencesTabsSection';
import { PieceMoveMenu } from './piece-move-menu';
import type { LineKey, PreSubmissionPiece } from '../model/new-order-types';
import { productLineNumber } from '../model/cart-line-grouping';
import { nextPieceId } from '../model/cart-line-key';
import { calculateItemTotal } from '@/lib/utils/order-item-helpers';
import { orderItemLinePackingCharge, packingPreferencePriceMap } from '@/lib/utils/order-packing-charges';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';

const VIRTUALIZED_ITEM_LIMIT = 1000;

interface OrderDetailsSectionProps {
  trackByPiece: boolean;
  /** Tenant currency code (e.g. OMR, SAR) for price display */
  currencyCode?: string;
  /** When true, show packing and service pref selectors per piece (Enterprise) */
  packingPerPieceEnabled?: boolean;
  /** Gate Care Packages (Growth+) */
  bundlesEnabled?: boolean;
  /** Gate Repeat Last Order (Starter+) */
  repeatLastOrderEnabled?: boolean;
  /** Gate Smart Suggestions (Growth+) */
  smartSuggestionsEnabled?: boolean;
  /** Block incompatible prefs (SERVICE_PREF_ENFORCE_COMPATIBILITY) */
  enforcePrefCompatibility?: boolean;
}

/**
 *
 * @param root0
 * @param root0.trackByPiece
 * @param root0.currencyCode
 * @param root0.packingPerPieceEnabled
 * @param root0.bundlesEnabled
 * @param root0.repeatLastOrderEnabled
 * @param root0.smartSuggestionsEnabled
 * @param root0.enforcePrefCompatibility
 */
export function OrderDetailsSection({
  trackByPiece,
  currencyCode = '',
  packingPerPieceEnabled = true, // for testing
  bundlesEnabled = false,
  repeatLastOrderEnabled = true,
  smartSuggestionsEnabled = false,
  enforcePrefCompatibility = false,
}: OrderDetailsSectionProps) {
  const locale = useLocale();
  const { decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const fmtMoney = (amount: number) =>
    formatMoneyAmountWithCode(amount, {
      currencyCode: currencyCode as string,
      decimalPlaces,
      locale: moneyLocale,
    });
  const {
    state,
    updateItemQuantity,
    updateItemNotes,
    updateItemPieces,
    updateItemPackingPref,
    adjustItemPackingCharge,
    removeItem,
  } = useNewOrderStateWithDispatch();
  const { packingPrefs, hasServicePrefs, hasPackingPrefs } =
    usePreferenceCatalog(state.branchId);
  const packingPriceByCode = useMemo(() => packingPreferencePriceMap(packingPrefs), [packingPrefs]);
  const totals = useOrderTotals();
  const tNewOrder = useTranslations('newOrder');
  const tItems = useTranslations('newOrder.itemsGrid');
  const tLines = useTranslations('newOrder.lines');
  const tPieces = useTranslations('newOrder.pieces');
  const tCommon = useTranslations('common');
  const getBilingual = useBilingual();

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of state.categories) {
      map.set(c.service_category_code, getBilingual(c.ctg_name, c.ctg_name2) || c.service_category_code);
    }
    return map;
  }, [state.categories, getBilingual]);

  const [expandedPiecesItems, setExpandedPiecesItems] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);

  const handleSelectPiece = useCallback((pieceId: string) => {
    setSelectedPieceId((prev) => (prev === pieceId ? null : pieceId));
  }, []);

  const hasItems = state.items.length > 0;

  const { visibleItems, hiddenCount } = useMemo(() => {
    if (state.items.length <= VIRTUALIZED_ITEM_LIMIT) {
      return { visibleItems: state.items, hiddenCount: 0 };
    }

    return {
      visibleItems: state.items.slice(0, VIRTUALIZED_ITEM_LIMIT),
      hiddenCount: state.items.length - VIRTUALIZED_ITEM_LIMIT,
    };
  }, [state.items]);

  const totalPieces = useMemo(
    () =>
      state.items.reduce(
        (sum, item) => sum + (item.pieces ? item.pieces.length : 0),
        0,
      ),
    [state.items],
  );

  const totalQuantity = useMemo(
    () => state.items.reduce((sum, item) => sum + item.quantity, 0),
    [state.items],
  );

  const handlePieceUpdate = (
    lineKey: LineKey,
    pieceId: string,
    updates: Partial<PreSubmissionPiece>,
  ) => {
    const item = state.items.find((candidate) => candidate.lineKey === lineKey);
    if (!item) return;

    const existingPieces: PreSubmissionPiece[] = item.pieces ?? [];
    const updatedPieces = existingPieces.map((piece) =>
      piece.id === pieceId ? { ...piece, ...updates } : piece,
    );

    updateItemPieces(lineKey, updatedPieces);
  };

  const handleAddPiece = (lineKey: LineKey) => {
    const item = state.items.find((candidate) => candidate.lineKey === lineKey);
    if (!item) return;

    const existingPieces: PreSubmissionPiece[] = item.pieces ?? [];
    const nextSeq =
      existingPieces.length > 0
        ? Math.max(...existingPieces.map((piece) => piece.pieceSeq)) + 1
        : 1;

    const newPiece: PreSubmissionPiece = {
      id: nextPieceId(lineKey, existingPieces, nextSeq),
      itemId: lineKey,
      pieceSeq: nextSeq,
    };

    updateItemPieces(lineKey, [...existingPieces, newPiece]);
  };

  const handleRemovePiece = (lineKey: LineKey, pieceId: string) => {
    const item = state.items.find((candidate) => candidate.lineKey === lineKey);
    if (!item) return;

    const existingPieces: PreSubmissionPiece[] = item.pieces ?? [];
    // A line left with no pieces is removed; otherwise it would keep its quantity and price with nothing in it.
    if (existingPieces.length <= 1) {
      removeItem(lineKey);
      return;
    }
    const filteredPieces = existingPieces.filter((piece) => piece.id !== pieceId);
    const resequenced = filteredPieces.map((piece, index) => ({
      ...piece,
      pieceSeq: index + 1,
    }));

    updateItemPieces(lineKey, resequenced);
  };

  if (!hasItems) {
    return (
      <div className="bg-card rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
        <p className="font-medium">
          {tItems('noItemsAdded') ||
            'No items added yet. Start from the Select Items tab.'}
        </p>
        <p className="text-sm mt-1">
          {tItems('selectItemsFromGrid') ||
            'Select items from the grid in the Select Items tab to start.'}
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label={tNewOrder('itemsGrid.orderItems') || 'Order items details'}
      className="bg-card rounded-lg border border-border shadow-sm"
    >
      <div
        className="px-4 py-3 border-b border-border flex items-center justify-between"
      >
        <div className="text-start">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">
            {tItems('orderItems') || 'Order Items'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {trackByPiece
              ? `${totalPieces} ${tPieces('totalPieces') || 'total pieces'}`
              : `${totalQuantity} ${tItems('pieces') || 'items'}`}
          </p>
        </div>
        <div className="text-end">
          {totals.servicePrefCharge > 0 ? (
            <div className="space-y-1">
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-muted-foreground">{tItems('itemsSubtotal') || 'Items'}</span>
                <span>{fmtMoney(totals.subtotal - totals.servicePrefCharge)}</span>
              </div>
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-muted-foreground">{tItems('additionalServices') || 'Additional Services'}</span>
                <span>{fmtMoney(totals.servicePrefCharge)}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm font-bold pt-1 border-t border-border">
                <span>{tItems('total') || 'Total'}</span>
                <span>{fmtMoney(totals.subtotal)}</span>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {tItems('total') || 'Total'}
              </p>
              <p className="text-lg font-bold text-foreground">
                {fmtMoney(totals.subtotal)}
              </p>
            </>
          )}
        </div>
      </div>

      <PreferencesTabsSection
        trackByPiece={trackByPiece}
        packingPerPieceEnabled={packingPerPieceEnabled}
        bundlesEnabled={bundlesEnabled}
        repeatLastOrderEnabled={repeatLastOrderEnabled}
        smartSuggestionsEnabled={smartSuggestionsEnabled}
        enforcePrefCompatibility={enforcePrefCompatibility}
        hasServicePrefs={hasServicePrefs}
      />

      <div className="overflow-x-auto max-h-[60vh]">
        <Table className="min-w-full text-xs">
          <TableHeader className="bg-muted text-muted-foreground">
            <TableRow className="text-start">
              <TableHead className="px-3 py-2 font-semibold">
                {tItems('itemName') || tItems('addItem') || 'Item'}
              </TableHead>
              <TableHead className="px-3 py-2 font-semibold">
                {tItems('serviceCategory') || 'Service Category'}
              </TableHead>
              <TableHead className="px-3 py-2 font-semibold">
                {tItems('qtyLabel') || 'Qty'}
              </TableHead>
              <TableHead className="px-3 py-2 font-semibold">
                {tItems('priceLabel') || 'Price'}
              </TableHead>
              <TableHead className="px-3 py-2 font-semibold">
                {tItems('total') || 'Total'}
              </TableHead>
              <TableHead className="px-3 py-2 font-semibold">
                {tItems('note') || 'Note'}
              </TableHead>
              {(hasServicePrefs || hasPackingPrefs) && (
                <TableHead className="px-3 py-2 font-semibold">
                  {tItems('preferences') || 'Preferences'}
                </TableHead>
              )}
              <TableHead className="px-3 py-2 font-semibold text-center">
                {tItems('actions') || 'Actions'}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => (
              <Fragment key={item.lineKey}>
                {/* Parent item row */}
                <TableRow className="border-t border-border hover:bg-muted">
                  <TableCell className="px-3 py-2 align-top">
                    <div className="text-sm font-medium text-foreground text-start">
                      {item.productName || tItems('unknownProduct') || 'Item'}
                      {productLineNumber(state.items, item.lineKey) ? ` · ${tLines('lineNumber', { number: productLineNumber(state.items, item.lineKey) })}` : ''}
                    </div>
                    {item.productName2 && (
                      <div className="text-xs text-muted-foreground text-start">
                        {item.productName2}
                      </div>
                    )}
                    {trackByPiece && (
                      <CmxButton
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setExpandedPiecesItems((previous) => {
                            // Allow only one item expanded at a time
                            const isExpanded = previous.has(item.lineKey);
                            if (isExpanded) {
                              return new Set<string>();
                            }
                            return new Set<string>([item.lineKey]);
                          });
                        }}
                        className={`mt-1 h-auto rounded-full px-2 py-0.5 text-[11px] ${expandedPiecesItems.has(item.lineKey)
                            ? 'border-primary bg-info-bg text-info-text'
                            : 'border-border bg-card hover:bg-muted'
                          }`}
                        aria-label={`${tPieces('pieces') || 'Pieces'} (${item.productName || ''})`}
                      >
                        <span className="tabular-nums">
                          {tPieces('pieces') || 'Pieces'} (
                          {item.pieces?.length ?? 0})
                        </span>
                        {expandedPiecesItems.has(item.lineKey) ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </CmxButton>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <div className="text-xs text-foreground text-start">
                      {item.serviceCategoryCode
                        ? categoryNameMap.get(item.serviceCategoryCode) ||
                          item.serviceCategoryCode
                        : '—'}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <div className="inline-flex items-center rounded-full border border-border bg-card text-xs">
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="xs"
                        aria-label={tItems('decreaseQuantity') || 'Decrease'}
                        className="h-7 w-7 p-0 text-muted-foreground rounded-s-full"
                        disabled={item.quantity <= 1}
                        onClick={() =>
                          updateItemQuantity(
                            item.lineKey,
                            Math.max(1, item.quantity - 1),
                          )
                        }
                      >
                        <Minus className="w-3 h-3" />
                      </CmxButton>
                      <span className="px-2 min-w-[2rem] text-center text-sm font-medium tabular-nums">
                        {item.quantity}
                      </span>
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="xs"
                        aria-label={tItems('increaseQuantity') || 'Increase'}
                        className="h-7 w-7 p-0 text-muted-foreground rounded-e-full"
                        onClick={() =>
                          updateItemQuantity(item.lineKey, item.quantity + 1)
                        }
                      >
                        <Plus className="w-3 h-3" />
                      </CmxButton>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <div className="text-sm text-foreground text-start tabular-nums">
                      <bdi dir="ltr">{fmtMoney(item.pricePerUnit + (item.servicePrefCharge ?? 0) / item.quantity)}</bdi>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <div className="text-sm font-semibold text-foreground text-start tabular-nums">
                      <bdi dir="ltr">{fmtMoney(calculateItemTotal(item))}</bdi>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2 align-top">
                    <CmxInput
                      type="text"
                      value={item.notes ?? ''}
                      onChange={(event) =>
                        updateItemNotes(item.lineKey, event.target.value)
                      }
                      placeholder={tItems('note') || 'Add note'}
                      className="h-8 text-xs text-start"
                    />
                  </TableCell>
                  {(hasServicePrefs || hasPackingPrefs) && (
                    <TableCell className="px-3 py-2 align-top">
                      <div className="flex flex-col gap-2 min-w-[140px]">
                        {hasPackingPrefs && (
                          <>
                            <PackingPreferenceSelector
                              value={item.packingPrefCode}
                              availablePrefs={packingPrefs}
                              onChange={(code, packingCfId) =>
                                updateItemPackingPref(
                                  item.lineKey,
                                  code ?? '',
                                  undefined,
                                  undefined,
                                  packingCfId,
                                  code ? packingPriceByCode.get(code) ?? 0 : 0
                                )
                              }
                            />
                            {packingPerPieceEnabled && trackByPiece && (item.pieces?.length ?? 0) > 0 && item.packingPrefCode && (
                              <CmxButton
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  const code = item.packingPrefCode!;
                                  const cf = item.packingCfId ?? null;
                                  const updatedPieces = (item.pieces ?? []).map((p) => ({
                                    ...p,
                                    packingPrefCode: code,
                                    packingCfId: cf ?? undefined,
                                  }));
                                  updateItemPieces(item.lineKey, updatedPieces);
                                  adjustItemPackingCharge(
                                    item.lineKey,
                                    orderItemLinePackingCharge({ ...item, pieces: updatedPieces }, packingPriceByCode)
                                  );
                                }}
                                className="h-auto px-0 text-[10px]"
                              >
                                {tItems('applyToAllPieces') || 'Apply to all pieces'}
                              </CmxButton>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="px-3 py-2 align-top text-center">
                    <CmxButton
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => removeItem(item.lineKey)}
                      className="h-7 w-7 p-0 text-danger-text hover:bg-danger-bg rounded-full"
                      aria-label={tItems('removeItem') || 'Remove item from order'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </CmxButton>
                  </TableCell>
                </TableRow>

                {/* Child rows: pieces — selectable rows */}
                {trackByPiece &&
                  expandedPiecesItems.has(item.lineKey) &&
                  (item.pieces ?? []).map((piece) => {
                    const isPieceSelected = selectedPieceId === piece.id;
                    return (
                      <TableRow
                        key={piece.id}
                        onClick={() => handleSelectPiece(piece.id)}
                        className={`border-t border-border cursor-pointer transition-colors ${
                          isPieceSelected
                            ? 'bg-info-bg outline outline-2 outline-primary outline-offset-[-2px]'
                            : 'bg-muted hover:bg-info-bg/40'
                        }`}
                      >
                        {/* Piece label */}
                        <TableCell className="px-6 py-2 align-middle text-start">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold ${isPieceSelected ? 'text-primary-text' : 'text-muted-foreground'}`}>
                              {tPieces('pieceNumber', { number: piece.pieceSeq })}
                            </span>
                            {piece.color && /^#[0-9A-Fa-f]{3,8}$/.test(piece.color) && (
                              <span className="w-3 h-3 rounded-full shrink-0 border border-border" style={{ backgroundColor: piece.color }} aria-hidden />
                            )}
                            {piece.color && (
                              <span className="text-xs text-muted-foreground">{piece.color}</span>
                            )}
                          </div>
                        </TableCell>
                        {/* Service category */}
                        <TableCell className="px-3 py-2 align-middle" />
                        {/* Qty placeholder */}
                        <TableCell className="px-3 py-2 align-middle" />
                        {/* Stain / Damage badges */}
                        <TableCell className="px-3 py-2 align-middle text-start" colSpan={2}>
                          <div className="flex flex-wrap gap-1.5">
                            {piece.hasStain && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-warning-bg text-warning-text text-[10px] font-medium">
                                {tPieces('hasStain')}
                              </span>
                            )}
                            {piece.hasDamage && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-danger-bg text-danger-text text-[10px] font-medium">
                                {tPieces('hasDamage')}
                              </span>
                            )}
                            {piece.rackLocation && (
                              <span className="text-[10px] text-muted-foreground">{piece.rackLocation}</span>
                            )}
                            {piece.notes && (
                              <span className="text-[10px] text-muted-foreground italic">{piece.notes}</span>
                            )}
                          </div>
                        </TableCell>
                        {/* Note */}
                        <TableCell className="px-3 py-2 align-middle" />
                        {/* Preferences placeholder */}
                        {(hasServicePrefs || hasPackingPrefs) && (
                          <TableCell className="px-3 py-2 align-middle" />
                        )}
                        {/* Remove */}
                        <TableCell className="px-3 py-2 align-middle text-center whitespace-nowrap">
                          <PieceMoveMenu
                            lineKey={item.lineKey}
                            pieceId={piece.id}
                            pieceNumber={piece.pieceSeq}
                            onMoved={(lineKey, pieceId) => {
                              setExpandedPiecesItems(new Set([lineKey]));
                              setSelectedPieceId(pieceId ?? null);
                            }}
                          />
                          <CmxButton
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={(e) => { e.stopPropagation(); handleRemovePiece(item.lineKey, piece.id); }}
                            className="h-7 w-7 p-0 text-danger-text hover:bg-danger-bg rounded-full"
                            aria-label={tPieces('removePiece') || 'Remove piece'}
                          >
                            <Trash2 className="w-3 h-3" />
                          </CmxButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                {/* Add piece row */}
                {trackByPiece && expandedPiecesItems.has(item.lineKey) && (
                  <TableRow className="bg-muted border-t border-border">
                    <TableCell
                      className="px-6 py-2 text-[11px] text-primary-text cursor-pointer"
                      colSpan={hasServicePrefs || hasPackingPrefs ? 8 : 7}
                    >
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => handleAddPiece(item.lineKey)}
                        className="h-auto px-0 text-primary-text"
                      >
                        + {tPieces('addPiece')}
                      </CmxButton>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {hiddenCount > 0 && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-muted">
          {tNewOrder('itemsGrid.more', { count: hiddenCount }) ||
            `+${hiddenCount} more items not shown for performance`}
        </div>
      )}
    </section>
  );
}


