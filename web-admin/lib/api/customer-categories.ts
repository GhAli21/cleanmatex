/**
 * Customer Categories API Client
 * Tenant org_customer_category_cf CRUD and check-code
 */

export interface CustomerCategoryItem {
  id: string;
  code: string;
  name: string;
  name2?: string | null;
  system_category_code?: string | null;
  system_type?: string | null;
  is_b2b: boolean;
  is_individual: boolean;
  display_order?: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const API_BASE = '/api/v1/customer-categories';

export async function fetchCustomerCategories(options?: {
  is_b2b?: boolean;
  active_only?: boolean;
}): Promise<CustomerCategoryItem[]> {
  const params = new URLSearchParams();
  if (options?.is_b2b !== undefined) params.set('is_b2b', String(options.is_b2b));
  if (options?.active_only !== undefined) params.set('active_only', String(options.active_only));

  const url = params.toString() ? `${API_BASE}?${params}` : API_BASE;
  const res = await fetch(url, { credentials: 'include' });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch customer categories');
  }

  const json = await res.json();
  return json.data ?? [];
}

export async function fetchCustomerCategoryByCode(code: string): Promise<CustomerCategoryItem | null> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(code)}`, { credentials: 'include' });

  if (!res.ok) {
    if (res.status === 404) return null;
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch customer category');
  }

  const json = await res.json();
  return json.data ?? null;
}

export async function checkCodeAvailable(
  code: string,
  excludeId?: string
): Promise<boolean> {
  const params = new URLSearchParams({ code: code.trim() });
  if (excludeId) params.set('excludeId', excludeId);

  const res = await fetch(`${API_BASE}/check-code?${params}`, { credentials: 'include' });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to check code');
  }

  const json = await res.json();
  return json.available === true;
}

export async function createCustomerCategory(data: {
  code: string;
  name: string;
  name2?: string;
  system_type: string;
  is_b2b?: boolean;
  is_individual?: boolean;
  display_order?: number;
  is_active?: boolean;
}): Promise<CustomerCategoryItem> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create customer category');
  }

  const json = await res.json();
  return json.data;
}

export async function updateCustomerCategory(
  code: string,
  data: Partial<{
    name: string;
    name2: string;
    system_type: string;
    is_b2b: boolean;
    is_individual: boolean;
    display_order: number;
    is_active: boolean;
  }>
): Promise<CustomerCategoryItem> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update customer category');
  }

  const json = await res.json();
  return json.data;
}

export async function deleteCustomerCategory(code: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete customer category');
  }
}
