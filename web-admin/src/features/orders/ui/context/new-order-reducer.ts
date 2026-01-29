/**
 * New Order Reducer
 * Handles all state mutations for the new order feature
 */

import type { NewOrderState, NewOrderAction, PreSubmissionPiece } from '../../model/new-order-types';

/**
 * Initial state
 */
export const initialState: NewOrderState = {
  // Customer
  customer: null,
  customerName: '',

  // Order Items
  items: [],

  // Order Settings
  isQuickDrop: false,
  quickDropQuantity: 0,
  express: false,
  notes: '',
  readyByAt: '',

  // UI State
  loading: false,
  createdOrderId: null,
  createdOrderStatus: null,

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
};

/**
 * New Order Reducer
 */
export function newOrderReducer(
  state: NewOrderState,
  action: NewOrderAction
): NewOrderState {
  switch (action.type) {
    case 'SET_CUSTOMER':
      return {
        ...state,
        customer: action.payload.customer,
        customerName: action.payload.customerName,
      };

    case 'SET_ITEMS':
      return {
        ...state,
        items: action.payload,
      };

    case 'ADD_ITEM': {
      const existingItem = state.items.find(
        (item) => item.productId === action.payload.productId
      );

      if (existingItem) {
        // Update existing item
        return {
          ...state,
          items: state.items.map((item) =>
            item.productId === action.payload.productId
              ? {
                ...item,
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * item.pricePerUnit,
                // Update pieces if trackByPiece is enabled
                pieces: action.payload.pieces || item.pieces,
              }
              : item
          ),
        };
      }

      // Add new item
      return {
        ...state,
        items: [...state.items, action.payload],
      };
    }

    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.productId !== action.payload),
      };

    case 'UPDATE_ITEM_QUANTITY': {
      const { productId, quantity } = action.payload;

      if (quantity === 0) {
        return {
          ...state,
          items: state.items.filter((item) => item.productId !== productId),
        };
      }

      return {
        ...state,
        items: state.items.map((item) => {
          if (item.productId !== productId) {
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
                  id: `temp-${item.productId}-${lastSeq + addIndex}`,
                  itemId: item.productId,
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
            totalPrice: quantity * item.pricePerUnit,
            pieces,
          };
        }),
      };
    }

    case 'UPDATE_ITEM_PIECES':
      return {
        ...state,
        items: state.items.map((item) => {
          if (item.productId !== action.payload.productId) {
            return item;
          }

          const pieces = action.payload.pieces;
          const quantity =
            pieces && pieces.length > 0 ? pieces.length : item.quantity;

          return {
            ...item,
            pieces,
            quantity,
            totalPrice: quantity * item.pricePerUnit,
          };
        }),
      };

    case 'UPDATE_ITEM_NOTES':
      return {
        ...state,
        items: state.items.map((item) =>
          item.productId === action.payload.productId
            ? { ...item, notes: action.payload.notes }
            : item
        ),
      };

    case 'UPDATE_ITEM_PRICE_OVERRIDE': {
      const { productId, priceOverride, overrideReason, overrideBy } = action.payload;
      return {
        ...state,
        items: state.items.map((item) => {
          if (item.productId !== productId) {
            return item;
          }
          const effectivePrice = priceOverride !== null ? priceOverride : item.pricePerUnit;
          return {
            ...item,
            priceOverride,
            overrideReason,
            overrideBy,
            pricePerUnit: effectivePrice,
            totalPrice: item.quantity * effectivePrice,
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

    case 'SET_EXPRESS':
      return {
        ...state,
        express: action.payload,
        // Recalculate prices when express changes
        items: state.items.map((item) => {
          const newPricePerUnit =
            action.payload && item.defaultExpressSellPrice
              ? item.defaultExpressSellPrice
              : item.defaultSellPrice || item.pricePerUnit;

          return {
            ...item,
            pricePerUnit: newPricePerUnit,
            totalPrice: item.quantity * newPricePerUnit,
          };
        }),
      };

    case 'SET_NOTES':
      return {
        ...state,
        notes: action.payload,
      };

    case 'SET_READY_BY_AT':
      return {
        ...state,
        readyByAt: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

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
      return {
        ...state,
        categories: action.payload,
      };

    case 'SET_PRODUCTS':
      return {
        ...state,
        products: action.payload,
      };

    case 'SET_SELECTED_CATEGORY':
      return {
        ...state,
        selectedCategory: action.payload,
      };

    case 'SET_CATEGORIES_LOADING':
      return {
        ...state,
        categoriesLoading: action.payload,
      };

    case 'SET_PRODUCTS_LOADING':
      return {
        ...state,
        productsLoading: action.payload,
      };

    case 'SET_INITIAL_LOADING':
      return {
        ...state,
        isInitialLoading: action.payload,
      };

    case 'RESET_ORDER':
      return {
        ...initialState,
        categories: state.categories,
        products: state.products,
        selectedCategory: state.selectedCategory,
        isInitialLoading: false,
        categoriesLoading: false,
        productsLoading: false,
      };

    default:
      return state;
  }
}

