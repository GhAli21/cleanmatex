/**
 * New Order Reducer
 * Handles all state mutations for the new order feature
 */

import type { LineKey, NewOrderState, NewOrderAction, OrderItem, OrderItemMeasure, PreSubmissionPiece } from '../../model/new-order-types';
import { nextPieceId } from '../../model/cart-line-key';
import { isMovableLine } from '../../model/cart-line-grouping';
import { orderItemLinePackingCharge } from '@/lib/utils/order-packing-charges';
import { NEW_ORDER_DEFAULT_SOURCE_CODE } from '@/lib/constants/order-sources';
import { ORDER_TYPE_IDS } from '@/lib/constants/order-types';
import { SERVICE_SPEEDS } from '@/lib/constants/commercial';
import { pricedQty } from '@/lib/utils/order-item-helpers';
import { toMoney } from '@/lib/commercial/money';

/**
 * Base line (qty × unit) plus service prefs charge and packing surcharge (catalog extra_price; per line, not × qty).
 * @param item
 * @param item.quantity
 * @param item.pricePerUnit
 * @param item.servicePrefCharge
 * @param item.packingPrefCharge
 */
function itemLineBasePlusPrefCharges(item: {
  quantity: number;
  /** A measured line multiplies by its billed measure (`pricedQty`), not by `quantity`. */
  uom?: OrderItem['uom'];
  measure?: OrderItem['measure'];
  pricePerUnit: number;
  servicePrefCharge?: number;
  packingPrefCharge?: number;
}): number {
  return (
    pricedQty(item) * item.pricePerUnit +
    (item.servicePrefCharge ?? 0) +
    (item.packingPrefCharge ?? 0)
  );
}

/**
 * Catalog unit price of a cart line (standard speed). Speed premiums are priced
 * by the server from the speed rules and shown from the cart quote (P5-03b), so
 * the client never adds one. Falls back to the price before any override, then
 * to the current price.
 * @param item - the cart line
 * @returns the standard catalog unit price
 */
function catalogUnitPrice(
  item: Pick<OrderItem, 'defaultSellPrice' | 'pricePerUnit' | 'pricePerUnitBeforeOverride'>,
): number {
  return item.defaultSellPrice || (item.pricePerUnitBeforeOverride ?? item.pricePerUnit);
}

/**
 * The line's pieces plus the added ones, renumbered after the line's last piece and
 * keyed to the line. Before this, a merge replaced the line's pieces (and their details) with the new one.
 * @param line the line receiving the pieces
 * @param added the pieces of the tapped product (their ids are discarded)
 * @returns the line's pieces, or undefined when neither side tracks pieces
 */
function appendPieces(line: OrderItem, added: PreSubmissionPiece[] | undefined): PreSubmissionPiece[] | undefined {
  if (!added?.length) return line.pieces;
  const lastSeq = Math.max(0, ...(line.pieces ?? []).map((piece) => piece.pieceSeq));
  return [
    ...(line.pieces ?? []),
    ...added.map((piece, index) => ({
      ...piece,
      id: nextPieceId(line.lineKey, line.pieces, lastSeq + index + 1),
      itemId: line.lineKey,
      pieceSeq: lastSeq + index + 1,
    })),
  ];
}

/** A line's pieces, generating the ones a screen shows for a line that has none stored yet. */
function materializedPieces(line: OrderItem): PreSubmissionPiece[] {
  if (line.pieces?.length) return line.pieces;
  return Array.from({ length: line.quantity }, (_, i) => ({
    id: `temp-${line.lineKey}-${i + 1}`,
    itemId: line.lineKey,
    pieceSeq: i + 1,
  }));
}

/** Copies of preference rows for a new row: a saved row's id would make Order Edit skip the copy. */
function asNewPreferences(prefs: OrderItem['servicePrefs']): OrderItem['servicePrefs'] {
  return prefs?.map((pref) => ({ ...pref, persistedId: undefined }));
}

const renumbered = (pieces: PreSubmissionPiece[]) => pieces.map((piece, i) => ({ ...piece, pieceSeq: i + 1 }));

