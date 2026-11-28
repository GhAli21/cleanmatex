/**
 * Feature API client for staff management of customer Fast Quick Drop requests.
 * Tenant scope is enforced server-side from the authenticated staff session.
 */

export interface StaffOrderRequestLine {
  id: string;
  lineNo: number;
  serviceCategoryCode: string | null;
  productId: string | null;
  itemName: string;
  quantity: number;
  customerNotes: string | null;
}

export interface StaffOrderRequestItem {
  id: string;
  requestNo: string;
  customerId: string;
  customerName: string | null;
  customerMobile: string | null;
  requestedBranchId: string | null;
  requestedBranchName: string | null;
  requestedBranchName2: string | null;
  requestStatusCode: string;
  branchVerificationStatus: string;
  serviceSpeedCode: string | null;
  collectionMethodCode: string;
  deliveryModeCode: string;
  collectionAddressSnapshot: Record<string, unknown>;
  deliveryAddressSnapshot: Record<string, unknown>;
  estimatedTotalBags: number;
  estimatedTotalPieces: number;
  customerNotes: string | null;
  submittedAt: string;
  linkedOrderId: string | null;
  linkedOrderNo: string | null;
  lines: StaffOrderRequestLine[];
}

export interface StaffOrderRequestsListResponse {
  items: StaffOrderRequestItem[];
  total: number;
  pendingCount: number;
}

/**
 * Fetches paginated incoming customer Fast Quick Drop requests for the active tenant.
 */
export async function fetchStaffOrderRequests(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<StaffOrderRequestsListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await fetch(`/api/v1/order-requests?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to load order requests');
  }
  return {
    items: (json.data ?? []) as StaffOrderRequestItem[],
    total: Number(json.meta?.total ?? 0),
    pendingCount: Number(json.meta?.pendingCount ?? 0),
  };
}

/**
 * Fetches one customer Fast Quick Drop request detail for POS New Order intake.
 */
export async function fetchStaffOrderRequestById(
  requestId: string,
): Promise<StaffOrderRequestItem> {
  const res = await fetch(`/api/v1/order-requests/${encodeURIComponent(requestId)}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Order request not found');
  }
  return json.data as StaffOrderRequestItem;
}

/**
 * Applies a staff triage action (IN_REVIEW, AWAITING_CUSTOMER, DECLINED, CANCELLED).
 */
export async function triageStaffOrderRequestApi(
  requestId: string,
  payload: {
    statusCode?: 'IN_REVIEW' | 'AWAITING_CUSTOMER' | 'DECLINED' | 'CANCELLED';
    branchVerificationStatus?: 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
    reason?: string;
  },
): Promise<StaffOrderRequestItem> {
  const res = await fetch(`/api/v1/order-requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to update order request');
  }
  return json.data as StaffOrderRequestItem;
}
