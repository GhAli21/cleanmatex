import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { syncCustomerLastBranch } from './customer-app-profile.service';

type PrismaTx = Prisma.TransactionClient;

/** Staff-facing Fast Quick Drop request detail row with customer & branch metadata. */
export interface StaffOrderRequestDto {
  id: string;
  requestNo: string;
  customerId: string;
  customerName: string | null;
  customerMobile: string | null;
  requestedBranchId: string | null;
  requestedBranchName: string | null;
  requestedBranchName2: string | null;
  requestTypeCode: string;
  requestSourceCode: string;
  requestStatusCode: string;
  branchVerificationStatus: string;
  serviceSpeedCode: string | null;
  collectionMethodCode: string;
  deliveryModeCode: string;
  returnDeliveryRequested: boolean;
  collectionAddressSnapshot: Record<string, unknown>;
  deliveryAddressSnapshot: Record<string, unknown>;
  estimatedTotalBags: number;
  estimatedTotalPieces: number;
  customerNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  convertedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  linkedOrderId: string | null;
  linkedOrderNo: string | null;
  lines: Array<{
    id: string;
    lineNo: number;
    serviceCategoryCode: string | null;
    productId: string | null;
    itemName: string;
    quantity: number;
    customerNotes: string | null;
  }>;
}

/** Typed domain error for staff request triage & atomic POS conversion. */
export class OrderRequestConversionError extends Error {
  constructor(
    public readonly code:
      | 'REQUEST_NOT_FOUND'
      | 'REQUEST_ALREADY_CONVERTED'
      | 'REQUEST_NOT_CONVERTIBLE'
      | 'INVALID_STATUS_TRANSITION',
    message: string,
    public readonly linkedOrderId?: string | null,
    public readonly linkedOrderNo?: string | null,
  ) {
    super(message);
    this.name = 'OrderRequestConversionError';
  }
}

const CONVERTIBLE_STATUSES = new Set(['SUBMITTED', 'IN_REVIEW', 'AWAITING_CUSTOMER']);

/**
 * Lists Fast Quick Drop customer requests for staff triage inside one tenant.
 *
 * @param tenantOrgId - Authenticated staff tenant_org_id (never caller-supplied).
 * @param options.status - Optional status filter.
 * @param options.page - 1-based page number.
 * @param options.limit - Page size (capped at 50).
 * @returns Paginated staff order requests and pending badge count.
 * @example
 * const res = await listStaffOrderRequests(tenantOrgId, { page: 1, limit: 20 });
 */
