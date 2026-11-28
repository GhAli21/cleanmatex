/**
 * use-new-order-state Hook
 * Context consumer with dispatch helpers
 */

import type { LineKey, OrderItemLineDiscount } from '../model/new-order-types';
import { useNewOrderContext } from '../ui/context/new-order-context';
import { newCartLineKey } from '../model/cart-line-key';
import { equalMeasureShare, isMovableLine, productLineNumber } from '../model/cart-line-grouping';
import { newOrderReducer } from '../ui/context/new-order-reducer';
import { useOrderWorkspaceSessionOptional } from '../order-change/order-workspace-session';
import { resolveEditControlCapability, resolveEditControlGroup } from '../order-change/edit-control-capability';
import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import { sameMeasure } from '@/lib/services/order-change/order-change-line-money-compare';
import type { NewOrderAction, NewOrderState, MinimalCustomer, OrderItem, OrderItemMeasure, PreSubmissionPiece, OrderItemServicePref, ServiceCategory, Product, CustomerSnapshotOverride } from '../model/new-order-types';
import type { OrderSourceCode } from '@/lib/constants/order-sources';
import type { OrderTypeId } from '@/lib/constants/order-types';

/** Why a piece can't move: a measured or custom line, a saved piece (Order Edit), or the Edit policy. */
export type PieceMoveBlock = 'NOT_MOVABLE' | 'SAVED_PIECE' | 'BLOCKED';

/**
 * Optional snapshot when setting customer (for org_orders_mst columns)
 */
export interface SetCustomerSnapshot {
  customerMobile?: string;
  customerEmail?: string;
  customerNameSnapshot?: string;
  isDefaultCustomer?: boolean;
}

/**
 * Reducer state with the mutation helpers used by New Order surfaces.
 * The context itself owns order type and source so every submission path shares
 * one creation contract.
 */
