/* eslint-disable jsdoc/require-jsdoc */
/**
 * Processing Screen TypeScript Interfaces
 * PRD-010: Advanced Order Management - Processing Queue
 */

export interface ProcessingOrderItem {
  product_name: string;
  product_name2?: string;
  quantity: number;
  service_name?: string;
  color?: string | null;
  brand?: string | null;
  has_stain?: boolean | null;
  has_damage?: boolean | null;
}

export interface ProcessingOrder {
  id: string;
  order_no: string;
  ready_by_at: string;
  branch_id?: string | null;
  customer_name: string;
  customer_name2?: string;
  customer_phone?: string;
  items: ProcessingOrderItem[];
  items_count?: number;
  total_items: number;
  quantity_ready?: number;
  has_stain_any?: boolean;
  has_damage_any?: boolean;
  notes?: string;
  total: number;
  status: string;
  current_status: string;
  payment_status: string;
  payment_type_code?: string | null;
  paid_amount: number;
  outstanding_amount: number;
  priority: string;
  has_issue?: boolean;
  /** Total issues including solved — enables green badge when has_issue is false */
  issue_total_count?: number;
  is_rejected?: boolean;
  created_at: string;
}

export interface ProcessingStats {
  orders: number;
  pieces: number;
  overdue: number;
  issues: number;
  value: number;
  unpaid: number;
  weight?: number;
}

export interface FilterOption {
  value: string;
  label: string;
}

export type ProcessingFocus = 'all' | 'urgent' | 'overdue' | 'issues' | 'ready';

export interface ProcessingFilters {
  search?: string;
  focus?: ProcessingFocus;
  priority?: string;
  statusFilter?: string;
  readyByDate?: string;
}

export type SortField = 'order_no' | 'ready_by_at' | 'customer_name' | 'total_items' | 'total' | 'status';
export type SortDirection = 'asc' | 'desc';
