/**
 * Orders API Client (PRD-010)
 * Client-side functions for order workflow operations
 */

import type {
  Order,
} from '@/types/order';

/**
 * Create a new order
 */
export async function createOrder(data: any): Promise<Order> {
  const response = await fetch('/api/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create order' }));
    throw new Error(error.error || 'Failed to create order');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get orders list with filters
 */
export async function getOrders(filters?: {
  status?: string;
  isQuickDrop?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ orders: Order[]; pagination?: any }> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.isQuickDrop !== undefined) params.append('isQuickDrop', String(filters.isQuickDrop));
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', String(filters.page));
  if (filters?.limit) params.append('limit', String(filters.limit));

  const response = await fetch(`/api/v1/orders?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch orders' }));
    throw new Error(error.error || 'Failed to fetch orders');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get order state with flags and allowed transitions
 */
export async function getOrderState(orderId: string): Promise<any> {
  const response = await fetch(`/api/v1/orders/${orderId}/state`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch order state' }));
    throw new Error(error.error || 'Failed to fetch order state');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Transition order to new status
 */
export async function transitionOrder(orderId: string, data: any): Promise<any> {
  const response = await fetch(`/api/v1/orders/${orderId}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to transition order' }));
    throw new Error(error.error || 'Failed to transition order');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Split order into child orders
 */
export async function splitOrder(orderId: string, data: any): Promise<{ childOrderIds: string[] }> {
  const response = await fetch(`/api/v1/orders/${orderId}/split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to split order' }));
    throw new Error(error.error || 'Failed to split order');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Create issue for order item
 */
export async function createIssue(orderId: string, data: any): Promise<{ issue: any }> {
  const response = await fetch(`/api/v1/orders/${orderId}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create issue' }));
    throw new Error(error.error || 'Failed to create issue');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Resolve issue
 */
export async function resolveIssue(orderId: string, issueId: string, data: { notes?: string }): Promise<{ issue: any }> {
  const response = await fetch(`/api/v1/orders/${orderId}/issue/${issueId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to resolve issue' }));
    throw new Error(error.error || 'Failed to resolve issue');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get order history
 */
export async function getOrderHistory(orderId: string): Promise<{ history: any[] }> {
  const response = await fetch(`/api/v1/orders/${orderId}/history`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch history' }));
    throw new Error(error.error || 'Failed to fetch history');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Estimate ready by time
 */
export async function estimateReadyBy(data: any): Promise<{ readyBy: string }> {
  const response = await fetch('/api/v1/orders/estimate-ready-by', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to estimate ready by' }));
    throw new Error(error.error || 'Failed to estimate ready by');
  }

  const result = await response.json();
  return result.data;
}