export interface UseNewOrderStateWithDispatchReturn {
  state: NewOrderState;
  dispatch: ReturnType<typeof useNewOrderContext>['dispatch'];
  setCustomer: (customer: MinimalCustomer | null, customerName: string, snapshot?: SetCustomerSnapshot) => void;
  setCustomerSnapshotOverride: (override: CustomerSnapshotOverride | null) => void;
  setBranchId: (branchId: string | null) => void;
  /** Changes the fulfillment classification before the new order is submitted. */
  setOrderTypeId: (orderTypeId: OrderTypeId) => void;
  /** Changes the auditable sales or integration channel before submission. */
  setOrderSourceCode: (orderSourceCode: OrderSourceCode) => void;
  /**
   * Adds a new line, or one more piece on `mergeInto` (chosen by the add rule). In Order Edit a merge needs
   * the quantity and piece policy cells (and the measure cell for `mergedMeasure`); when they are blocked
   * the piece becomes a new line if `ADD_ITEM` is allowed.
   * @returns the line the piece went to, or null when refused
   */
  addItem: (item: OrderItem, mergeInto?: LineKey, mergedMeasure?: OrderItemMeasure) => LineKey | null;
  /**
   * Moves one equal measure share and the last piece of a measured line to a new line (DESIGN §4.3).
   * @returns `OK`, or why nothing changed
   */
  splitMeasuredShare: (lineKey: LineKey, packingPriceByCode?: Map<string, number>) => 'OK' | 'NOT_EXACT' | 'SAVED_PIECE' | 'BLOCKED';
  /**
   * Why a piece (default: the line's last) can't move to `toLineKey`, or to a new line when omitted.
   * @returns null when the move is allowed
   */
  pieceMoveBlock: (lineKey: LineKey, pieceId?: string, toLineKey?: LineKey) => PieceMoveBlock | null;
  /**
   * Moves one piece between lines of a product (DESIGN §5).
   * @returns the line that received it and the piece's new id, or why nothing changed
   */
  movePiece: (
    lineKey: LineKey,
    move?: { pieceId?: string; toLineKey?: LineKey; packingPriceByCode?: Map<string, number> },
  ) => { status: 'OK'; lineKey: LineKey; lineNumber: number; pieceId?: string } | { status: PieceMoveBlock };
  removeItem: (lineKey: LineKey) => boolean;
  /** @returns false when the change was held for a measure check (measured line) or refused; true when applied. */
  updateItemQuantity: (lineKey: LineKey, quantity: number) => boolean;
  /** Changes what was measured on a measured line (kg, m, length × width). */
  updateItemMeasure: (lineKey: LineKey, measure: OrderItemMeasure) => void;
  /** @returns false when the change was held for a measure check (measured line) or refused; true when applied. */
  updateItemPieces: (lineKey: LineKey, pieces: PreSubmissionPiece[] | undefined) => boolean;
  /**
   * Applies the held piece-count change and the measure staff confirmed (kept or changed).
   * @returns `MEASURE_BLOCKED` when the measure changed but the Edit policy does not allow it (nothing applied); else `APPLIED` with the action that was applied
   */
  confirmMeasureRecheck: (measure: OrderItemMeasure) => { status: 'APPLIED'; deferred: NewOrderAction } | { status: 'MEASURE_BLOCKED' | 'NONE' };
  /** Drops the held piece-count change: the count stays as it was. */
  cancelMeasureRecheck: () => void;
  updateItemServicePrefs: (lineKey: LineKey, servicePrefs: OrderItemServicePref[], servicePrefCharge: number) => void;
  updateOrderServicePrefs: (servicePrefs: OrderItemServicePref[]) => void;
  updateItemPackingPref: (
    lineKey: LineKey,
    packingPrefCode: string,
    packingPrefIsOverride?: boolean,
    packingPrefSource?: string,
    packingCfId?: string | null,
    packingPrefCharge?: number
  ) => void;
  adjustItemPackingCharge: (lineKey: LineKey, packingPrefCharge: number) => void;
  updateItemNotes: (lineKey: LineKey, notes: string) => void;
  updateItemPriceOverride: (lineKey: LineKey, priceOverride: number | null, overrideReason: string, overrideBy: string) => void;
  setQuickDrop: (value: boolean) => void;
  setQuickDropQuantity: (quantity: number) => void;
  /** Sets the order speed (`sys_service_speed_cd.code`). */
  setServiceSpeed: (serviceSpeed: string) => void;
  /** Gives one line its own speed; null makes it follow the order speed. */
  setItemServiceSpeed: (lineKey: LineKey, serviceSpeed: string | null) => void;
  /** Sets or (with null) removes a cashier discount on one line. */
  setItemLineDiscount: (lineKey: LineKey, lineDiscount: OrderItemLineDiscount | null) => void;
  /** Every line follows the order speed again. */
  applySpeedToAllLines: () => void;
  setBags: (count: number) => void;
  setNotes: (notes: string) => void;
  setCustomerNotes: (notes: string) => void;
  setPaymentNotes: (notes: string) => void;
  setReadyByAt: (readyByAt: string) => void;
  setLoading: (loading: boolean) => void;
  setCreatedOrder: (orderId: string, status: string | null) => void;
  openModal: (modal: keyof NewOrderState['modals']) => void;
  closeModal: (modal: keyof NewOrderState['modals']) => void;
  openPriceOverrideModal: (lineKey: LineKey) => void;
  setCategories: (categories: ServiceCategory[]) => void;
  setProducts: (products: Product[]) => void;
  setSelectedCategory: (category: string) => void;
  setCategoriesLoading: (loading: boolean) => void;
  setProductsLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  resetOrder: () => void;
  setSelectedPiece: (pieceId: string | null) => void;
  updatePieceConditions: (pieceId: string, conditions: string[]) => void;
  updatePieceColor: (pieceId: string, color: string | undefined, colorCodes?: string[], colorCfIds?: (string | null)[]) => void;
}

/**
 * Provides reducer state and stable-looking semantic dispatch helpers for New Order UI.
 *
 * @returns Current draft state and actions, including order type and source setters.
 * @example
 * const { state, setOrderTypeId } = useNewOrderStateWithDispatch();
 * setOrderTypeId('HOME_COLLECTION');
 */
