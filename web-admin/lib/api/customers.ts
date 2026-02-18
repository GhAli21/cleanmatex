/**
 * PRD-003: Customer Management API Client
 *
 * Handles all customer-related API operations including
 * CRUD, search, OTP verification, address management, and exports
 */

import type {
  Customer,
  CustomerListItem,
  CustomerWithTenantData,
  CustomerCreateRequest,
  CustomerUpdateRequest,
  CustomerUpgradeRequest,
  CustomerSearchParams,
  CustomerAddress,
  CreateAddressRequest,
  UpdateAddressRequest,
  SendOTPRequest,
  VerifyOTPRequest,
  MergeCustomersRequest,
  CustomerStatistics,
} from '@/lib/types/customer';

const API_BASE = '/api/v1/customers';

// ==================================================================
// CUSTOMER SEARCH (Picker / Fast fetch)
// ==================================================================

/** Params for fast customer search (picker, autocomplete) */
export interface CustomerSearchPickerParams {
  search: string;
  searchAllOptions?: boolean;
  limit?: number;
}

/** Customer item from search API (picker format) */
export interface CustomerSearchItem {
  id: string;
  displayName?: string | null;
  firstName?: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  source?: 'current_tenant' | 'sys_global' | 'other_tenant';
  belongsToCurrentTenant?: boolean;
  originalTenantId?: string;
  customerId?: string;
  orgCustomerId?: string;
}

/**
 * Fast customer search for picker/autocomplete.
 * Uses limit=10 and skipCount on server for quick response.
 */
export async function searchCustomersForPicker(
  params: CustomerSearchPickerParams
): Promise<CustomerSearchItem[]> {
  const { search, searchAllOptions = false, limit = 10 } = params;
  const queryParams = new URLSearchParams({
    search: search.trim(),
    limit: String(limit),
    searchAllOptions: String(searchAllOptions),
  });

  const response = await fetch(`${API_BASE}?${queryParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search customers');
  }

  const data = await response.json();
  const customers = Array.isArray(data.data) ? data.data : data.data?.customers ?? [];
  return customers;
}

// ==================================================================
// CUSTOMER CRUD OPERATIONS
// ==================================================================

/**
 * Fetch paginated list of customers with search and filters
 */
export async function fetchCustomers(
  params: CustomerSearchParams = {}
): Promise<{
  customers: CustomerListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  statistics?: CustomerStatistics;
}> {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.set('page', params.page.toString());
  if (params.limit) queryParams.set('limit', params.limit.toString());
  if (params.search) queryParams.set('search', params.search);
  if (params.type) queryParams.set('type', params.type);
  if (params.status) queryParams.set('status', params.status);
  if (params.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

  const response = await fetch(`${API_BASE}?${queryParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch customers');
  }

  const data = await response.json();
  return {
    customers: Array.isArray(data.data) ? data.data : [],
    pagination: data.pagination || {
      total: 0,
      page: params.page || 1,
      limit: params.limit || 20,
      totalPages: 0,
    },
    statistics: data.statistics,
  };
}

/**
 * Fetch customer statistics
 */
export async function fetchCustomerStats(): Promise<CustomerStatistics> {
  const queryParams = new URLSearchParams({ includeStats: 'true' });
  const response = await fetch(`${API_BASE}?${queryParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch customer statistics');
  }

  const data = await response.json();
  return data.statistics;
}

/**
 * Get customer by ID
 */
export async function getCustomerById(
  customerId: string
): Promise<CustomerWithTenantData> {
  const response = await fetch(`${API_BASE}/${customerId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch customer');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Create a new customer (guest, stub, or full)
 */
export async function createCustomer(
  request: CustomerCreateRequest
): Promise<Customer> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create customer');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Update customer profile
 */
export async function updateCustomer(
  customerId: string,
  updates: CustomerUpdateRequest
): Promise<Customer> {
  const response = await fetch(`${API_BASE}/${customerId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update customer');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Deactivate customer (admin only)
 */
export async function deactivateCustomer(customerId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${customerId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to deactivate customer');
  }
}

/**
 * Upgrade stub customer to full profile
 */
export async function upgradeCustomerProfile(
  customerId: string,
  request: CustomerUpgradeRequest
): Promise<Customer> {
  const response = await fetch(`${API_BASE}/${customerId}/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upgrade customer profile');
  }

  const data = await response.json();
  return data.data;
}

// ==================================================================
// OTP VERIFICATION
// ==================================================================

/**
 * Send OTP code to phone number
 */
export async function sendOTP(request: SendOTPRequest): Promise<{
  success: boolean;
  message: string;
  expiresAt: string;
  phone: string;
}> {
  const response = await fetch(`${API_BASE}/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send OTP');
  }

  return response.json();
}

/**
 * Verify OTP code
 */
export async function verifyOTP(request: VerifyOTPRequest): Promise<{
  success: boolean;
  verified: boolean;
  token?: string;
  message?: string;
}> {
  const response = await fetch(`${API_BASE}/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  // Note: verify-otp returns 400 for invalid codes, but we still parse the response
  return {
    success: data.success || false,
    verified: data.verified || false,
    token: data.token,
    message: data.message,
  };
}

// ==================================================================
// ADDRESS MANAGEMENT
// ==================================================================

/**
 * Get all addresses for a customer
 */
export async function getCustomerAddresses(
  customerId: string
): Promise<CustomerAddress[]> {
  const response = await fetch(`${API_BASE}/${customerId}/addresses`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch addresses');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Create a new address for a customer
 */
export async function createAddress(
  customerId: string,
  request: CreateAddressRequest
): Promise<CustomerAddress> {
  const response = await fetch(`${API_BASE}/${customerId}/addresses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create address');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Update an address
 */
export async function updateAddress(
  customerId: string,
  addressId: string,
  updates: UpdateAddressRequest
): Promise<CustomerAddress> {
  const response = await fetch(
    `${API_BASE}/${customerId}/addresses/${addressId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update address');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Delete an address
 */
export async function deleteAddress(
  customerId: string,
  addressId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/${customerId}/addresses/${addressId}`,
    {
      method: 'DELETE',
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete address');
  }
}

// ==================================================================
// ADMIN OPERATIONS
// ==================================================================

/**
 * Merge duplicate customers (admin only)
 */
export async function mergeCustomers(
  request: MergeCustomersRequest
): Promise<{
  targetCustomer: Customer;
  ordersMoved: number;
  loyaltyPointsMerged: number;
}> {
  const response = await fetch(`${API_BASE}/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to merge customers');
  }

  const data = await response.json();
  return data.data;
}

/**
 * Export customers to CSV (admin only)
 */
export async function exportCustomers(params: {
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<Blob> {
  const queryParams = new URLSearchParams();

  if (params.type) queryParams.set('type', params.type);
  if (params.status) queryParams.set('status', params.status);
  if (params.startDate) queryParams.set('startDate', params.startDate);
  if (params.endDate) queryParams.set('endDate', params.endDate);

  const response = await fetch(`${API_BASE}/export?${queryParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to export customers');
  }

  return response.blob();
}

/**
 * Download exported CSV file
 */
export function downloadCSV(blob: Blob, filename: string = 'customers.csv') {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
