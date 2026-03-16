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
  /** True when selected from tenant default guest customer */
  isDefaultCustomer?: boolean;
  /** Customer type for B2B flow (contract, cost center, PO) */
  type?: string;
}

/**
 * Order-level customer snapshot override (edits apply to order only, not customer master)
 */
export interface CustomerSnapshotOverride {
  name?: string;
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
  is_retail_item?: boolean;
  product_image?: string | null;
  product_icon?: string | null;
}

// ==================================================================
// PIECE TYPES
// ==================================================================

/** Service preference for order item (processing prefs: starch, perfume, etc.) */
export interface OrderItemServicePref {
  preference_code: string;
  source: string;
  extra_price: number;
}

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
  /** Piece-level conditions (stains, damage, special) - Customer/Order/Item/Pieces Preferences */
  conditions?: string[];
  /** Piece-level service prefs (Enterprise-gated) */
  servicePrefs?: OrderItemServicePref[];
  /** Piece-level packing preference (Enterprise-gated, packingPerPieceEnabled) */
  packingPrefCode?: string;
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
  /** Service preferences (starch, perfume, delicate, etc.) */
  servicePrefs?: OrderItemServicePref[];
  /** Packing preference (hang, fold, box, etc.) */
  packingPrefCode?: string;
  packingPrefIsOverride?: boolean;
  packingPrefSource?: string;
  /** Aggregated charge from service prefs. Included in order total. */
  servicePrefCharge?: number;
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
 * Order lock information (for edit mode)
 */
export interface OrderLockInfo {
  lockedBy: string;
  lockedByName: string;
  lockedAt: Date;
  expiresAt: Date;
  sessionId?: string;
}

/**
 * New Order State
 */
export interface NewOrderState {
  // Customer
  customer: MinimalCustomer | null;
  customerName: string;
  /** Customer snapshot at order time (for org_orders_mst columns) */
  customerMobile: string;
  customerEmail: string;
  customerNameSnapshot: string;
  isDefaultCustomer: boolean;
  /** Order-only edits (not persisted to customer master) */
  customerSnapshotOverride: CustomerSnapshotOverride | null;
  /** Customer-provided notes (org_orders_mst.customer_notes) */
  customerNotes: string;
  /** Payment-related notes (org_orders_mst.payment_notes) */
  paymentNotes: string;

  // Order Items
  items: OrderItem[];

  // Order Settings
  branchId: string | null;
  isQuickDrop: boolean;
  quickDropQuantity: number;
  express: boolean;
  /** Internal staff notes (org_orders_mst.internal_notes) */
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

  // Edit Mode State
  isEditMode: boolean;
  editingOrderId: string | null;
  editingOrderNo: string | null;
  originalOrderData: any | null; // Snapshot of original order for comparison
  lockInfo: OrderLockInfo | null;
  expectedUpdatedAt: Date | null; // For optimistic locking

  // Customer/Order/Item/Pieces Preferences - selected piece for applying conditions
  selectedPieceId: string | null;
}

// ==================================================================
// ACTION TYPES
// ==================================================================

/**
 * New Order Actions
 */
export type NewOrderAction =
  | {
      type: 'SET_CUSTOMER';
      payload: {
        customer: MinimalCustomer | null;
        customerName: string;
        customerMobile?: string;
        customerEmail?: string;
        customerNameSnapshot?: string;
        isDefaultCustomer?: boolean;
      };
    }
  | { type: 'SET_CUSTOMER_SNAPSHOT_OVERRIDE'; payload: CustomerSnapshotOverride | null }
  | { type: 'SET_BRANCH_ID'; payload: string | null }
  | { type: 'SET_ITEMS'; payload: OrderItem[] }
  | { type: 'ADD_ITEM'; payload: OrderItem }
  | { type: 'REMOVE_ITEM'; payload: string } // productId
  | { type: 'UPDATE_ITEM_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'UPDATE_ITEM_NOTES'; payload: { productId: string; notes: string } }
  | { type: 'UPDATE_ITEM_PIECES'; payload: { productId: string; pieces: PreSubmissionPiece[] } }
  | { type: 'UPDATE_ITEM_SERVICE_PREFS'; payload: { productId: string; servicePrefs: OrderItemServicePref[]; servicePrefCharge: number } }
  | { type: 'UPDATE_ITEM_PACKING_PREF'; payload: { productId: string; packingPrefCode: string; packingPrefIsOverride?: boolean; packingPrefSource?: string } }
  | { type: 'UPDATE_ITEM_PRICE_OVERRIDE'; payload: { productId: string; priceOverride: number | null; overrideReason: string; overrideBy: string } }
  | { type: 'SET_QUICK_DROP'; payload: boolean }
  | { type: 'SET_QUICK_DROP_QUANTITY'; payload: number }
  | { type: 'SET_EXPRESS'; payload: boolean }
  | { type: 'SET_NOTES'; payload: string }
  | { type: 'SET_CUSTOMER_NOTES'; payload: string }
  | { type: 'SET_PAYMENT_NOTES'; payload: string }
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
  | { type: 'RESET_ORDER' }
  | { type: 'ENTER_EDIT_MODE'; payload: { orderId: string; orderNo: string } }
  | {
      type: 'LOAD_ORDER_FOR_EDIT';
      payload: {
        orderId: string;
        orderNo: string;
        customer: MinimalCustomer | null;
        customerName: string;
        customerMobile: string;
        customerEmail: string;
        branchId: string | null;
        items: OrderItem[];
        express: boolean;
        notes: string;
        customerNotes: string;
        paymentNotes: string;
        readyByAt: string;
        originalData: any;
        expectedUpdatedAt: Date;
      };
    }
  | { type: 'EXIT_EDIT_MODE' }
  | { type: 'SET_LOCK_INFO'; payload: OrderLockInfo | null }
  | { type: 'UPDATE_ORIGINAL_ORDER_DATA'; payload: Record<string, unknown> | null }
  | { type: 'SET_EXPECTED_UPDATED_AT'; payload: Date }
  | { type: 'SET_SELECTED_PIECE'; payload: string | null }
  | { type: 'UPDATE_PIECE_CONDITIONS'; payload: { pieceId: string; conditions: string[] } };