/**
 * A line's estimates after its pieces changed. The server prices every preference from its code; these
 * client figures only feed the on-screen estimate, and follow the same line + piece extras.
 */
function withEstimates(line: OrderItem, packingPriceByCode: Map<string, number> | undefined): OrderItem {
  const extras = [line.servicePrefs, ...(line.pieces ?? []).map((piece) => piece.servicePrefs)]
    .flatMap((prefs) => prefs ?? [])
    .reduce((sum, pref) => sum + (pref.extra_price ?? 0), 0);
  const piecePacking = line.pieces?.some((piece) => piece.packingPrefCode);
  const next: OrderItem = {
    ...line,
    servicePrefCharge: line.servicePrefCharge == null && extras === 0 ? undefined : extras,
    packingPrefCharge: piecePacking && packingPriceByCode
      ? orderItemLinePackingCharge(line, packingPriceByCode)
      : line.packingPrefCharge,
  };
  return { ...next, totalPrice: itemLineBasePlusPrefCharges(next) };
}

/**
 * Takes one piece off `source` and puts it on `target`, or on a new open line right after the source
 * (catalog price, order speed, no discount; the line's care preferences copied). An emptied source is removed.
 * @param state the cart state
 * @param move the source, the piece (default: the last one), the target, and for a measured split both measures
 * @returns the next state, or the same one when the piece is unknown
 */
function movePiece(
  state: NewOrderState,
  move: {
    source: OrderItem;
    target?: OrderItem;
    pieceId?: string;
    newLineKey: LineKey;
    unitPrice?: number;
    packingPriceByCode?: Map<string, number>;
    measures?: { source: OrderItemMeasure; moved: OrderItemMeasure };
  },
): NewOrderState {
  const { source, target, pieceId, newLineKey, unitPrice, packingPriceByCode, measures } = move;
  // A count line without stored pieces moves by quantity alone, unless a piece is named or the target stores pieces.
  const tracked = Boolean(pieceId || source.pieces?.length || target?.pieces?.length);
  const sourcePieces = tracked ? materializedPieces(source) : [];
  const moved = pieceId ? sourcePieces.find((piece) => piece.id === pieceId) : sourcePieces[sourcePieces.length - 1];
  if (pieceId && !moved) return state;

  const quantity = source.quantity - 1;
  const nextSource = quantity === 0 ? null : withEstimates({
    ...source,
    quantity,
    ...(measures ? { measure: measures.source } : {}),
    pieces: moved ? renumbered(sourcePieces.filter((piece) => piece !== moved)) : source.pieces,
  }, packingPriceByCode);

  const landOn = (lineKey: LineKey, piece: PreSubmissionPiece, pieces: PreSubmissionPiece[]): PreSubmissionPiece => ({
    ...piece,
    id: nextPieceId(lineKey, pieces, pieces.length + 1),
    itemId: lineKey,
    pieceSeq: pieces.length + 1,
  });

  let landed: PreSubmissionPiece | undefined;
  let destination: OrderItem;
  if (target) {
    const pieces = tracked ? materializedPieces(target) : [];
    landed = moved ? landOn(target.lineKey, moved, pieces) : undefined;
    destination = withEstimates({
      ...target,
      quantity: target.quantity + 1,
      pieces: landed ? renumbered([...pieces, landed]) : target.pieces,
    }, packingPriceByCode);
  } else {
    const price = unitPrice ?? catalogUnitPrice(source);
    landed = moved
      ? { ...landOn(newLineKey, moved, []), persistedId: undefined, servicePrefs: asNewPreferences(moved.servicePrefs) }
      : undefined;
    destination = withEstimates({
      ...source,
      lineKey: newLineKey,
      persistedItemId: undefined,
      piecePriced: undefined,
      quantity: 1,
      ...(measures ? { measure: measures.moved } : {}),
      notes: undefined,
      priceOverride: null,
      overrideReason: null,
      overrideBy: null,
      pricePerUnitBeforeOverride: undefined,
      pricePerUnit: price,
      defaultSellPrice: unitPrice ?? source.defaultSellPrice,
      serviceSpeed: null,
      lineDiscount: null,
      servicePrefs: asNewPreferences(source.servicePrefs),
      pieces: landed ? [landed] : undefined,
    }, packingPriceByCode);
  }

  const items = state.items.flatMap((item) => {
    if (item === source) return [...(nextSource ? [nextSource] : []), ...(target ? [] : [destination])];
    return item === target ? [destination] : [item];
  });
  // The selection follows the piece, whose id changed with its line.
  const selectedPieceId = moved && state.selectedPieceId === moved.id ? landed?.id ?? null : state.selectedPieceId;
  return { ...state, items, selectedPieceId };
}

