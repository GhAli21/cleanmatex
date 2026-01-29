/**
 * New Order Feature - Type Definitions
 * PRD-010: Advanced Order Management
 */

// ==================================================================
// CUSTOMER TYPES
// ==================================================================

/**
 * Minimal Customer type for order page (matches CustomerPickerModal interface)
 */
export interface MinimalCustomer {
  id: string;
  name?: string;
  name2?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

// ==================================================================
// CATEGORY TYPES
// ==================================================================

/**
 * Service Category
 */
export interface ServiceCategory {
  service_category_code: string;
  ctg_name: string;
  ctg_name2: string;
  icon?: string;
  color?: string;
}

// ==================================================================
// PRODUCT TYPES
// ==================================================================

/**
 * Product
 */
export interface Product {
  id: string;
  product_code: string;
  product_name: string | null;
  product_name2: string | null;
  default_sell_price: number | null;
  default_express_sell_price: number | null;
  service_category_code: string | null;
}

// ==================================================================
// PIECE TYPES
// ==================================================================

/**
 * Pre-submission piece data (before order creation)
 */
export interface PreSubmissionPiece {
  id: string; // Temporary ID: `temp-${itemId}-${pieceSeq}`
  itemId: string;
  pieceSeq: number;
  color?: string;
  brand?: string;
  hasStain?: boolean;
  hasDamage?: boolean;
  notes?: string;
  rackLocation?: string;
  metadata?: Record<string, unknown>;
}

// ==================================================================
// ORDER ITEM TYPES
// ==================================================================

/**
 * Order Item
 */
export interface OrderItem {
  productId: string;
  productName: string | null;
  productName2: string | null;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  defaultSellPrice: number | null;
  defaultExpressSellPrice: number | null;
  serviceCategoryCode?: string;
  notes?: string;
  pieces?: PreSubmissionPiece[];
  // Price override fields
  priceOverride?: number | null;
  overrideReason?: string | null;
  overrideBy?: string | null;
}

// ==================================================================
// STATE TYPES
// ==================================================================

/**
 * Modal states
 */
export interface ModalStates {
  customerPicker: boolean;
  customerEdit: boolean;
  payment: boolean;
  customItem: boolean;
  photoCapture: boolean;
  readyBy: boolean;
  priceOverride: boolean;
}

/**
 * Loading states
 */
export interface LoadingStates {
  isInitialLoading: boolean;
  categoriesLoading: boolean;
  productsLoading: boolean;
  loading: boolean;
}

/**
 * New Order State
 */
export interface NewOrderState {
  // Customer
  customer: MinimalCustomer | null;
  customerName: string;

  // Order Items
  items: OrderItem[];

  // Order Settings
  isQuickDrop: boolean;
  quickDropQuantity: number;
  express: boolean;
  notes: string;
  readyByAt: string;

  // UI State
  loading: boolean;
  createdOrderId: string | null;
  createdOrderStatus: string | null;

  // Modal States
  modals: ModalStates;
  priceOverrideItemId: string | null;

  // Data
  categories: ServiceCategory[];
  products: Product[];
  selectedCategory: string;

  // Loading States
  isInitialLoading: boolean;
  categoriesLoading: boolean;
  productsLoading: boolean;
}

// ==================================================================
// ACTION TYPES
// ==================================================================

/**
 * New Order Actions
 */
export type NewOrderAction =
  | { type: 'SET_CUSTOMER'; payload: { customer: MinimalCustomer | null; customerName: string } }
  | { type: 'SET_ITEMS'; payload: OrderItem[] }
  | { type: 'ADD_ITEM'; payload: OrderItem }
  | { type: 'REMOVE_ITEM'; payload: string } // productId
  | { type: 'UPDATE_ITEM_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'UPDATE_ITEM_NOTES'; payload: { productId: string; notes: string } }
  | { type: 'UPDATE_ITEM_PIECES'; payload: { productId: string; pieces: PreSubmissionPiece[] } }
  | { type: 'UPDATE_ITEM_PRICE_OVERRIDE'; payload: { productId: string; priceOverride: number | null; overrideReason: string; overrideBy: string } }
  | { type: 'SET_QUICK_DROP'; payload: boolean }
  | { type: 'SET_QUICK_DROP_QUANTITY'; payload: number }
  | { type: 'SET_EXPRESS'; payload: boolean }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'SET_READY_BY_AT'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CREATED_ORDER'; payload: { orderId: string; status: string | null } }
  | { type: 'OPEN_MODAL'; payload: keyof ModalStates }
  | { type: 'CLOSE_MODAL'; payload: keyof ModalStates }
  | { type: 'OPEN_PRICE_OVERRIDE_MODAL'; payload: string } // productId
  | { type: 'SET_CATEGORIES'; payload: ServiceCategory[] }
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'SET_SELECTED_CATEGORY'; payload: string }
  | { type: 'SET_CATEGORIES_LOADING'; payload: boolean }
  | { type: 'SET_PRODUCTS_LOADING'; payload: boolean }
  | { type: 'SET_INITIAL_LOADING'; payload: boolean }
  | { type: 'RESET_ORDER' };

