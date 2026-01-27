/**
 * use-new-order-state Hook
 * Context consumer with dispatch helpers
 */

import { useNewOrderContext } from '../ui/context/new-order-context';
import type { NewOrderState, MinimalCustomer, OrderItem, PreSubmissionPiece, ServiceCategory, Product } from '../model/new-order-types';

/**
 * Return type for useNewOrderStateWithDispatch
 */
export interface UseNewOrderStateWithDispatchReturn {
  state: NewOrderState;
  dispatch: ReturnType<typeof useNewOrderContext>['dispatch'];
  setCustomer: (customer: MinimalCustomer | null, customerName: string) => void;
  addItem: (item: OrderItem) => void;
  removeItem: (productId: string) => void;
  updateItemQuantity: (productId: string, quantity: number) => void;
  updateItemPieces: (productId: string, pieces: PreSubmissionPiece[] | undefined) => void;
  updateItemNotes: (productId: string, notes: string) => void;
  setQuickDrop: (value: boolean) => void;
  setQuickDropQuantity: (quantity: number) => void;
  setExpress: (value: boolean) => void;
  setNotes: (notes: string) => void;
  setReadyByAt: (readyByAt: string) => void;
  setLoading: (loading: boolean) => void;
  setCreatedOrder: (orderId: string, status: string | null) => void;
  openModal: (modal: keyof NewOrderState['modals']) => void;
  closeModal: (modal: keyof NewOrderState['modals']) => void;
  setCategories: (categories: ServiceCategory[]) => void;
  setProducts: (products: Product[]) => void;
  setSelectedCategory: (category: string) => void;
  setCategoriesLoading: (loading: boolean) => void;
  setProductsLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  resetOrder: () => void;
}

/**
 * Hook to use new order state with dispatch helpers
 */
export function useNewOrderStateWithDispatch(): UseNewOrderStateWithDispatchReturn {
  const { state, dispatch } = useNewOrderContext();

  // Helper functions for common actions
  const actions = {
    setCustomer: (customer: typeof state.customer, customerName: string) => {
      dispatch({
        type: 'SET_CUSTOMER',
        payload: { customer, customerName },
      });
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

    updateItemNotes: (productId: string, notes: string) => {
      dispatch({
        type: 'UPDATE_ITEM_NOTES',
        payload: { productId, notes },
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

    setNotes: (notes: string) => {
      dispatch({ type: 'SET_NOTES', payload: notes });
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
  };

  return {
    state,
    dispatch,
    ...actions,
  };
}

// Re-export base hooks for direct use if needed
export { useNewOrderState, useNewOrderDispatch } from '../ui/context/new-order-context';