/**
 * Initial state
 */
/**
 * Check if all items are retail (RETAIL_ITEMS)
 * @param items
 */
function isRetailOnlyItems(items: { serviceCategoryCode?: string }[]): boolean {
  return items.length > 0 && items.every((i) => i.serviceCategoryCode === 'RETAIL_ITEMS');
}

export const initialState: NewOrderState = {
  // Customer
  customer: null,
  customerName: '',
  customerMobile: '',
  customerEmail: '',
  customerNameSnapshot: '',
  isDefaultCustomer: false,
  customerSnapshotOverride: null,
  customerNotes: '',
  paymentNotes: '',

  // Order Items
  items: [],

  // B18 — order-level preferences
  orderServicePrefs: [],

  // Order Settings
  branchId: null,
  // Counter entry is the safe staff default; reset restores it rather than carrying context to a new sale.
  orderTypeId: ORDER_TYPE_IDS.POS,
  orderSourceCode: NEW_ORDER_DEFAULT_SOURCE_CODE,
  isQuickDrop: false,
  quickDropQuantity: 0,
  serviceSpeed: SERVICE_SPEEDS.STANDARD,
  notes: '',
  readyByAt: '',
  bags: 0,

  // UI State
  loading: false,
  createdOrderId: null,
  createdOrderStatus: null,
  pendingPhotos: [],

  // Modal States
  modals: {
    customerPicker: false,
    customerEdit: false,
    payment: false,
    customItem: false,
    photoCapture: false,
    readyBy: false,
    priceOverride: false,
  },
  priceOverrideItemId: null,

  // Data
  categories: [],
  products: [],
  selectedCategory: '',

  // Loading States
  isInitialLoading: true,
  categoriesLoading: true,
  productsLoading: false,

  // Edit Mode State
  isEditMode: false,
  editingOrderId: null,
  editingOrderNo: null,
  originalOrderData: null,
  lockInfo: null,
  expectedUpdatedAt: null,

  // Customer/Order/Item/Pieces Preferences
  selectedPieceId: null,
  measureRecheck: null,
};

/**
 * Applies draft changes while retaining the explicit creation context until the order resets.
 *
 * @param state - Current in-memory New Order draft.
 * @param action - A validated UI intent, including workflow type or source selection.
 * @returns The next immutable draft state.
 */
