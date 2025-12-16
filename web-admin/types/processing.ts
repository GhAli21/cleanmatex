/**
 * Processing Screen TypeScript Interfaces
 * PRD-010: Advanced Order Management - Processing Queue
 */

export interface ProcessingOrderItem {
  product_name: string;
  product_name2?: string;
  quantity: number;
  service_name?: string;
}

export interface ProcessingOrder {
  id: string;
  order_no: string;
  ready_by_at: string;
  customer_name: string;
  customer_name2?: string;
  items: ProcessingOrderItem[];
  total_items: number;
  notes?: string;
  total: number;
  status: string;
  current_status: string;
  payment_status: string;
  paid_amount: number;
  priority: string;
  has_issue?: boolean;
  is_rejected?: boolean;
  created_at: string;
}

export interface ProcessingStats {
  orders: number;
  pieces: number;
  weight: number;
  value: number;
  unpaid: number;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface ProcessingFilters {
  reports?: string;
  sections?: string;
  orderType?: string;
  date?: string;
  statusFilter?: string;
}

export type SortField = 'id' | 'ready_by_at' | 'customer_name' | 'total_items' | 'notes' | 'total' | 'status';
export type SortDirection = 'asc' | 'desc';
