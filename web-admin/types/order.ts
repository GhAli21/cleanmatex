/**
 * Order Types
 *
 * TypeScript types for order-related entities matching database schema.
 * These types are used across the application for type safety.
 */

// ==================================================================
// ENUMS & CONSTANTS
// ==================================================================

export type OrderStatus =
  | 'draft'
  | 'intake'
  | 'preparation'
  | 'processing'
  | 'washing'
  | 'drying'
  | 'finishing'
  | 'assembly'
  | 'qa'
  | 'packing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'closed'
  | 'cancelled';

export type PreparationStatus = 'pending' | 'in_progress' | 'completed';

export type Priority = 'normal' | 'urgent' | 'express';

export type OrderType = 'quick_drop' | 'pickup' | 'delivery' | 'walk_in';

export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded' | 'failed';

export type ItemStatus =
  | 'pending'
  | 'tagged'
  | 'washing'
  | 'drying'
  | 'finishing'
  | 'assembled'
  | 'qa_passed'
  | 'qa_failed'
  | 'packed'
  | 'ready'
  | 'delivered';

// ==================================================================
// DATABASE ENTITIES
// ==================================================================

/**
 * Order (org_orders_mst)
 */
export interface Order {
  // Primary key
  id: string;
  tenant_org_id: string;

  // References
  branch_id: string | null;
  customer_id: string;
  order_type_id: string | null;

  // Order identification
  order_no: string;

  // Status
  status: OrderStatus;
  preparation_status: PreparationStatus;
  priority: Priority;

  // PRD-010: Workflow fields
  workflow_template_id?: string;
  current_status?: string;
  current_stage?: string;
  parent_order_id?: string;
  order_subtype?: string;
  is_rejected?: boolean;
  rejected_from_stage?: string;
  issue_id?: string;
  ready_by_at_new?: Date | null;
  has_split?: boolean;
  has_issue?: boolean;
  last_transition_at?: Date | null;
  last_transition_by?: string;
  is_order_quick_drop?: boolean;
  quick_drop_quantity?: number;
  is_retail?: boolean;
  rack_location?: string;

  // Preparation workflow (new in PRD-004)
  prepared_at: Date | null;
  prepared_by: string | null;

  // Service
  service_category_code: string | null;

  // Quantities
  total_items: number;
  bag_count: number;

  // Pricing
  subtotal: number;
  discount: number;
  tax: number;
  total: number;

  // Priority & Timing
  priority_multiplier: number;
  ready_by_override: Date | null;

  // Payment
  payment_status: PaymentStatus;
  payment_method_code: string | null;
  paid_amount: number;
  paid_at: Date | null;
  paid_by: string | null;
  payment_notes: string | null;

  // Dates
  received_at: Date;
  ready_by: Date | null;
  ready_at: Date | null;
  delivered_at: Date | null;

  // Notes
  customer_notes: string | null;
  internal_notes: string | null;

  // Media (new in PRD-004)
  photo_urls: string[];
  qr_code: string | null;
  barcode: string | null;

  // Audit
  created_at: Date;
  updated_at: Date;
}

/**
 * Order Item (org_order_items_dtl)
 */
export interface OrderItem {
  // Primary key
  id: string;
  order_id: string;
  tenant_org_id: string;

  // Product
  product_id: string | null;
  service_category_code: string | null;
  order_item_srno: string | null;
  barcode: string | null;

  // Joined product data (from org_product_data_mst)
  org_product_data_mst?: {
    product_name: string | null;
    product_name2: string | null;
    product_code: string;
  };

  // Denormalized product info (new in PRD-004)
  product_name: string | null;
  product_name2: string | null;

  // Pricing
  quantity: number;
  quantity_ready: number; // Number of pieces marked as ready (0 to quantity)
  price_per_unit: number;
  total_price: number;

  // Status
  status: ItemStatus;

  // PRD-010: Item workflow fields
  item_status?: string;
  item_stage?: string;
  item_is_rejected?: boolean;
  item_issue_id?: string;
  item_last_step?: string;
  item_last_step_at?: Date | null;
  item_last_step_by?: string;

  // Item details
  color: string | null;
  brand: string | null;
  has_stain: boolean | null;
  has_damage: boolean | null;

  // Notes (new in PRD-004)
  notes: string | null;
  stain_notes: string | null;
  damage_notes: string | null;

