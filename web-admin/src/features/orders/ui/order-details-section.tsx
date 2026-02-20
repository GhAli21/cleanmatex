/**
 * Order Details Section
 * Tab 2: Detailed view of all items in the current new order
 */

'use client';

import { Fragment, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2, Minus, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useBilingual } from '@/lib/utils/bilingual';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { useOrderTotals } from '../hooks/use-order-totals';
import type { PreSubmissionPiece } from '../model/new-order-types';
import { CmxInput, CmxTextarea, CmxCheckbox } from '@ui/primitives';

const VIRTUALIZED_ITEM_LIMIT = 100;

interface OrderDetailsSectionProps {
  trackByPiece: boolean;
}

export function OrderDetailsSection({ trackByPiece }: OrderDetailsSectionProps) {
  const {
    state,
    updateItemQuantity,
    updateItemNotes,
    updateItemPieces,
    removeItem,
  } = useNewOrderStateWithDispatch();
  const totals = useOrderTotals();
  const isRTL = useRTL();
  const tNewOrder = useTranslations('newOrder');
  const tItems = useTranslations('newOrder.itemsGrid');
  const tPieces = useTranslations('newOrder.pieces');
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
    productId: string,
    pieceId: string,
    updates: Partial<PreSubmissionPiece>,
  ) => {
    const item = state.items.find((candidate) => candidate.productId === productId);
    if (!item) return;

    const existingPieces: PreSubmissionPiece[] = item.pieces ?? [];
    const updatedPieces = existingPieces.map((piece) =>
      piece.id === pieceId ? { ...piece, ...updates } : piece,
    );

    updateItemPieces(productId, updatedPieces);
  };

  const handleAddPiece = (productId: string) => {
    const item = state.items.find((candidate) => candidate.productId === productId);
    if (!item) return;

    const existingPieces: PreSubmissionPiece[] = item.pieces ?? [];
    const nextSeq =
      existingPieces.length > 0
        ? Math.max(...existingPieces.map((piece) => piece.pieceSeq)) + 1
        : 1;

    const newPiece: PreSubmissionPiece = {
      id: `temp-${productId}-${nextSeq}`,
      itemId: productId,
      pieceSeq: nextSeq,
    };

    updateItemPieces(productId, [...existingPieces, newPiece]);
  };

  const handleRemovePiece = (productId: string, pieceId: string) => {
    const item = state.items.find((candidate) => candidate.productId === productId);
    if (!item) return;

    const existingPieces: PreSubmissionPiece[] = item.pieces ?? [];
    const filteredPieces = existingPieces.filter((piece) => piece.id !== pieceId);
    const resequenced = filteredPieces.map((piece, index) => ({
      ...piece,
      pieceSeq: index + 1,
    }));

    updateItemPieces(productId, resequenced);
  };

  if (!hasItems) {
    return (
      <div className="bg-white rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-500">
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
      className="bg-white rounded-lg border border-gray-200 shadow-sm"
    >
      <div
        className={`px-4 py-3 border-b border-gray-200 flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''
          }`}
      >
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h2 className="text-sm font-semibold text-gray-900">
            {tItems('orderItems') || 'Order Items'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {trackByPiece
              ? `${totalPieces} ${tPieces('totalPieces') || 'total pieces'}`
              : `${totalQuantity} ${tItems('pieces') || 'items'}`}
          </p>
        </div>
        <div className={isRTL ? 'text-left' : 'text-right'}>
          <p className="text-xs text-gray-500">
            {tItems('total') || 'Total'}
          </p>
          <p className="text-lg font-bold text-gray-900">
            OMR {totals.subtotal.toFixed(3)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[60vh]">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr
              className={isRTL ? 'text-right' : 'text-left'}
            >
              <th className="px-3 py-2 font-semibold">
                {tItems('itemName') || tItems('addItem') || 'Item'}
              </th>
              <th className="px-3 py-2 font-semibold">
                {tItems('serviceCategory') || 'Service Category'}
              </th>
              <th className="px-3 py-2 font-semibold">
                {tItems('qtyLabel') || 'Qty'}
              </th>
              <th className="px-3 py-2 font-semibold">
                {tItems('priceLabel') || 'Price'}
              </th>
              <th className="px-3 py-2 font-semibold">
                {tItems('total') || 'Total'}
              </th>
              <th className="px-3 py-2 font-semibold">
                {tItems('note') || 'Note'}
              </th>
              <th className="px-3 py-2 font-semibold text-center">
                {tItems('actions') || 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <Fragment key={item.productId}>
                {/* Parent item row */}
                <tr className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 align-top">
                    <div
                      className={`text-sm font-medium text-gray-900 ${isRTL ? 'text-right' : 'text-left'
                        }`}
                    >
                      {item.productName || tItems('unknownProduct') || 'Item'}
                    </div>
                    {item.productName2 && (
                      <div
                        className={`text-xs text-gray-500 ${isRTL ? 'text-right' : 'text-left'
                          }`}
                      >
                        {item.productName2}
                      </div>
                    )}
                    {trackByPiece && (
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedPiecesItems((previous) => {
                            // Allow only one item expanded at a time
                            const isExpanded = previous.has(item.productId);
                            if (isExpanded) {
                              return new Set<string>();
                            }
                            return new Set<string>([item.productId]);
                          });
                        }}
                        className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-gray-700 ${isRTL ? 'flex-row-reverse' : ''
                          } ${expandedPiecesItems.has(item.productId)
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 bg-white hover:bg-gray-100'
                          }`}
                        aria-label={`${tPieces('pieces') || 'Pieces'} (${item.productName || ''
                          })`}
                      >
                        <span>
                          {tPieces('pieces') || 'Pieces'} (
                          {item.pieces?.length ?? 0})
                        </span>
                        {expandedPiecesItems.has(item.productId) ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div
                      className={`text-xs text-gray-700 ${isRTL ? 'text-right' : 'text-left'
                        }`}
                    >
                      {item.serviceCategoryCode
                        ? categoryNameMap.get(item.serviceCategoryCode) ||
                          item.serviceCategoryCode
                        : '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div
                      className={`inline-flex items-center rounded-full border border-gray-300 bg-white text-xs ${isRTL ? 'flex-row-reverse' : ''
                        }`}
                    >
                      <button
                        type="button"
                        aria-label={tItems('decreaseQuantity') || 'Decrease'}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-l-full disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={item.quantity <= 1}
                        onClick={() =>
                          updateItemQuantity(
                            item.productId,
                            Math.max(1, item.quantity - 1),
                          )
                        }
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 min-w-[2rem] text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={tItems('increaseQuantity') || 'Increase'}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-r-full"
                        onClick={() =>
                          updateItemQuantity(item.productId, item.quantity + 1)
                        }
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div
                      className={`text-sm text-gray-900 ${isRTL ? 'text-right' : 'text-left'
                        }`}
                    >
                      OMR {item.pricePerUnit.toFixed(3)}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div
                      className={`text-sm font-semibold text-gray-900 ${isRTL ? 'text-right' : 'text-left'
                        }`}
                    >
                      OMR {item.totalPrice.toFixed(3)}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="text"
                      value={item.notes ?? ''}
                      onChange={(event) =>
                        updateItemNotes(item.productId, event.target.value)
                      }
                      placeholder={tItems('note') || 'Add note'}
                      className={`w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isRTL ? 'text-right' : 'text-left'
                        }`}
                    />
                  </td>
                  <td className="px-3 py-2 align-top text-center">
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="inline-flex items-center justify-center p-1.5 text-red-600 hover:bg-red-50 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                      aria-label={
                        tItems('removeItem') || 'Remove item from order'
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>

                {/* Child rows: pieces */}
                {trackByPiece &&
                  expandedPiecesItems.has(item.productId) &&
                  (item.pieces ?? []).map((piece) => (
                    <tr key={piece.id} className="bg-gray-50 border-t border-gray-100">
                      <td className="px-6 py-2 align-top" colSpan={7}>
                        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2 shadow-xs">
                          {/* Top row: piece label + main fields */}
                          <div
                            className={`flex flex-wrap items-end gap-3 ${isRTL ? 'flex-row-reverse' : ''
                              }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
                              <span className="text-[11px] font-medium text-gray-700">
                                {tPieces('pieceNumber', {
                                  number: piece.pieceSeq,
                                })}
                              </span>
                            </div>

                            <div className="min-w-[120px]">
                              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                {tPieces('color')}
                              </label>
                              <CmxInput
                                value={piece.color || ''}
                                onChange={(event) =>
                                  handlePieceUpdate(item.productId, piece.id, {
                                    color: event.target.value,
                                  })
                                }
                                placeholder={tPieces('colorPlaceholder')}
                                className="h-7 text-[11px]"
                              />
                            </div>

                            <div className="min-w-[120px]">
                              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                {tPieces('brand')}
                              </label>
                              <CmxInput
                                value={piece.brand || ''}
                                onChange={(event) =>
                                  handlePieceUpdate(item.productId, piece.id, {
                                    brand: event.target.value,
                                  })
                                }
                                placeholder={tPieces('brandPlaceholder')}
                                className="h-7 text-[11px]"
                              />
                            </div>

                            <div className="min-w-[140px]">
                              <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                                {tPieces('rackLocation')}
                              </label>
                              <CmxInput
                                value={piece.rackLocation || ''}
                                onChange={(event) =>
                                  handlePieceUpdate(item.productId, piece.id, {
                                    rackLocation: event.target.value,
                                  })
                                }
                                placeholder={tPieces('rackLocationPlaceholder')}
                                className="h-7 text-[11px]"
                              />
                            </div>

                            <div className="flex items-center gap-3">
                              <CmxCheckbox
                                checked={piece.hasStain || false}
                                onChange={(e) =>
                                  handlePieceUpdate(item.productId, piece.id, {
                                    hasStain: e.target.checked,
                                  })
                                }
                                label={tPieces('hasStain')}
                              />
                              <CmxCheckbox
                                checked={piece.hasDamage || false}
                                onChange={(e) =>
                                  handlePieceUpdate(item.productId, piece.id, {
                                    hasDamage: e.target.checked,
                                  })
                                }
                                label={tPieces('hasDamage')}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemovePiece(item.productId, piece.id)}
                              className="ml-auto inline-flex items-center justify-center rounded-full p-1.5 text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                              aria-label={tPieces('removePiece') || 'Remove piece'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Notes row */}
                          <div>
                            <label className="block text-[10px] font-medium text-gray-600 mb-0.5">
                              {tPieces('notes')}
                            </label>
                            <CmxTextarea
                              value={piece.notes || ''}
                              onChange={(event) =>
                                handlePieceUpdate(item.productId, piece.id, {
                                  notes: event.target.value,
                                })
                              }
                              placeholder={tPieces('notesPlaceholder')}
                              className="h-16 text-[11px] resize-none w-full"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}

                {/* Add piece row */}
                {trackByPiece && expandedPiecesItems.has(item.productId) && (
                  <tr className="bg-gray-50 border-t border-gray-100">
                    <td
                      className="px-6 py-2 text-[11px] text-blue-700 cursor-pointer"
                      colSpan={7}
                    >
                      <button
                        type="button"
                        onClick={() => handleAddPiece(item.productId)}
                        className={`text-blue-700 hover:underline ${isRTL ? 'text-right' : 'text-left'
                          }`}
                      >
                        + {tPieces('addPiece')}
                      </button>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 && (
        <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
          {tNewOrder('itemsGrid.more', { count: hiddenCount }) ||
            `+${hiddenCount} more items not shown for performance`}
        </div>
      )}
    </section>
  );
}


