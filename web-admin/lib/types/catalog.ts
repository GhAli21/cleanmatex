/**
 * PRD-007: Catalog Service Management Types
 * Type definitions for catalog, products, and pricing management
 */

// ==================================================================
// ENUMS & CONSTANTS
// ==================================================================

export type PriceListType = 'standard' | 'express' | 'vip' | 'seasonal' | 'b2b' | 'promotional';
export type ProductUnit = 'piece' | 'kg' | 'item';
export type CSVTemplateType = 'basic' | 'advanced';
export type PriceType = 'fixed' | 'per_piece' | 'per_kg';

// ==================================================================
// SERVICE CATEGORIES
// ==================================================================

/**
 * Service Category (from sys_service_category_cd)   
 */
export interface ServiceCategory {
  service_category_code: string;
  ctg_name: string;              // English name
  ctg_name2: string | null;      // Arabic name
  ctg_desc: string | null;       // Description
  turnaround_hh: number | null;
  turnaround_hh_express: number | null;
  multiplier_express: number | null;
  is_builtin: boolean;
  has_fee: boolean;
  is_mandatory: boolean;
  is_active: boolean;
  service_category_color1: string | null;
  service_category_color2: string | null;
  service_category_color3: string | null;
  service_category_icon: string | null;
  service_category_image: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Enabled Category (from org_service_category_cf)
 */
export interface EnabledCategory extends ServiceCategory {
  tenant_org_id: string;
} 

/**
 * Enable Categories Request
 */
export interface EnableCategoriesRequest {
  categoryCodes: string[];
}

// ==================================================================
// PRODUCTS
// ==================================================================

/**
 * Product (from org_product_data_mst)
 */
export interface Product {
  id: string;
  tenant_org_id: string;
  service_category_code: string | null;
  product_code: string;
  product_name: string | null;                // English name
  product_name2: string | null;               // Arabic name
  hint_text: string | null;
  is_retail_item: boolean;
  product_type: number | null;
  price_type: PriceType | null;
  product_unit: ProductUnit | null;
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
  tags: Record<string, any> | null;
  id_sku: string | null;
  is_active: boolean;
  product_color1: string | null;
  product_color2: string | null;
  product_color3: string | null;
  product_icon: string | null;
  product_image: string | null;
  rec_order: number | null;
  rec_notes2: string | null;
  rec_status: number;
  created_at: string;
  created_by: string | null;
  created_info: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_info: string | null;
}

/**
 * Product List Item (for table views)
 */
export interface ProductListItem {
  id: string;
  product_code: string;
  product_name: string | null;
  product_name2: string | null;
  service_category_code: string | null;
  is_retail_item: boolean;
  category_name: string | null;
  category_name2: string | null;
  default_sell_price: number | null;
  default_express_sell_price: number | null;
  product_unit: ProductUnit | null;
  is_active: boolean;
  created_at: string;
  product_image?: string | null;
  product_icon?: string | null;
}

/**
 * Product Create Request
 */
export interface ProductCreateRequest {
  service_category_code: string;
  product_code?: string;                      // Auto-generate if not provided
  product_name: string;
  product_name2?: string;
  hint_text?: string;
  is_retail_item?: boolean;
  product_type?: number;
  price_type?: PriceType;
  product_unit: ProductUnit;
  default_sell_price: number;
  default_express_sell_price?: number;
  product_cost?: number;
  min_sell_price?: number;
  min_quantity?: number;
  pieces_per_product?: number;
  extra_days?: number;
  turnaround_hh?: number;
  turnaround_hh_express?: number;
  multiplier_express?: number;
  product_order?: number;
  is_tax_exempt?: number;
  tags?: Record<string, any>;
  id_sku?: string;
  is_active?: boolean;
  product_color1?: string;
  product_color2?: string;
  product_color3?: string;
  product_icon?: string;
  product_image?: string;
}

/**
 * Product Update Request
 */
export interface ProductUpdateRequest extends Partial<ProductCreateRequest> {
  id: string;
}

/**
 * Product Search Parameters
 */
export interface ProductSearchParams {
  page?: number;
  limit?: number;
  search?: string;                            // Search by code or name
  category?: string;                          // Filter by category code
  status?: 'active' | 'inactive';
  sortBy?: 'code' | 'name' | 'category' | 'createdAt' | 'price';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Product Search Response
 */
export interface ProductSearchResponse {
  products: ProductListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ==================================================================
// PRICE LISTS
// ==================================================================

/**
 * Price List (from org_price_lists_mst)
 */
export interface PriceList {
  id: string;
  tenant_org_id: string;
  name: string;
  name2: string | null;                       // Arabic name
  description: string | null;
  description2: string | null;                // Arabic description
  price_list_type: PriceListType;
  effective_from: string | null;
  effective_to: string | null;
  is_default: boolean;
  priority: number;
  created_at: string;
  created_by: string | null;
  created_info: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_info: string | null;
  rec_status: number;
  rec_order: number | null;
  rec_notes: string | null;
  is_active: boolean;
  item_count?: number;                        // Virtual field for item count
}

/**
 * Price List Item (from org_price_list_items_dtl)
 */
export interface PriceListItem {
  id: string;
  tenant_org_id: string;
  price_list_id: string;
  product_id: string;
  price: number;
  discount_percent: number;
  min_quantity: number;
  max_quantity: number | null;
  created_at: string;
  created_by: string | null;
  created_info: string | null;
  updated_at: string | null;
  updated_by: string | null;
  updated_info: string | null;
  rec_status: number;
  is_active: boolean;
  // Joined product data
  product_code?: string;
  product_name?: string;
  product_name2?: string;
}

/**
 * Price List with Items
 */
export interface PriceListWithItems extends PriceList {
  items: PriceListItem[];
}

/**
 * Price List Create Request
 */
export interface PriceListCreateRequest {
  name: string;
  name2?: string;
  description?: string;
  description2?: string;
  price_list_type: PriceListType;
  effective_from?: string;
  effective_to?: string;
  is_default?: boolean;
  priority?: number;
  items?: PriceListItemCreateRequest[];
}

/**
 * Price List Item Create Request
 */
export interface PriceListItemCreateRequest {
  product_id: string;
  price: number;
  discount_percent?: number;
  min_quantity?: number;
  max_quantity?: number;
}

/**
 * Price List Update Request
 */
export interface PriceListUpdateRequest extends Partial<PriceListCreateRequest> {
  id: string;
}

// ==================================================================
// BULK OPERATIONS
// ==================================================================

/**
 * CSV Import Result
 */
export interface BulkImportResult {
  success: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  imported: number;
  skipped: number;
  errors: ValidationError[];
  message?: string;
}

/**
 * Validation Error
 */
export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

/**
 * Bulk Import Request
 */
export interface BulkImportRequest {
  template: CSVTemplateType;
  data: string;                               // CSV content
}

/**
 * Bulk Export Request
 */
export interface BulkExportRequest {
  template: CSVTemplateType;
  category?: string;
  status?: 'active' | 'inactive';
}

// ==================================================================
// CSV TEMPLATES
// ==================================================================

/**
 * Basic CSV Row
 */
export interface BasicCSVRow {
  product_code: string;
  product_name: string;
  product_name_ar: string;
  category_code: string;
  price: number;
  unit: ProductUnit;
}

/**
 * Advanced CSV Row
 */
export interface AdvancedCSVRow extends BasicCSVRow {
  price_regular: number;
  price_express?: number;
  min_qty?: number;
  turnaround_hh?: number;
  turnaround_hh_express?: number;
  is_active?: string | boolean;
}

/**
 * CSV Template Definition
 */
export interface CSVTemplate {
  type: CSVTemplateType;
  name: string;
  description: string;
  headers: string[];
  sampleRow: string;
}

// ==================================================================
// UTILITY TYPES
// ==================================================================

/**
 * Product Statistics
 */
export interface ProductStatistics {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  byCategory: Record<string, number>;
}

/**
 * API Response Wrapper
 */
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Tenant Context (required for all operations)
 */
export interface TenantContext {
  tenantId: string;
  userId: string;
  userRole: string;
}