export function newOrderReducer(
  state: NewOrderState,
  action: NewOrderAction
): NewOrderState {
  switch (action.type) {
    case 'SET_CUSTOMER': {
      const { customer, customerName, customerMobile, customerEmail, customerNameSnapshot, isDefaultCustomer } =
        action.payload;
      const displayName = customerNameSnapshot ?? customerName;
      return {
        ...state,
        customer,
        customerName: customerName ?? displayName ?? '',
        customerMobile: customerMobile ?? customer?.phone ?? '',
        customerEmail: customerEmail ?? customer?.email ?? '',
        customerNameSnapshot: displayName ?? customer?.displayName ?? customer?.name ?? '',
        isDefaultCustomer: isDefaultCustomer ?? false,
        customerSnapshotOverride: null,
      };
    }

    case 'SET_CUSTOMER_SNAPSHOT_OVERRIDE':
      return {
        ...state,
        customerSnapshotOverride: action.payload,
      };

    case 'SET_BRANCH_ID':
      if (state.branchId === action.payload) {
        return state;
      }
      return {
        ...state,
        branchId: action.payload,
      };

    // These remain independent: fulfillment selects workflow behavior, while source records origin.
    case 'SET_ORDER_TYPE_ID':
      return {
        ...state,
        orderTypeId: action.payload,
      };

    case 'SET_ORDER_SOURCE_CODE':
      return {
        ...state,
        orderSourceCode: action.payload,
      };

    case 'SET_ITEMS': {
      const newItems = action.payload;
      const retailReadyBy =
        isRetailOnlyItems(newItems) && !state.readyByAt
          ? new Date().toISOString()
          : state.readyByAt;
      return {
        ...state,
        items: newItems,
        readyByAt: retailReadyBy,
      };
    }

    case 'ADD_ITEM': {
      // The caller's add rule (`resolveCartAddTarget`) chose the line; the reducer never merges on its own (DESIGN §4).
      const existingItem = action.mergeInto
        ? state.items.find((item) => item.lineKey === action.mergeInto)
        : undefined;

      let newItems: typeof state.items;
      if (existingItem) {
        const measure = action.mergedMeasure ?? existingItem.measure;
        newItems = state.items.map((item) =>
          item.lineKey === existingItem.lineKey
            ? {
                ...item,
                quantity: item.quantity + 1,
                measure,
                totalPrice: itemLineBasePlusPrefCharges({
                  quantity: item.quantity + 1,
                  uom: item.uom,
                  measure,
                  pricePerUnit: item.pricePerUnit,
                  servicePrefCharge: item.servicePrefCharge,
                  packingPrefCharge: item.packingPrefCharge,
                }),
                pieces: appendPieces(item, action.payload.pieces),
              }
            : item
        );
      } else {
        newItems = [...state.items, action.payload];
      }

      const retailReadyBy =
        isRetailOnlyItems(newItems) && !state.readyByAt
          ? new Date().toISOString()
          : state.readyByAt;

      return {
        ...state,
        items: newItems,
        readyByAt: retailReadyBy,
      };
    }

    case 'SPLIT_MEASURED_SHARE': {
      const { lineKey, newLineKey, share, unitPrice, packingPriceByCode } = action.payload;
      const source = state.items.find((item) => item.lineKey === lineKey);
      if (!source || source.quantity < 2 || !source.measure) return state;
      const remaining = toMoney(source.measure.measuredQty).minus(share).toString();
      return movePiece(state, {
        source,
        newLineKey,
        unitPrice,
        packingPriceByCode,
        measures: {
          source: { measuredQty: remaining, length: '', width: '' },
          moved: { measuredQty: share, length: '', width: '' },
        },
      });
    }

    case 'MOVE_PIECE': {
      const { lineKey, pieceId, toLineKey, newLineKey, unitPrice, packingPriceByCode } = action.payload;
      const source = state.items.find((item) => item.lineKey === lineKey);
      const target = toLineKey ? state.items.find((item) => item.lineKey === toLineKey) : undefined;
      if (!source || !isMovableLine(source)) return state;
      if (toLineKey) {
        if (!target || target === source || target.productId !== source.productId || !isMovableLine(target)) return state;
      } else if (source.quantity < 2) {
        return state;
      }
      return movePiece(state, { source, target, pieceId, newLineKey, unitPrice, packingPriceByCode });
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.lineKey !== action.payload),
      };

    case 'UPDATE_ITEM_QUANTITY': {
      const { lineKey, quantity } = action.payload;

      if (quantity === 0) {
        return {
          ...state,
          items: state.items.filter((item) => item.lineKey !== lineKey),
        };
      }

      return {
        ...state,
        items: state.items.map((item) => {
          if (item.lineKey !== lineKey) {
            return item;
          }

          let pieces: PreSubmissionPiece[] | undefined = item.pieces;

          if (pieces && pieces.length > 0) {
            if (quantity > pieces.length) {
              const toAdd = quantity - pieces.length;
              const lastSeq =
                pieces.length > 0
                  ? Math.max(...pieces.map((piece) => piece.pieceSeq))
                  : 0;
              const newPieces = [...pieces];
              for (let addIndex = 1; addIndex <= toAdd; addIndex += 1) {
                newPieces.push({
                  id: nextPieceId(item.lineKey, newPieces, lastSeq + addIndex),
                  itemId: item.lineKey,
                  pieceSeq: lastSeq + addIndex,
                });
              }
              pieces = newPieces;
            } else if (quantity < pieces.length) {
              const trimmed = pieces.slice(0, quantity);
              pieces = trimmed.map((piece, index) => ({
                ...piece,
                pieceSeq: index + 1,
              }));
            }
          }

          return {
            ...item,
            quantity,
            totalPrice: itemLineBasePlusPrefCharges({
              quantity,
              uom: item.uom,
              measure: item.measure,
              pricePerUnit: item.pricePerUnit,
              servicePrefCharge: item.servicePrefCharge,
              packingPrefCharge: item.packingPrefCharge,
            }),
            pieces,
          };
        }),
      };
    }

    case 'REQUEST_MEASURE_RECHECK':
      return { ...state, measureRecheck: action.payload };

    case 'CLEAR_MEASURE_RECHECK':
      return state.measureRecheck ? { ...state, measureRecheck: null } : state;

    case 'UPDATE_ITEM_MEASURE': {
      const { lineKey, measure } = action.payload;
      return {
        ...state,
        items: state.items.map((item) =>
          item.lineKey === lineKey
            ? {
                ...item,
                measure,
                totalPrice: itemLineBasePlusPrefCharges({
                  quantity: item.quantity,
                  uom: item.uom,
                  measure,
                  pricePerUnit: item.pricePerUnit,
                  servicePrefCharge: item.servicePrefCharge,
                  packingPrefCharge: item.packingPrefCharge,
                }),
              }
            : item
        ),
      };
    }

    case 'UPDATE_ITEM_PIECES':
      return {
        ...state,
        items: state.items.map((item) => {
          if (item.lineKey !== action.payload.lineKey) {
            return item;
          }

          const pieces = action.payload.pieces;
          const quantity =
            pieces && pieces.length > 0 ? pieces.length : item.quantity;

          return {
            ...item,
            pieces,
            quantity,
            totalPrice: itemLineBasePlusPrefCharges({
              quantity,
              uom: item.uom,
              measure: item.measure,
              pricePerUnit: item.pricePerUnit,
              servicePrefCharge: item.servicePrefCharge,
              packingPrefCharge: item.packingPrefCharge,
            }),
          };
        }),
      };

    case 'UPDATE_ITEM_SERVICE_PREFS': {
      const { lineKey, servicePrefs, servicePrefCharge } = action.payload;
      return {
        ...state,
        items: state.items.map((item) =>
          item.lineKey === lineKey
            ? {
                ...item,
                servicePrefs,
                servicePrefCharge,
                totalPrice: itemLineBasePlusPrefCharges({
                  quantity: item.quantity,
                  uom: item.uom,
                  measure: item.measure,
                  pricePerUnit: item.pricePerUnit,
                  servicePrefCharge,
                  packingPrefCharge: item.packingPrefCharge,
                }),
              }
            : item
        ),
      };
    }

    case 'UPDATE_ORDER_SERVICE_PREFS': {
      const { servicePrefs } = action.payload;
      return {
        ...state,
        orderServicePrefs: servicePrefs,
      };
    }

    case 'UPDATE_ITEM_PACKING_PREF': {
      const {
        lineKey,
        packingPrefCode,
        packingPrefIsOverride,
        packingPrefSource,
        packingCfId,
        packingPrefCharge: packingChargePayload,
      } = action.payload;
      const normalizedCode =
        packingPrefCode != null && String(packingPrefCode).trim() !== ''
          ? String(packingPrefCode).trim()
          : undefined;
      return {
        ...state,
        items: state.items.map((item) => {
          if (item.lineKey !== lineKey) return item;
          const nextPk =
            normalizedCode === undefined
              ? undefined
              : Math.max(0, Number(packingChargePayload ?? 0));
          return {
            ...item,
            packingPrefCode: normalizedCode,
            packingPrefIsOverride: packingPrefIsOverride ?? false,
            packingPrefSource: packingPrefSource ?? 'manual',
            ...(normalizedCode
              ? { packingCfId: packingCfId ?? null, packingPrefCharge: nextPk }
              : {
                  packingCfId: undefined,
                  packingPrefCharge: undefined,
                }),
            totalPrice: itemLineBasePlusPrefCharges({
              quantity: item.quantity,
              uom: item.uom,
              measure: item.measure,
              pricePerUnit: item.pricePerUnit,
              servicePrefCharge: item.servicePrefCharge,
              packingPrefCharge:
                normalizedCode === undefined ? 0 : (nextPk ?? 0),
            }),
          };
        }),
      };
    }

    case 'ADJUST_ITEM_PACKING_PREF_CHARGE': {
      const { lineKey, packingPrefCharge } = action.payload;
      const pk = Math.max(0, Number(packingPrefCharge ?? 0));
      return {
        ...state,
        items: state.items.map((item) =>
          item.lineKey === lineKey
            ? {
                ...item,
                packingPrefCharge: pk,
                totalPrice: itemLineBasePlusPrefCharges({
                  quantity: item.quantity,
                  uom: item.uom,
                  measure: item.measure,
                  pricePerUnit: item.pricePerUnit,
                  servicePrefCharge: item.servicePrefCharge,
                  packingPrefCharge: pk,
                }),
              }
            : item
        ),
      };
    }

    case 'UPDATE_ITEM_NOTES':
      return {
        ...state,
        items: state.items.map((item) =>
          item.lineKey === action.payload.lineKey
            ? { ...item, notes: action.payload.notes }
            : item
        ),
      };

    case 'UPDATE_ITEM_PRICE_OVERRIDE': {
      const { lineKey, priceOverride, overrideReason, overrideBy } = action.payload;
      return {
        ...state,
        items: state.items.map((item) => {
          if (item.lineKey !== lineKey) {
            return item;
          }
          // PF-21: remember the price under the override, so clearing it restores that price
          // instead of keeping the overridden one (which the server would not charge).
          const hadOverride = item.priceOverride !== null && item.priceOverride !== undefined;
          const priceUnderOverride = hadOverride
            ? item.pricePerUnitBeforeOverride ?? catalogUnitPrice(item)
            : item.pricePerUnit;
          const effectivePrice = priceOverride !== null ? priceOverride : priceUnderOverride;
          return {
            ...item,
            priceOverride,
            overrideReason,
            overrideBy,
            pricePerUnitBeforeOverride: priceOverride !== null ? priceUnderOverride : undefined,
            pricePerUnit: effectivePrice,
            totalPrice: itemLineBasePlusPrefCharges({
              quantity: item.quantity,
              uom: item.uom,
              measure: item.measure,
              pricePerUnit: effectivePrice,
              servicePrefCharge: item.servicePrefCharge,
              packingPrefCharge: item.packingPrefCharge,
            }),
          };
        }),
      };
    }

    case 'SET_QUICK_DROP':
      return {
        ...state,
        isQuickDrop: action.payload,
      };

    case 'SET_QUICK_DROP_QUANTITY':
      return {
        ...state,
        quickDropQuantity: action.payload,
      };

    case 'SET_SERVICE_SPEED':
      // Only the speed changes. Prices stay server-owned: the cart quote re-prices
      // every line that follows the order speed, and the cart lists what changed
      // (rule #15). A cashier price override is never touched.
      return { ...state, serviceSpeed: action.payload };

    case 'SET_ITEM_SERVICE_SPEED':
      return {
        ...state,
        items: state.items.map((item) =>
          item.lineKey === action.payload.lineKey
            ? { ...item, serviceSpeed: action.payload.serviceSpeed }
            : item
        ),
      };

    case 'SET_ITEM_LINE_DISCOUNT':
      // Stored as the cashier typed it; the server prices it (P5-03c).
      return {
        ...state,
        items: state.items.map((item) =>
          item.lineKey === action.payload.lineKey
            ? { ...item, lineDiscount: action.payload.lineDiscount }
            : item
        ),
      };

    case 'APPLY_SPEED_TO_ALL_LINES':
      // "Apply to all lines": every line follows the order speed again (§5.4).
      return { ...state, items: state.items.map((item) => ({ ...item, serviceSpeed: null })) };

    case 'SET_BAGS':
      return {
        ...state,
        bags: action.payload,
      };

    case 'SET_NOTES':
      return {
        ...state,
        notes: action.payload,
      };

    case 'SET_CUSTOMER_NOTES':
      return {
        ...state,
        customerNotes: action.payload,
      };

    case 'SET_PAYMENT_NOTES':
      return {
        ...state,
        paymentNotes: action.payload,
      };

    case 'SET_READY_BY_AT':
      return {
        ...state,
        readyByAt: action.payload,
      };

    case 'SET_LOADING':
      if (state.loading === action.payload) {
        return state;
      }
      return {
        ...state,
        loading: action.payload,
      };

    case 'ADD_PENDING_PHOTO':
      return { ...state, pendingPhotos: [...state.pendingPhotos, action.payload] };

    case 'REMOVE_PENDING_PHOTO':
      return { ...state, pendingPhotos: state.pendingPhotos.filter((_, i) => i !== action.payload) };

    case 'SET_CREATED_ORDER':
      return {
        ...state,
        createdOrderId: action.payload.orderId,
        createdOrderStatus: action.payload.status,
      };

    case 'OPEN_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload]: true,
        },
      };

    case 'CLOSE_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          [action.payload]: false,
        },
        // Clear price override itemId when closing price override modal
        priceOverrideItemId: action.payload === 'priceOverride' ? null : state.priceOverrideItemId,
      };

    case 'OPEN_PRICE_OVERRIDE_MODAL':
      return {
        ...state,
        modals: {
          ...state.modals,
          priceOverride: true,
        },
        priceOverrideItemId: action.payload,
      };

    case 'SET_CATEGORIES':
      if (state.categories === action.payload) {
        return state;
      }
      return {
        ...state,
        categories: action.payload,
      };

    case 'SET_PRODUCTS':
      if (state.products === action.payload) {
        return state;
      }
      return {
        ...state,
        products: action.payload,
      };

    case 'SET_SELECTED_CATEGORY':
      if (state.selectedCategory === action.payload) {
        return state;
      }
      return {
        ...state,
        selectedCategory: action.payload,
      };

    case 'SET_CATEGORIES_LOADING':
      if (state.categoriesLoading === action.payload) {
        return state;
      }
      return {
        ...state,
        categoriesLoading: action.payload,
      };

    case 'SET_PRODUCTS_LOADING':
      if (state.productsLoading === action.payload) {
        return state;
      }
      return {
        ...state,
        productsLoading: action.payload,
      };

    case 'SET_INITIAL_LOADING':
      if (state.isInitialLoading === action.payload) {
        return state;
      }
      return {
        ...state,
        isInitialLoading: action.payload,
      };

    case 'RESET_ORDER':
      return {
        ...initialState,
        branchId: state.branchId,
        categories: state.categories,
        products: state.products,
        selectedCategory: state.selectedCategory,
        isInitialLoading: false,
        categoriesLoading: false,
        productsLoading: false,
        selectedPieceId: null,
      };

    case 'ALIGN_CASHIER_SESSION': {
      const nextBranch = action.payload.branchId ?? state.branchId;
      if (action.payload.reset) {
        return {
          ...initialState,
          branchId: nextBranch,
          categories: state.categories,
          products: state.products,
          selectedCategory: state.selectedCategory,
          isInitialLoading: false,
          categoriesLoading: false,
          productsLoading: false,
          selectedPieceId: null,
        };
      }
      if (state.branchId === nextBranch) return state;
      return { ...state, branchId: nextBranch };
    }

    case 'ENTER_EDIT_MODE':
      return {
        ...state,
        isEditMode: true,
        editingOrderId: action.payload.orderId,
        editingOrderNo: action.payload.orderNo,
      };

    case 'LOAD_ORDER_FOR_EDIT': {
      const {
        orderId,
        orderNo,
        customer,
        customerName,
        customerMobile,
        customerEmail,
        branchId,
        items,
        serviceSpeed,
        notes,
        customerNotes,
        paymentNotes,
        readyByAt,
        originalData,
        expectedUpdatedAt,
        orderServicePrefs,
      } = action.payload;

      return {
        ...state,
        isEditMode: true,
        editingOrderId: orderId,
        editingOrderNo: orderNo,
        originalOrderData: originalData,
        expectedUpdatedAt,
        // Load order data into form
        customer,
        customerName,
        customerMobile,
        customerEmail,
        customerNameSnapshot: customerName,
        branchId,
        items,
        serviceSpeed,
        notes,
        customerNotes: customerNotes ?? '',
        paymentNotes: paymentNotes ?? '',
        readyByAt,
        orderServicePrefs: orderServicePrefs ?? [],
      };
    }

    case 'EXIT_EDIT_MODE':
      return {
        ...state,
        pendingPhotos: [],
        isEditMode: false,
        editingOrderId: null,
        editingOrderNo: null,
        originalOrderData: null,
        lockInfo: null,
        expectedUpdatedAt: null,
      };

    case 'SET_LOCK_INFO':
      return {
        ...state,
        lockInfo: action.payload,
      };

    case 'UPDATE_ORIGINAL_ORDER_DATA':
      return {
        ...state,
        originalOrderData: action.payload,
      };

    case 'SET_EXPECTED_UPDATED_AT':
      return {
        ...state,
        expectedUpdatedAt: action.payload,
      };

    case 'SET_SELECTED_PIECE':
      return {
        ...state,
        selectedPieceId: action.payload,
      };

    case 'UPDATE_PIECE_CONDITIONS': {
      const { pieceId, conditions } = action.payload;
      return {
        ...state,
        items: state.items.map((item) => {
          const match = pieceId.startsWith(`temp-${item.lineKey}-`);
          if (!match) return item;
          let pieces = item.pieces;
          if (!pieces || pieces.length === 0) {
            pieces = Array.from({ length: item.quantity }, (_, i) => ({
              id: `temp-${item.lineKey}-${i + 1}`,
              itemId: item.lineKey,
              pieceSeq: i + 1,
            }));
          }
          const hasPiece = pieces.some((p) => p.id === pieceId);
          if (!hasPiece) return item;
          return {
            ...item,
            pieces: pieces.map((p) =>
              p.id === pieceId ? { ...p, conditions: [...conditions] } : p
            ),
          };
        }),
      };
    }

    case 'UPDATE_PIECE_COLOR': {
      const { pieceId, color, colorCodes, colorCfIds } = action.payload;
      const resolved =
        colorCodes != null && colorCodes.length > 0
          ? {
              codes: colorCodes,
              cf: colorCodes.map((_, i) => (colorCfIds?.[i] != null ? colorCfIds[i]! : null)),
            }
          : color != null && color !== ''
            ? { codes: [color], cf: [colorCfIds?.[0] != null ? colorCfIds[0]! : null] }
            : { codes: [] as string[], cf: [] as (string | null)[] };
      return {
        ...state,
        items: state.items.map((item) => {
          if (!item.pieces?.some((p) => p.id === pieceId)) return item;
          return {
            ...item,
            pieces: item.pieces.map((p) =>
              p.id === pieceId
                ? {
                    ...p,
                    color: resolved.codes[0],
                    ...(resolved.codes.length > 0
                      ? { colorCodes: resolved.codes, colorCfIds: resolved.cf }
                      : { colorCodes: undefined, colorCfIds: undefined, color: undefined }),
                  }
                : p
            ),
          };
        }),
      };
    }

    default:
      return state;
  }
}