export async function listStaffOrderRequests(
  tenantOrgId: string,
  options?: { status?: string; page?: number; limit?: number },
): Promise<{ items: StaffOrderRequestDto[]; total: number; pendingCount: number }> {
  const supabase = createAdminSupabaseClient();
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(50, Math.max(1, options?.limit ?? 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('org_ord_requests_mst')
    .select(
      `
      id,
      request_no,
      customer_id,
      requested_branch_id,
      request_type_code,
      request_source_code,
      request_status_code,
      branch_verification_status,
      service_speed_code,
      collection_method_code,
      delivery_mode_code,
      return_delivery_requested,
      collection_address_snapshot,
      delivery_address_snapshot,
      estimated_total_bags,
      estimated_total_pieces,
      customer_notes,
      submitted_at,
      reviewed_at,
      converted_at,
      cancelled_at,
      cancellation_reason,
      org_customers_mst(display_name, name, phone),
      org_branches_mst(name, name2),
      org_ord_request_lines_dtl(
        id,
        line_no,
        service_category_code,
        product_id,
        item_name,
        quantity,
        customer_notes
      )
    `,
      { count: 'exact' },
    )
    .eq('tenant_org_id', tenantOrgId)
    .eq('is_active', true)
    .order('submitted_at', { ascending: false })
    .range(from, to);

  if (options?.status && options.status !== 'ALL') {
    query = query.eq('request_status_code', options.status);
  }

  const [{ data, count, error }, { count: pendingCount }] = await Promise.all([
    query,
    supabase
      .from('org_ord_requests_mst')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_org_id', tenantOrgId)
      .eq('is_active', true)
      .in('request_status_code', ['SUBMITTED', 'IN_REVIEW', 'AWAITING_CUSTOMER']),
  ]);

  if (error) throw error;

  const requestIds = (data ?? []).map((row) => row.id as string);
  const linkedByReq = new Map<string, { id: string; orderNo: string }>();
  if (requestIds.length > 0) {
    const { data: linkedOrders } = await supabase
      .from('org_orders_mst')
      .select('id, order_no, source_request_id')
      .eq('tenant_org_id', tenantOrgId)
      .in('source_request_id', requestIds);

    for (const ord of linkedOrders ?? []) {
      if (ord.source_request_id) {
        linkedByReq.set(ord.source_request_id as string, {
          id: ord.id as string,
          orderNo: ord.order_no as string,
        });
      }
    }
  }

  const items: StaffOrderRequestDto[] = (data ?? []).map((row) => {
    const cust = Array.isArray(row.org_customers_mst)
      ? row.org_customers_mst[0]
      : row.org_customers_mst;
    const br = Array.isArray(row.org_branches_mst)
      ? row.org_branches_mst[0]
      : row.org_branches_mst;
    const rawLines = Array.isArray(row.org_ord_request_lines_dtl)
      ? row.org_ord_request_lines_dtl
      : [];
    const linked = linkedByReq.get(row.id as string) ?? null;

    return {
      id: row.id as string,
      requestNo: row.request_no as string,
      customerId: row.customer_id as string,
      customerName: (cust?.display_name ?? cust?.name ?? null) as string | null,
      customerMobile: (cust?.phone ?? null) as string | null,
      requestedBranchId: (row.requested_branch_id as string | null) ?? null,
      requestedBranchName: (br?.name ?? null) as string | null,
      requestedBranchName2: (br?.name2 ?? null) as string | null,
      requestTypeCode: row.request_type_code as string,
      requestSourceCode: row.request_source_code as string,
      requestStatusCode: row.request_status_code as string,
      branchVerificationStatus: row.branch_verification_status as string,
      serviceSpeedCode: (row.service_speed_code as string | null) ?? null,
      collectionMethodCode: row.collection_method_code as string,
      deliveryModeCode: (row.delivery_mode_code as string | null) ?? 'STORE_PICKUP',
      returnDeliveryRequested: row.return_delivery_requested === true,
      collectionAddressSnapshot:
        (row.collection_address_snapshot as Record<string, unknown> | null) ?? {},
      deliveryAddressSnapshot:
        (row.delivery_address_snapshot as Record<string, unknown> | null) ?? {},
      estimatedTotalBags: Number(row.estimated_total_bags ?? 0),
      estimatedTotalPieces: Number(row.estimated_total_pieces ?? 0),
      customerNotes: (row.customer_notes as string | null) ?? null,
      submittedAt: row.submitted_at as string,
      reviewedAt: (row.reviewed_at as string | null) ?? null,
      convertedAt: (row.converted_at as string | null) ?? null,
      cancelledAt: (row.cancelled_at as string | null) ?? null,
      cancellationReason: (row.cancellation_reason as string | null) ?? null,
      linkedOrderId: linked?.id ?? null,
      linkedOrderNo: linked?.orderNo ?? null,
      lines: rawLines
        .map((line: Record<string, unknown>) => ({
          id: String(line.id),
          lineNo: Number(line.line_no ?? 1),
          serviceCategoryCode: (line.service_category_code as string | null) ?? null,
          productId: (line.product_id as string | null) ?? null,
          itemName: String(line.item_name ?? ''),
          quantity: Number(line.quantity ?? 1),
          customerNotes: (line.customer_notes as string | null) ?? null,
        }))
        .sort((a, b) => a.lineNo - b.lineNo),
    };
  });

  return {
    items,
    total: count ?? items.length,
    pendingCount: pendingCount ?? 0,
  };
}

/**
 * Fetches one Fast Quick Drop request detail scoped strictly to `tenantOrgId`.
 *
 * @param tenantOrgId - Authenticated staff tenant_org_id.
 * @param requestId - Request UUID.
 * @returns StaffOrderRequestDto or null when not found in tenant.
 */
export async function getStaffOrderRequestDetail(
  tenantOrgId: string,
  requestId: string,
): Promise<StaffOrderRequestDto | null> {
  const { items } = await listStaffOrderRequests(tenantOrgId, { page: 1, limit: 50 });
  const direct = items.find((item) => item.id === requestId);
  if (direct) return direct;

  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from('org_ord_requests_mst')
    .select('id')
    .eq('tenant_org_id', tenantOrgId)
    .eq('id', requestId)
    .maybeSingle();

  if (!data) return null;

  // Fetch directly when older than page 1.
  const { data: row } = await supabase
    .from('org_ord_requests_mst')
    .select(
      `
      id, request_no, customer_id, requested_branch_id, request_type_code,
      request_source_code, request_status_code, branch_verification_status,
      service_speed_code, collection_method_code, delivery_mode_code,
      return_delivery_requested, collection_address_snapshot,
      delivery_address_snapshot, estimated_total_bags, estimated_total_pieces,
      customer_notes, submitted_at, reviewed_at, converted_at, cancelled_at,
      cancellation_reason,
      org_customers_mst(display_name, name, phone),
      org_branches_mst(name, name2),
      org_ord_request_lines_dtl(id, line_no, service_category_code, product_id, item_name, quantity, customer_notes)
    `,
    )
    .eq('tenant_org_id', tenantOrgId)
    .eq('id', requestId)
    .maybeSingle();

  if (!row) return null;
  const { data: linked } = await supabase
    .from('org_orders_mst')
    .select('id, order_no')
    .eq('tenant_org_id', tenantOrgId)
    .eq('source_request_id', requestId)
    .maybeSingle();

  const cust = Array.isArray(row.org_customers_mst) ? row.org_customers_mst[0] : row.org_customers_mst;
  const br = Array.isArray(row.org_branches_mst) ? row.org_branches_mst[0] : row.org_branches_mst;
  const rawLines = Array.isArray(row.org_ord_request_lines_dtl) ? row.org_ord_request_lines_dtl : [];

  return {
    id: row.id as string,
    requestNo: row.request_no as string,
    customerId: row.customer_id as string,
    customerName: (cust?.display_name ?? cust?.name ?? null) as string | null,
    customerMobile: (cust?.phone ?? null) as string | null,
    requestedBranchId: (row.requested_branch_id as string | null) ?? null,
    requestedBranchName: (br?.name ?? null) as string | null,
    requestedBranchName2: (br?.name2 ?? null) as string | null,
    requestTypeCode: row.request_type_code as string,
    requestSourceCode: row.request_source_code as string,
    requestStatusCode: row.request_status_code as string,
    branchVerificationStatus: row.branch_verification_status as string,
    serviceSpeedCode: (row.service_speed_code as string | null) ?? null,
    collectionMethodCode: row.collection_method_code as string,
    deliveryModeCode: (row.delivery_mode_code as string | null) ?? 'STORE_PICKUP',
    returnDeliveryRequested: row.return_delivery_requested === true,
    collectionAddressSnapshot: (row.collection_address_snapshot as Record<string, unknown>) ?? {},
    deliveryAddressSnapshot: (row.delivery_address_snapshot as Record<string, unknown>) ?? {},
    estimatedTotalBags: Number(row.estimated_total_bags ?? 0),
    estimatedTotalPieces: Number(row.estimated_total_pieces ?? 0),
    customerNotes: (row.customer_notes as string | null) ?? null,
    submittedAt: row.submitted_at as string,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    convertedAt: (row.converted_at as string | null) ?? null,
    cancelledAt: (row.cancelled_at as string | null) ?? null,
    cancellationReason: (row.cancellation_reason as string | null) ?? null,
    linkedOrderId: (linked?.id as string | null) ?? null,
    linkedOrderNo: (linked?.order_no as string | null) ?? null,
    lines: rawLines
      .map((line: Record<string, unknown>) => ({
        id: String(line.id),
        lineNo: Number(line.line_no ?? 1),
        serviceCategoryCode: (line.service_category_code as string | null) ?? null,
        productId: (line.product_id as string | null) ?? null,
        itemName: String(line.item_name ?? ''),
        quantity: Number(line.quantity ?? 1),
        customerNotes: (line.customer_notes as string | null) ?? null,
      }))
      .sort((a, b) => a.lineNo - b.lineNo),
  };
}

/**
 * Staff triage update on an unconverted customer request (mark in review,
 * request customer confirmation, decline/cancel, or verify branch).
 *
 * @param params.tenantOrgId - Authenticated staff tenant_org_id.
 * @param params.requestId - Request UUID.
 * @param params.staffUserId - Authenticated staff user ID.
 * @param params.statusCode - Optional next triage status.
 * @param params.branchVerificationStatus - Optional branch verification status.
 * @param params.reason - Optional decline/cancel reason.
 */
export async function triageStaffOrderRequest(params: {
  tenantOrgId: string;
  requestId: string;
  staffUserId: string;
  statusCode?: 'IN_REVIEW' | 'AWAITING_CUSTOMER' | 'DECLINED' | 'CANCELLED';
  branchVerificationStatus?: 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  reason?: string | null;
}): Promise<StaffOrderRequestDto> {
  const supabase = createAdminSupabaseClient();

  const { data: existing } = await supabase
    .from('org_ord_requests_mst')
    .select('id, request_status_code')
    .eq('tenant_org_id', params.tenantOrgId)
    .eq('id', params.requestId)
    .maybeSingle();

  if (!existing) {
    throw new OrderRequestConversionError('REQUEST_NOT_FOUND', 'Order request not found');
  }

  if (!CONVERTIBLE_STATUSES.has(existing.request_status_code as string)) {
    throw new OrderRequestConversionError(
      'INVALID_STATUS_TRANSITION',
      'Request is already finalized and cannot be modified',
    );
  }

  const nowIso = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    reviewed_at: nowIso,
    reviewed_by: params.staffUserId,
    updated_at: nowIso,
    updated_by: params.staffUserId,
    updated_info: 'staff_request_triage',
  };

  if (params.statusCode) {
    updateData.request_status_code = params.statusCode;
    if (params.statusCode === 'CANCELLED') {
      updateData.cancelled_at = nowIso;
      updateData.cancellation_reason = params.reason?.trim() || 'Cancelled by staff';
    } else if (params.statusCode === 'DECLINED' && params.reason) {
      updateData.cancellation_reason = params.reason.trim();
    }
  }
  if (params.branchVerificationStatus) {
    updateData.branch_verification_status = params.branchVerificationStatus;
  }

  const { error } = await supabase
    .from('org_ord_requests_mst')
    .update(updateData)
    .eq('tenant_org_id', params.tenantOrgId)
    .eq('id', params.requestId);

  if (error) throw error;

  const updated = await getStaffOrderRequestDetail(params.tenantOrgId, params.requestId);
  if (!updated) throw new OrderRequestConversionError('REQUEST_NOT_FOUND', 'Order request not found');
  return updated;
}

/**
 * Atomically locks `org_ord_requests_mst` inside the active POS order-creation
 * transaction (`SELECT ... FOR UPDATE`), verifies 1-request-to-1-order
 * exclusivity, links `org_orders_mst.source_request_id` + `source_request_no`,
 * and marks the request `CONVERTED`.
 *
 * @param tx - Active Prisma transaction client from POS submit orchestrator.
 * @param params.tenantOrgId - Authenticated staff tenant_org_id.
 * @param params.requestId - Originating org_ord_requests_mst.id.
 * @param params.orderId - Newly created org_orders_mst.id.
 * @param params.staffUserId - Authenticated staff actor ID.
 * @param params.branchId - Final branch UUID on the created order.
 * @returns Immutable request_no linked onto the order.
 */
export async function linkAndConvertOrderRequestTx(
  tx: PrismaTx,
  params: {
    tenantOrgId: string;
    requestId: string;
    orderId: string;
    staffUserId: string;
    branchId?: string | null;
  },
): Promise<{ requestNo: string; customerId: string }> {
  // Lock the request row exclusively inside this transaction to block race-condition double conversions.
  const lockedRows = await tx.$queryRaw<
    Array<{
      id: string;
      request_no: string;
      customer_id: string;
      request_status_code: string;
    }>
  >`
    SELECT id, request_no, customer_id, request_status_code
    FROM public.org_ord_requests_mst
    WHERE id = ${params.requestId}::uuid
      AND tenant_org_id = ${params.tenantOrgId}::uuid
    FOR UPDATE
  `;

  const req = lockedRows[0];
  if (!req) {
    throw new OrderRequestConversionError('REQUEST_NOT_FOUND', 'Source order request not found');
  }

  if (req.request_status_code === 'CONVERTED') {
    const existingOrder = await tx.org_orders_mst.findFirst({
      where: {
        tenant_org_id: params.tenantOrgId,
        source_request_id: params.requestId,
      },
      select: { id: true, order_no: true },
    });
    throw new OrderRequestConversionError(
      'REQUEST_ALREADY_CONVERTED',
      'This customer request has already been converted to an order',
      existingOrder?.id ?? null,
      existingOrder?.order_no ?? null,
    );
  }

  if (!CONVERTIBLE_STATUSES.has(req.request_status_code)) {
    throw new OrderRequestConversionError(
      'REQUEST_NOT_CONVERTIBLE',
      'This customer request is closed and cannot be converted',
    );
  }

  const now = new Date();
  await tx.org_orders_mst.updateMany({
    where: {
      id: params.orderId,
      tenant_org_id: params.tenantOrgId,
    },
    data: {
      source_request_id: req.id,
      source_request_no: req.request_no,
      order_source_code: 'customer_mobile_app',
    },
  });

  await tx.org_ord_requests_mst.updateMany({
    where: {
      id: req.id,
      tenant_org_id: params.tenantOrgId,
    },
    data: {
      request_status_code: 'CONVERTED',
      converted_at: now,
      reviewed_at: now,
      reviewed_by: params.staffUserId,
      updated_at: now,
      updated_by: params.staffUserId,
      updated_info: 'pos_request_converted',
    },
  });

  return { requestNo: req.request_no, customerId: req.customer_id };
}

/**
 * Post-commit sync wrapper for updating `org_customers_mst.last_branch_id`
 * after a converted order commits.
 */
export async function syncLastBranchAfterConversion(
  tenantOrgId: string,
  orgCustomerId: string,
  branchId: string | null | undefined,
): Promise<void> {
  await withTenantContext(tenantOrgId, () =>
    syncCustomerLastBranch(tenantOrgId, orgCustomerId, branchId),
  );
}