  // Metadata
  metadata: Record<string, any>;

  // Audit
  created_at: Date;
}

/**
 * Order Item Piece (org_order_item_pieces_dtl)
 * Database entity for order item piece-level tracking
 */
export interface OrderItemPiece {
  // Primary key
  id: string;

  // Tenant and order references
  tenant_org_id: string;
  order_id: string;
  order_item_id: string;

  // Piece identification
  piece_seq: number;
  piece_code: string; // Generated: order_id-order_item_id-piece_seq

  // Product and service category
  service_category_code: string | null;
  product_id: string | null;

  // Scanning and tracking
  scan_state: 'expected' | 'scanned' | 'missing' | 'wrong' | null;
  barcode: string | null;

  // Pricing
  quantity: number | null;
  price_per_unit: number;
  total_price: number;

  // Status and workflow
  piece_status: 'intake' | 'processing' | 'qa' | 'ready' | null;
  piece_stage: string | null;
  is_rejected: boolean | null;
  issue_id: string | null;

  // Location tracking
  rack_location: string | null;

  // Step tracking
  last_step_at: Date | null;
  last_step_by: string | null;
  last_step: string | null;

  // Notes
  notes: string | null;

  // Item details
  color: string | null;
  brand: string | null;
  has_stain: boolean | null;
  has_damage: boolean | null;

  // Metadata
  metadata: Record<string, any>;

  // Audit fields
  created_at: Date | null;
  rec_order: number | null;
  rec_notes: string | null;
  rec_status: number | null;
  created_by: string | null;
  created_info: string | null;
  updated_at: Date | null;
  updated_by: string | null;
  updated_info: string | null;
}

/**
 * Order Item with Database Pieces
 * Extended OrderItem with database-backed pieces array
 */
export interface OrderItemWithDbPieces extends OrderItem {
  pieces: OrderItemPiece[];
}

/**
 * Customer (sys_customers_mst)
 */
