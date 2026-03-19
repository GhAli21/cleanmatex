/**
 * use-new-order-state Hook
 * Context consumer with dispatch helpers
 */

import { useNewOrderContext } from '../ui/context/new-order-context';
import type { NewOrderState, MinimalCustomer, OrderItem, PreSubmissionPiece, OrderItemServicePref, ServiceCategory, Product, CustomerSnapshotOverride } from '../model/new-order-types';

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
 * Return type for useNewOrderStateWithDispatch
 */
export interface UseNewOrderStateWithDispatchReturn {
  state: NewOrderState;
  dispatch: ReturnType<typeof useNewOrderContext>['dispatch'];
  setCustomer: (customer: MinimalCustomer | null, customerName: string, snapshot?: SetCustomerSnapshot) => void;
  setCustomerSnapshotOverride: (override: CustomerSnapshotOverride | null) => void;
  setBranchId: (branchId: string | null) => void;
  addItem: (item: OrderItem) => void;
  removeItem: (productId: string) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  updateItemPieces: (productId: string, pieces: PreSubmissionPiece[] | undefined) => void;
  updateItemServicePrefs: (productId: string, servicePrefs: OrderItemServicePref[], servicePrefCharge: number) => void;
  updateItemPackingPref: (productId: string, packingPrefCode: string, packingPrefIsOverride?: boolean, packingPrefSource?: string) => void;
  updateItemNotes: (productId: string, notes: string) => void;
  updateItemPriceOverride: (productId: string, priceOverride: number | null, overrideReason: string, overrideBy: string) => void;
  setQuickDrop: (value: boolean) => void;
  setQuickDropQuantity: (quantity: number) => void;
  setExpress: (value: boolean) => void;
  setBags: (count: number) => void;
  setNotes: (notes: string) => void;
  setCustomerNotes: (notes: string) => void;
  setPaymentNotes: (notes: string) => void;
  setReadyByAt: (readyByAt: string) => void;
  setLoading: (loading: boolean) => void;
  setCreatedOrder: (orderId: string, status: string | null) => void;
  openModal: (modal: keyof NewOrderState['modals']) => void;
  closeModal: (modal: keyof NewOrderState['modals']) => void;
  openPriceOverrideModal: (productId: string) => void;
  setCategories: (categories: ServiceCategory[]) => void;
  setProducts: (products: Product[]) => void;
  setSelectedCategory: (category: string) => void;
  setCategoriesLoading: (loading: boolean) => void;
  setProductsLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  resetOrder: () => void;
  setSelectedPiece: (pieceId: string | null) => void;
  updatePieceConditions: (pieceId: string, conditions: string[]) => void;
  updatePieceColor: (pieceId: string, color: string | undefined) => void;
}

/**
 * Hook to use new order state with dispatch helpers
 */
export function useNewOrderStateWithDispatch(): UseNewOrderStateWithDispatchReturn {
  const { state, dispatch } = useNewOrderContext();

  // Helper functions for common actions
  const actions = {
    setCustomer: (customer: typeof state.customer, customerName: string, snapshot?: SetCustomerSnapshot) => {
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
      dispatch({ type: 'SET_CUSTOMER_SNAPSHOT_OVERRIDE', payload: override });
    },

    setBranchId: (branchId: string | null) => {
      dispatch({ type: 'SET_BRANCH_ID', payload: branchId });
    },

    addItem: (item: typeof state.items[0]) => {
      dispatch({ type: 'ADD_ITEM', payload: item });
    },

    removeItem: (productId: string) => {
      dispatch({ type: 'REMOVE_ITEM', payload: productId });
    },

    updateItemQuantity: (productId: string, quantity: number) => {
      dispatch({
        type: 'UPDATE_ITEM_QUANTITY',
        payload: { productId, quantity },
      });
    },

    updateItemPieces: (productId: string, pieces: PreSubmissionPiece[] | undefined) => {
      dispatch({
        type: 'UPDATE_ITEM_PIECES',
        payload: { productId, pieces: pieces || [] },
      });
    },

    updateItemServicePrefs: (productId: string, servicePrefs: OrderItemServicePref[], servicePrefCharge: number) => {
      dispatch({
        type: 'UPDATE_ITEM_SERVICE_PREFS',
        payload: { productId, servicePrefs, servicePrefCharge },
      });
    },

    updateItemPackingPref: (productId: string, packingPrefCode: string, packingPrefIsOverride?: boolean, packingPrefSource?: string) => {
      dispatch({
        type: 'UPDATE_ITEM_PACKING_PREF',
        payload: { productId, packingPrefCode, packingPrefIsOverride, packingPrefSource },
      });
    },

    updateItemNotes: (productId: string, notes: string) => {
      dispatch({
        type: 'UPDATE_ITEM_NOTES',
        payload: { productId, notes },
      });
    },

    updateItemPriceOverride: (productId: string, priceOverride: number | null, overrideReason: string, overrideBy: string) => {
      dispatch({
        type: 'UPDATE_ITEM_PRICE_OVERRIDE',
        payload: { productId, priceOverride, overrideReason, overrideBy },
      });
    },

    setQuickDrop: (value: boolean) => {
      dispatch({ type: 'SET_QUICK_DROP', payload: value });
    },

    setQuickDropQuantity: (quantity: number) => {
      dispatch({ type: 'SET_QUICK_DROP_QUANTITY', payload: quantity });
    },

    setExpress: (value: boolean) => {
      dispatch({ type: 'SET_EXPRESS', payload: value });
    },

    setBags: (count: number) => {
      dispatch({ type: 'SET_BAGS', payload: count });
    },

    setNotes: (notes: string) => {
      dispatch({ type: 'SET_NOTES', payload: notes });
    },

    setCustomerNotes: (notes: string) => {
      dispatch({ type: 'SET_CUSTOMER_NOTES', payload: notes });
    },

    setPaymentNotes: (notes: string) => {
      dispatch({ type: 'SET_PAYMENT_NOTES', payload: notes });
    },

    setReadyByAt: (readyByAt: string) => {
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
      dispatch({ type: 'OPEN_MODAL', payload: modal });
    },

    closeModal: (modal: keyof typeof state.modals) => {
      dispatch({ type: 'CLOSE_MODAL', payload: modal });
    },

    openPriceOverrideModal: (productId: string) => {
      dispatch({ type: 'OPEN_PRICE_OVERRIDE_MODAL', payload: productId });
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
      dispatch({ type: 'RESET_ORDER' });
    },

    setSelectedPiece: (pieceId: string | null) => {
      dispatch({ type: 'SET_SELECTED_PIECE', payload: pieceId });
    },

    updatePieceConditions: (pieceId: string, conditions: string[]) => {
      dispatch({ type: 'UPDATE_PIECE_CONDITIONS', payload: { pieceId, conditions } });
    },

    updatePieceColor: (pieceId: string, color: string | undefined) => {
      dispatch({ type: 'UPDATE_PIECE_COLOR', payload: { pieceId, color } });
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