export function useNewOrderStateWithDispatch(): UseNewOrderStateWithDispatchReturn {
  const { state, dispatch } = useNewOrderContext();
  const editSession = useOrderWorkspaceSessionOptional();
  const identityLocked = editSession != null;
  const blocked = (code: OrderChangeOperationCode, targetType?: 'ORDER' | 'ITEM') =>
    editSession != null && !resolveEditControlCapability(editSession.editPolicy, code, targetType).interactive;
  const groupBlocked = (codes: readonly OrderChangeOperationCode[]) =>
    editSession != null && !resolveEditControlGroup(editSession.editPolicy, codes).interactive;

  /**
   * A measured line is billed on its total measure, so a piece-count change that leaves the measure alone
   * can add a free garment. The change is held (nothing applied) and the Measure dialog asks staff to check the
   * total; the measure is never changed automatically. Removing the line (quantity 0) is not held.
   * @returns true when the change was held
   */
  const holdForMeasure = (lineKey: LineKey, nextQuantity: number, deferred: NewOrderAction): boolean => {
    const item = state.items.find((i) => i.lineKey === lineKey);
    if (!item?.uom || nextQuantity <= 0 || nextQuantity === item.quantity) return false;
    dispatch({ type: 'REQUEST_MEASURE_RECHECK', payload: { lineKey, from: item.quantity, to: nextQuantity, deferred } });
    return true;
  };

  /** Today's catalog price of a line's product, when that product is loaded. */
  // shortcut: only the selected category's products are loaded; otherwise a line moved to new shows the source's
  // price until the server prices it (quote on New Order, review on Order Edit). Fetch by id if staff report it.
  const todaysPrice = (lineKey: LineKey): number | undefined => {
    const productId = state.items.find((item) => item.lineKey === lineKey)?.productId;
    return state.products?.find((product) => product.id === productId)?.default_sell_price ?? undefined;
  };

  const pieceMoveBlock = (lineKey: LineKey, pieceId?: string, toLineKey?: LineKey): PieceMoveBlock | null => {
    const source = state.items.find((item) => item.lineKey === lineKey);
    if (!source || !isMovableLine(source)) return 'NOT_MOVABLE';
    const piece = pieceId ? source.pieces?.find((p) => p.id === pieceId) : source.pieces?.[source.pieces.length - 1];
    // Order Edit: only a piece added during this edit can move; a saved piece keeps its line (DESIGN §5.3).
    if (piece?.persistedId) return 'SAVED_PIECE';
    if (groupBlocked(['CHANGE_ITEM_QUANTITY', 'ADD_PIECE', 'REMOVE_PIECE']) || (!toLineKey && blocked('ADD_ITEM'))) return 'BLOCKED';
    return null;
  };

  // Helper functions for common actions. An Edit session keeps committed commercial identity here.
  const actions = {
    setCustomer: (customer: typeof state.customer, customerName: string, snapshot?: SetCustomerSnapshot) => {
      if (identityLocked) return;
      dispatch({
        type: 'SET_CUSTOMER',
        payload: {
          customer,
          customerName,
          ...(snapshot && {
            customerMobile: snapshot.customerMobile,
            customerEmail: snapshot.customerEmail,
            customerNameSnapshot: snapshot.customerNameSnapshot,
            isDefaultCustomer: snapshot.isDefaultCustomer,
          }),
        },
      });
    },

    setCustomerSnapshotOverride: (override: CustomerSnapshotOverride | null) => {
      if (identityLocked) return;
      dispatch({ type: 'SET_CUSTOMER_SNAPSHOT_OVERRIDE', payload: override });
    },

    setBranchId: (branchId: string | null) => {
      if (identityLocked) return;
      dispatch({ type: 'SET_BRANCH_ID', payload: branchId });
    },

    setOrderTypeId: (orderTypeId: OrderTypeId) => {
      if (identityLocked) return;
      dispatch({ type: 'SET_ORDER_TYPE_ID', payload: orderTypeId });
    },

    setOrderSourceCode: (orderSourceCode: OrderSourceCode) => {
      if (identityLocked) return;
      dispatch({ type: 'SET_ORDER_SOURCE_CODE', payload: orderSourceCode });
    },

    addItem: (item: OrderItem, mergeInto?: LineKey, mergedMeasure?: OrderItemMeasure) => {
      const mergeBlocked = groupBlocked(['CHANGE_ITEM_QUANTITY', 'ADD_PIECE'])
        || (mergedMeasure != null && blocked('CHANGE_ITEM_MEASURE', 'ITEM'));
      if (mergeInto && !mergeBlocked && state.items.some((line) => line.lineKey === mergeInto)) {
        dispatch({ type: 'ADD_ITEM', payload: item, mergeInto, mergedMeasure });
        return mergeInto;
      }
      if (blocked('ADD_ITEM')) return null;
      dispatch({ type: 'ADD_ITEM', payload: item });
      return item.lineKey;
    },

    pieceMoveBlock,

    movePiece: (
      lineKey: LineKey,
      { pieceId, toLineKey, packingPriceByCode }: { pieceId?: string; toLineKey?: LineKey; packingPriceByCode?: Map<string, number> } = {},
    ) => {
      const refusal = pieceMoveBlock(lineKey, pieceId, toLineKey);
      if (refusal) return { status: refusal };
      const newLineKey = newCartLineKey();
      const action: NewOrderAction = {
        type: 'MOVE_PIECE',
        payload: { lineKey, pieceId, toLineKey, newLineKey, unitPrice: todaysPrice(lineKey), packingPriceByCode },
      };
      // The reducer is pure: running it here tells the caller where the piece landed.
      const next = newOrderReducer(state, action);
      if (next === state) return { status: 'NOT_MOVABLE' as const };
      dispatch(action);
      const destination = toLineKey ?? newLineKey;
      const pieces = next.items.find((item) => item.lineKey === destination)?.pieces;
      return {
        status: 'OK' as const,
        lineKey: destination,
        lineNumber: productLineNumber(next.items, destination) ?? 1,
        pieceId: pieces?.[pieces.length - 1]?.id,
      };
    },

    splitMeasuredShare: (lineKey: LineKey, packingPriceByCode?: Map<string, number>) => {
      const line = state.items.find((item) => item.lineKey === lineKey);
      const share = line ? equalMeasureShare(line) : null;
      if (!line || !share) return 'NOT_EXACT' as const;
      // Order Edit: only a piece added during this edit can move; a saved piece keeps its line (DESIGN §4.3).
      if (line.pieces?.[line.pieces.length - 1]?.persistedId) return 'SAVED_PIECE' as const;
      if (blocked('ADD_ITEM') || groupBlocked(['CHANGE_ITEM_QUANTITY', 'REMOVE_PIECE']) || blocked('CHANGE_ITEM_MEASURE', 'ITEM')) {
        return 'BLOCKED' as const;
      }
      dispatch({
        type: 'SPLIT_MEASURED_SHARE',
        payload: { lineKey, newLineKey: newCartLineKey(), share, unitPrice: todaysPrice(lineKey), packingPriceByCode },
      });
      return 'OK' as const;
    },

    removeItem: (lineKey: LineKey) => {
      if (blocked('REMOVE_ITEM')) return false;
      if (!state.items.some((item) => item.lineKey === lineKey)) return false;
      dispatch({ type: 'REMOVE_ITEM', payload: lineKey });
      return true;
    },

    updateItemQuantity: (lineKey: LineKey, quantity: number) => {
      if (blocked('CHANGE_ITEM_QUANTITY')) return false;
      const action: NewOrderAction = { type: 'UPDATE_ITEM_QUANTITY', payload: { lineKey, quantity } };
      if (holdForMeasure(lineKey, quantity, action)) return false;
      dispatch(action);
      return true;
    },

    updateItemMeasure: (lineKey: LineKey, measure: OrderItemMeasure) => {
      // Order Edit: a stored line's measure is its own policy cell (CHANGE_ITEM_MEASURE / ITEM, Measured Pricing P5).
      if (blocked('CHANGE_ITEM_MEASURE', 'ITEM')) return;
      dispatch({ type: 'UPDATE_ITEM_MEASURE', payload: { lineKey, measure } });
    },

    updateItemPieces: (lineKey: LineKey, pieces: PreSubmissionPiece[] | undefined) => {
      if (groupBlocked(['ADD_PIECE', 'REMOVE_PIECE'])) return false;
      const action: NewOrderAction = { type: 'UPDATE_ITEM_PIECES', payload: { lineKey, pieces: pieces || [] } };
      // The reducer sets the quantity to the piece count when there are pieces, else keeps it.
      const nextQuantity = pieces && pieces.length > 0 ? pieces.length : state.items.find((i) => i.lineKey === lineKey)?.quantity ?? 0;
      if (holdForMeasure(lineKey, nextQuantity, action)) return false;
      dispatch(action);
      return true;
    },

    confirmMeasureRecheck: (measure: OrderItemMeasure) => {
      const held = state.measureRecheck;
      if (!held) return { status: 'NONE' as const };
      const item = state.items.find((i) => i.lineKey === held.lineKey);
      const changed = !sameMeasure(item?.measure, measure);
      // Keeping the total is an explicit choice and always allowed; a new total needs the measure policy cell.
      if (changed && blocked('CHANGE_ITEM_MEASURE', 'ITEM')) return { status: 'MEASURE_BLOCKED' as const };
      dispatch({ type: 'CLEAR_MEASURE_RECHECK' });
      dispatch(held.deferred);
      if (changed) dispatch({ type: 'UPDATE_ITEM_MEASURE', payload: { lineKey: held.lineKey, measure } });
      return { status: 'APPLIED' as const, deferred: held.deferred };
    },

    cancelMeasureRecheck: () => {
      dispatch({ type: 'CLEAR_MEASURE_RECHECK' });
    },

    updateItemServicePrefs: (lineKey: LineKey, servicePrefs: OrderItemServicePref[], servicePrefCharge: number) => {
      if (groupBlocked(['ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE'])) return;
      dispatch({
        type: 'UPDATE_ITEM_SERVICE_PREFS',
        payload: { lineKey, servicePrefs, servicePrefCharge },
      });
    },

    updateOrderServicePrefs: (servicePrefs: OrderItemServicePref[]) => {
      if (groupBlocked(['ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE'])) return;
      dispatch({
        type: 'UPDATE_ORDER_SERVICE_PREFS',
        payload: { servicePrefs },
      });
    },

    updateItemPackingPref: (
      lineKey: LineKey,
      packingPrefCode: string,
      packingPrefIsOverride?: boolean,
      packingPrefSource?: string,
      packingCfId?: string | null,
      packingPrefCharge?: number
    ) => {
      if (groupBlocked(['ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE'])) return;
      dispatch({
        type: 'UPDATE_ITEM_PACKING_PREF',
        payload: {
          lineKey,
          packingPrefCode,
          packingPrefIsOverride,
          packingPrefSource,
          packingCfId,
          packingPrefCharge,
        },
      });
    },

    adjustItemPackingCharge: (lineKey: LineKey, packingPrefCharge: number) => {
      if (groupBlocked(['ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE'])) return;
      dispatch({
        type: 'ADJUST_ITEM_PACKING_PREF_CHARGE',
        payload: { lineKey, packingPrefCharge },
      });
    },

    updateItemNotes: (lineKey: LineKey, notes: string) => {
      if (identityLocked) return;
      dispatch({
        type: 'UPDATE_ITEM_NOTES',
        payload: { lineKey, notes },
      });
    },

    updateItemPriceOverride: (lineKey: LineKey, priceOverride: number | null, overrideReason: string, overrideBy: string) => {
      // Edit: a stored line's cashier price is its own policy cell (CHANGE_ITEM_PRICE / ITEM, P6-02c).
      if (blocked('CHANGE_ITEM_PRICE', 'ITEM')) return;
      dispatch({
        type: 'UPDATE_ITEM_PRICE_OVERRIDE',
        payload: { lineKey, priceOverride, overrideReason, overrideBy },
      });
    },

    setQuickDrop: (value: boolean) => {
      if (identityLocked) return;
      dispatch({ type: 'SET_QUICK_DROP', payload: value });
    },

    setQuickDropQuantity: (quantity: number) => {
      if (identityLocked) return;
      dispatch({ type: 'SET_QUICK_DROP_QUANTITY', payload: quantity });
    },

    setServiceSpeed: (serviceSpeed: string) => {
      if (blocked('CHANGE_SERVICE_SPEED', 'ORDER')) return;
      dispatch({ type: 'SET_SERVICE_SPEED', payload: serviceSpeed });
    },

    setItemServiceSpeed: (lineKey: LineKey, serviceSpeed: string | null) => {
      if (blocked('CHANGE_SERVICE_SPEED', 'ITEM')) return;
      dispatch({ type: 'SET_ITEM_SERVICE_SPEED', payload: { lineKey, serviceSpeed } });
    },

    setItemLineDiscount: (lineKey: LineKey, lineDiscount: OrderItemLineDiscount | null) => {
      if (blocked('CHANGE_DISCOUNT', 'ITEM')) return;
      dispatch({ type: 'SET_ITEM_LINE_DISCOUNT', payload: { lineKey, lineDiscount } });
    },

    applySpeedToAllLines: () => {
      // Clearing the line speeds changes each line's own speed (ITEM).
      if (blocked('CHANGE_SERVICE_SPEED', 'ITEM')) return;
      dispatch({ type: 'APPLY_SPEED_TO_ALL_LINES' });
    },

    setBags: (count: number) => {
      if (identityLocked) return;
      dispatch({ type: 'SET_BAGS', payload: count });
    },

    setNotes: (notes: string) => {
      if (blocked('CHANGE_ORDER_NOTES')) return;
      dispatch({ type: 'SET_NOTES', payload: notes });
    },

    setCustomerNotes: (notes: string) => {
      if (blocked('CHANGE_ORDER_NOTES')) return;
      dispatch({ type: 'SET_CUSTOMER_NOTES', payload: notes });
    },

    setPaymentNotes: (notes: string) => {
      if (identityLocked) return;
      dispatch({ type: 'SET_PAYMENT_NOTES', payload: notes });
    },

    setReadyByAt: (readyByAt: string) => {
      if (blocked('CHANGE_READY_BY')) return;
      dispatch({ type: 'SET_READY_BY_AT', payload: readyByAt });
    },

    setLoading: (loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    },

    setCreatedOrder: (orderId: string, status: string | null) => {
      dispatch({
        type: 'SET_CREATED_ORDER',
        payload: { orderId, status },
      });
    },

    openModal: (modal: keyof typeof state.modals) => {
      if (identityLocked && (modal === 'customerPicker' || modal === 'customerEdit' || modal === 'payment')) return;
      // Edit: a custom line is a new line (ADD_ITEM, P6-02d).
      if (modal === 'customItem' && blocked('ADD_ITEM')) return;
      dispatch({ type: 'OPEN_MODAL', payload: modal });
    },

    closeModal: (modal: keyof typeof state.modals) => {
      dispatch({ type: 'CLOSE_MODAL', payload: modal });
    },

    openPriceOverrideModal: (lineKey: LineKey) => {
      if (identityLocked) return;
      dispatch({ type: 'OPEN_PRICE_OVERRIDE_MODAL', payload: lineKey });
    },

    setCategories: (categories: typeof state.categories) => {
      dispatch({ type: 'SET_CATEGORIES', payload: categories });
    },

    setProducts: (products: typeof state.products) => {
      dispatch({ type: 'SET_PRODUCTS', payload: products });
    },

    setSelectedCategory: (category: string) => {
      dispatch({ type: 'SET_SELECTED_CATEGORY', payload: category });
    },

    setCategoriesLoading: (loading: boolean) => {
      dispatch({ type: 'SET_CATEGORIES_LOADING', payload: loading });
    },

    setProductsLoading: (loading: boolean) => {
      dispatch({ type: 'SET_PRODUCTS_LOADING', payload: loading });
    },

    setInitialLoading: (loading: boolean) => {
      dispatch({ type: 'SET_INITIAL_LOADING', payload: loading });
    },

    resetOrder: () => {
      if (identityLocked) return;
      dispatch({ type: 'RESET_ORDER' });
    },

    setSelectedPiece: (pieceId: string | null) => {
      dispatch({ type: 'SET_SELECTED_PIECE', payload: pieceId });
    },

    updatePieceConditions: (pieceId: string, conditions: string[]) => {
      if (groupBlocked(['ADD_PIECE', 'REMOVE_PIECE'])) return;
      dispatch({ type: 'UPDATE_PIECE_CONDITIONS', payload: { pieceId, conditions } });
    },

    updatePieceColor: (pieceId: string, color: string | undefined, colorCodes?: string[], colorCfIds?: (string | null)[]) => {
      if (groupBlocked(['ADD_PIECE', 'REMOVE_PIECE'])) return;
      dispatch({ type: 'UPDATE_PIECE_COLOR', payload: { pieceId, color, colorCodes, colorCfIds } });
    },
  };

  return {
    state,
    dispatch,
    ...actions,
  };
}

// Re-export base hooks for direct use if needed
export { useNewOrderState, useNewOrderDispatch } from '../ui/context/new-order-context';