export interface Customer {
  id: string;
  first_name: string;
  last_name: string | null;
  disply_name: string | null;
  name: string | null;
  name2: string | null;
  phone: string | null;
  email: string | null;
  type: string;
  address: string | null;
  area: string | null;
  building: string | null;
  floor: string | null;
  preferences: Record<string, any>;
  first_tenant_org_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Product (org_product_data_mst)
 */
export interface Product {
  id: string;
  tenant_org_id: string;
  service_category_code: string | null;
  product_code: string;
  product_name: string | null;
  product_name2: string | null;
  hint_text: string | null;
  is_retail_item: boolean;
  product_type: number | null;
  price_type: string | null;
  product_unit: string | null;
  default_sell_price: number | null;
  default_express_sell_price: number | null;
  product_cost: number | null;
  min_sell_price: number | null;
  min_quantity: number | null;
  pieces_per_product: number | null;
  extra_days: number | null;
  turnaround_hh: number | null;
  turnaround_hh_express: number | null;
  multiplier_express: number | null;
  product_order: number | null;
  is_tax_exempt: number | null;
  tags: any;
  id_sku: string | null;
  is_active: boolean;
  created_at2: Date | null;
}

// ==================================================================
// API INPUT TYPES
// ==================================================================

/**
 * Input for creating a new Quick Drop order
 */
export interface CreateOrderInput {
  customerId: string;
  branchId?: string;
  orderType: OrderType;
  serviceCategory: string;
  bagCount: number;
  priority: Priority;
  customerNotes?: string;
  internalNotes?: string;
  photoUrls?: string[];
}

/**
 * Input for adding items to an order
 */
export interface AddOrderItemInput {
  productId: string;
  quantity: number;
  serviceCategoryCode: string;
  color?: string;
  brand?: string;
  hasStain: boolean;
  stainNotes?: string;
  hasDamage: boolean;
  damageNotes?: string;
  notes?: string;
  // Price override fields (requires pricing:override permission)
  priceOverride?: number;
  overrideReason?: string;
}

/**
 * Input for adding multiple items at once
 */
export interface AddOrderItemsInput {
  items: AddOrderItemInput[];
  isExpressService: boolean;
}

/**
 * Input for completing preparation
 */
export interface CompletePreparationInput {
  readyByOverride?: Date;
  internalNotes?: string;
}

/**
 * Input for updating order status
 */
export interface UpdateOrderStatusInput {
  status: OrderStatus;
  notes?: string;
}

/**
 * Input for order search/filter
 */
export interface OrderFilters {
  status?: OrderStatus | OrderStatus[];
  preparationStatus?: PreparationStatus | PreparationStatus[];
  priority?: Priority | Priority[];
  isRetail?: 'true' | 'false';
  customerId?: string;
  branchId?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string; // Order number, customer name/phone
  page?: number;
  limit?: number;
  sortBy?: 'received_at' | 'ready_by' | 'order_no' | 'total';
  sortOrder?: 'asc' | 'desc';
}

// ==================================================================
// API RESPONSE TYPES
// ==================================================================

/**
 * Order with related data (for detail views)
 */
export interface OrderWithDetails extends Order {
  customer: Pick<Customer, 'id' | 'name' | 'phone' | 'email' | 'preferences'>;
  items: OrderItem[];
  branch?: {
    id: string;
    branch_name: string;
  };
}

/**
 * Order list item (for table views)
 */
export interface OrderListItem {
  id: string;
  order_no: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  status: OrderStatus;
  preparation_status: PreparationStatus;
  priority: Priority;
  is_retail?: boolean;
  total_items: number;
  total_pieces?: number | null; // Total pieces count across order items
  total: number;
  received_at: Date;
  ready_by: Date | null;
  branch_name?: string;
}

/**
 * Paginated order list response
 */
export interface OrderListResponse {
  orders: OrderListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Order statistics
 */
export interface OrderStats {
  total: number;
  pending_preparation: number;
  in_preparation: number;
  processing: number;
  ready: number;
  out_for_delivery: number;
  delivered_today: number;
  overdue: number;
}

/**
 * Product catalog item (for preparation screen)
 */
export interface ProductCatalogItem {
  id: string;
  code: string;
  name: string;
  name2: string;
  price: number;
  expressPrice: number;
  serviceCategory: string;
  unit: string;
  isActive: boolean;
}

/**
 * Order preparation data
 */
export interface OrderPreparationData {
  order: OrderWithDetails;
  productCatalog: ProductCatalogItem[];
}

// ==================================================================
// UTILITY TYPES
// ==================================================================

/**
 * Order number components
 */
export interface OrderNumberParts {
  prefix: string; // "ORD"
  date: string; // "20251025"
  sequence: string; // "0001"
  full: string; // "ORD-20251025-0001"
}

/**
 * Ready-By calculation result
 */
export interface ReadyByCalculation {
  readyBy: Date;
  adjustedTurnaroundHours: number;
  priorityMultiplier: number;
  isWorkingDay: boolean;
  formatted: string;
}

/**
 * Price calculation result
 */
export interface PriceCalculation {
  unitPrice: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/**
 * QR Code data
 */
export interface QRCodeData {
  orderNumber: string;
  tenantOrgId: string;
  customerPhone?: string;
  customerId?: string;
  timestamp?: string;
}

// ==================================================================
// FORM TYPES
// ==================================================================

/**
 * Quick Drop form data
 */
export interface QuickDropFormData {
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  serviceCategory: string;
  bagCount: number;
  priority: Priority;
  orderType: OrderType;
  customerNotes: string;
  internalNotes: string;
  photos: File[];
}

/**
 * Item detail form data
 */
export interface ItemDetailFormData {
  product: ProductCatalogItem | null;
  quantity: number;
  color: string;
  brand: string;
  hasStain: boolean;
  stainNotes: string;
  hasDamage: boolean;
  damageNotes: string;
  notes: string;
}

// ==================================================================
// ERROR TYPES
// ==================================================================

/**
 * API Error response
 */
export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
}

// ==================================================================
// TYPE GUARDS
// ==================================================================

/**
 * Check if value is a valid OrderStatus
 */
export function isOrderStatus(value: any): value is OrderStatus {
  const validStatuses: OrderStatus[] = [
    'draft',
    'intake',
    'preparation',
    'processing',
    'washing',
    'drying',
    'finishing',
    'assembly',
    'qa',
    'packing',
    'ready',
    'out_for_delivery',
    'delivered',
    'closed',
    'cancelled',
  ];
  return validStatuses.includes(value);
}

/**
 * Check if value is a valid Priority
 */
export function isPriority(value: any): value is Priority {
  return ['normal', 'urgent', 'express'].includes(value);
}

/**
 * Check if value is a valid PreparationStatus
 */
export function isPreparationStatus(value: any): value is PreparationStatus {
  return ['pending', 'in_progress', 'completed'].includes(value);
}

// ==================================================================
// PROCESSING MODAL TYPES (Piece-Level)
// ==================================================================

/**
 * Processing Step Code
 * Dynamic step codes based on service category configuration
 * Common codes: sorting, pretreatment, washing, drying, finishing, dry_cleaning, deep_cleaning, leather_cleaning, conditioning
 */
export type ProcessingStep = string;

/**
 * Processing Step Configuration
 * Step configuration with display information
 */
export interface ProcessingStepConfig {
  step_code: string;
  step_seq: number;
  step_name: string;
  step_name2: string | null;
  step_color: string | null;
  step_icon: string | null;
  is_active: boolean;
  display_order: number;
}

/**
 * Item Piece
 * Represents a single piece within an order item
 * Generated client-side from item quantity
 */
export interface ItemPiece {
  id: string; // Generated: `${itemId}-piece-${pieceNumber}`
  itemId: string;
  pieceNumber: number; // 1, 2, 3... up to item.quantity
  // isReady is computed from is_ready || piece_status === 'ready' (read-only, for backward compatibility)
  isReady?: boolean;
  currentStep?: ProcessingStep;
  notes: string;
  rackLocation: string; // Piece-level rack location
  isRejected: boolean;
  // Piece details from database
  color?: string | null;
  brand?: string | null;
  has_stain?: boolean | null;
  has_damage?: boolean | null;
  barcode?: string | null;
  piece_code?: string | null;
  scan_state?: 'expected' | 'scanned' | 'missing' | 'wrong' | null;
  // Status fields
  piece_status?: 'intake' | 'processing' | 'qa' | 'ready' | null;
  piece_stage?: string | null;
  is_ready?: boolean | null;
}

/**
 * Order Item with Pieces
 * Extended OrderItem with generated pieces array
 */
export interface OrderItemWithPieces extends OrderItem {
  pieces: ItemPiece[];
}

/**
 * Piece Update Request
 * Data structure for updating a single piece
 */
export interface PieceUpdate {
  pieceId: string;
  itemId: string;
  pieceNumber: number;
  // isReady is deprecated, use is_ready instead (source of truth)
  isReady?: boolean;
  is_ready?: boolean | null;
  currentStep?: ProcessingStep;
  piece_stage?: string | null;
  notes?: string;
  rackLocation?: string;
  isRejected?: boolean;
  color?: string | null;
  brand?: string | null;
  barcode?: string | null;
  has_stain?: boolean | null;
  has_damage?: boolean | null;
}

/**
 * Batch Update Request
 * Request body for batch updating multiple pieces
 */
export interface BatchUpdateRequest {
  updates: PieceUpdate[];
  itemQuantityReady: Record<string, number>; // itemId -> ready count
  orderRackLocation?: string; // Order-level rack location
}

/**
 * Batch Update Response
 * Response from batch update API
 */
export interface BatchUpdateResponse {
  success: boolean;
  summary: {
    piecesUpdated: number;
    itemsUpdated: number;
    readyCount: number;
    stepsRecorded: number;
    rackLocationsSet: number;
  };
}

/**
 * Split Order Request
 * Request body for splitting an order (piece-level)
 */
export interface SplitOrderRequest {
  pieceIds: string[]; // Array of piece IDs to split
  reason: string; // Required: reason for splitting
}

/**
 * Split Order Response
 * Response from split order API
 */
export interface SplitOrderResponse {
  success: boolean;
  newOrderId: string;
  newOrderNumber: string;
  movedPieces: number;
}

/**
 * Processing Modal State
 * State management for the processing modal
 */
export interface ProcessingModalState {
  order: Order | null;
  items: OrderItem[];
  expandedItemIds: Set<string>;
  pieceStates: Map<string, ItemPiece>;
  selectedForSplit: Set<string>; // Piece IDs selected for split
  rackLocation: string; // Order-level rack location
  summaryMessage: SummaryMessage | null;
  loading: boolean;
}

/**
 * Summary Message
 * Display format for operation results
 */
export interface SummaryMessage {
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  items: string[];
}

/**
 * Check if value is a valid ProcessingStep
 */
export function isProcessingStep(value: any): value is ProcessingStep {
  return ['sorting', 'pretreatment', 'washing', 'drying', 'finishing'].includes(value);
}
