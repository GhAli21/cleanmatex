import 'server-only';

import { randomBytes } from 'crypto';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import {
  resolveCustomerAppAddress,
  syncCustomerLastBranch,
  type CustomerAddressSource,
} from './customer-app-profile.service';

/** One optional customer-declared item row for a Fast Quick Drop request. */
export interface QuickDropDeclaredLineInput {
  serviceCategoryCode?: string | null;
  productId?: string | null;
  itemName: string;
  quantity: number;
  customerNotes?: string | null;
}

/** Input payload for submitting a Fast Quick Drop unpriced request. */
export interface CreateQuickDropRequestInput {
  tenantOrgId: string;
  orgCustomerId: string;
  sysCustomerId: string | null;
  requestedBranchId?: string | null;
  pickupMode: 'collect_address' | 'store_dropoff';
  deliveryMode: 'deliver_address' | 'store_pickup';
  pickupAddressId?: string | null;
  deliveryAddressId?: string | null;
  serviceSpeedCode?: string | null;
  estimatedTotalBags: number;
  estimatedTotalPieces: number;
  customerNotes?: string | null;
  declaredLines?: QuickDropDeclaredLineInput[];
  idempotencyKey?: string | null;
}

/** Customer-safe Fast Quick Drop request summary/detail DTO. */
export interface CustomerQuickDropRequestDto {
  id: string;
  requestNo: string;
  requestTypeCode: string;
  requestStatusCode: string;
  branchVerificationStatus: string;
  requestedBranchId: string | null;
  requestedBranchName: string | null;
  requestedBranchName2: string | null;
  collectionMethodCode: string;
  deliveryModeCode: string;
  returnDeliveryRequested: boolean;
  serviceSpeedCode: string | null;
  estimatedTotalBags: number;
  estimatedTotalPieces: number;
  customerNotes: string | null;
  submittedAt: string;
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

/** Typed domain error for Fast Quick Drop intake validation. */
export class CustomerQuickDropError extends Error {
  constructor(
    public readonly code:
      | 'BRANCH_NOT_ELIGIBLE'
      | 'PICKUP_ADDRESS_REQUIRED'
      | 'DELIVERY_ADDRESS_REQUIRED'
      | 'ADDRESS_NOT_FOUND'
      | 'INVALID_DECLARED_ITEM'
      | 'REQUEST_NOT_FOUND'
      | 'REQUEST_NOT_CANCELLABLE',
    message: string,
  ) {
    super(message);
    this.name = 'CustomerQuickDropError';
  }
}

function generateRequestNo(): string {
  const now = new Date();
  const ym = `${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `REQ-${ym}-${suffix}`;
}

/**
 * Lists Fast Quick Drop requests owned by the authenticated customer inside
 * one Organization, joined with any converted `org_orders_mst` order number.
 *
 * @param tenantOrgId - Organization tenant_org_id (enforced on every query).
 * @param orgCustomerId - Tenant-scoped org_customers_mst.id.
 * @returns Ordered list of customer-safe request DTOs.
 */
export async function listCustomerQuickDropRequests(
  tenantOrgId: string,
  orgCustomerId: string,
): Promise<CustomerQuickDropRequestDto[]> {
  const supabase = createAdminSupabaseClient();

  const { data: requests, error } = await supabase
    .from('org_ord_requests_mst')
    .select(
      `
      id,
      request_no,
      request_type_code,
      request_status_code,
      branch_verification_status,
      requested_branch_id,
      collection_method_code,
      delivery_mode_code,
      return_delivery_requested,
      service_speed_code,
      estimated_total_bags,
      estimated_total_pieces,
      customer_notes,
      submitted_at,
      converted_at,
      cancelled_at,
      cancellation_reason,
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
    )
    .eq('tenant_org_id', tenantOrgId)
    .eq('customer_id', orgCustomerId)
    .eq('is_active', true)
    .order('submitted_at', { ascending: false })
    .limit(30);

  if (error) throw error;

  const requestIds = (requests ?? []).map((r) => r.id as string);
  const linkedOrderByReq = new Map<string, { id: string; orderNo: string }>();

  if (requestIds.length > 0) {
    const { data: linkedOrders } = await supabase
      .from('org_orders_mst')
      .select('id, order_no, source_request_id')
      .eq('tenant_org_id', tenantOrgId)
      .in('source_request_id', requestIds);

    for (const ord of linkedOrders ?? []) {
      if (ord.source_request_id) {
        linkedOrderByReq.set(ord.source_request_id as string, {
          id: ord.id as string,
          orderNo: ord.order_no as string,
        });
      }
    }
  }

  return (requests ?? []).map((row) => {
    const branch = Array.isArray(row.org_branches_mst)
      ? row.org_branches_mst[0]
      : row.org_branches_mst;
    const rawLines = Array.isArray(row.org_ord_request_lines_dtl)
      ? row.org_ord_request_lines_dtl
      : [];
    const linked = linkedOrderByReq.get(row.id as string) ?? null;

    return {
      id: row.id as string,
      requestNo: row.request_no as string,
      requestTypeCode: row.request_type_code as string,
      requestStatusCode: row.request_status_code as string,
      branchVerificationStatus: row.branch_verification_status as string,
      requestedBranchId: (row.requested_branch_id as string | null) ?? null,
      requestedBranchName: (branch?.name as string | null) ?? null,
      requestedBranchName2: (branch?.name2 as string | null) ?? null,
      collectionMethodCode: row.collection_method_code as string,
      deliveryModeCode: (row.delivery_mode_code as string | null) ?? 'STORE_PICKUP',
      returnDeliveryRequested: row.return_delivery_requested === true,
      serviceSpeedCode: (row.service_speed_code as string | null) ?? null,
      estimatedTotalBags: Number(row.estimated_total_bags ?? 0),
      estimatedTotalPieces: Number(row.estimated_total_pieces ?? 0),
      customerNotes: (row.customer_notes as string | null) ?? null,
      submittedAt: row.submitted_at as string,
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
}

/**
 * Creates a new unpriced Fast Quick Drop request (`org_ord_requests_mst` +
 * optional `org_ord_request_lines_dtl` rows). Never writes money, tax, or
 * priced order lines.
 *
 * @param input - Validated customer Quick Drop submission.
 * @returns Newly created CustomerQuickDropRequestDto.
 */
export async function createCustomerQuickDropRequest(
  input: CreateQuickDropRequestInput,
): Promise<CustomerQuickDropRequestDto> {
  const supabase = createAdminSupabaseClient();

  // ─── Idempotency Check (2-minute duplicate window by Idempotency-Key) ────
  if (input.idempotencyKey && input.idempotencyKey.trim().length > 0) {
    const idempTag = `idemp:${input.idempotencyKey.trim().slice(0, 80)}`;
    const { data: existing } = await supabase
      .from('org_ord_requests_mst')
      .select('id')
      .eq('tenant_org_id', input.tenantOrgId)
      .eq('customer_id', input.orgCustomerId)
      .eq('created_info', idempTag)
      .maybeSingle();

    if (existing) {
      const list = await listCustomerQuickDropRequests(input.tenantOrgId, input.orgCustomerId);
      const found = list.find((r) => r.id === existing.id);
      if (found) return found;
    }
  }

  // ─── Branch Validation (optional for Quick Drop) ─────────────────────────
  let validBranchId: string | null = null;
  if (input.requestedBranchId) {
    const { data: branch } = await supabase
      .from('org_branches_mst')
      .select('id')
      .eq('tenant_org_id', input.tenantOrgId)
      .eq('id', input.requestedBranchId)
      .eq('is_active', true)
      .eq('is_customer_app_enabled', true)
      .maybeSingle();

    if (!branch) {
      throw new CustomerQuickDropError(
        'BRANCH_NOT_ELIGIBLE',
        'Selected branch is not available in the Customer App',
      );
    }
    validBranchId = branch.id;
  }

  // ─── Resolve Pickup & Delivery Address Snapshots (SYS or ORG) ────────────
  let pickupAddressId: string | null = null;
  let pickupAddressSource: CustomerAddressSource | null = null;
  let collectionAddressSnapshot: Record<string, unknown> = {};

  if (input.pickupMode === 'collect_address') {
    if (!input.pickupAddressId) {
      throw new CustomerQuickDropError(
        'PICKUP_ADDRESS_REQUIRED',
        'Pickup address is required when requesting collection from address',
      );
    }
    const resolved = await resolveCustomerAppAddress({
      tenantOrgId: input.tenantOrgId,
      orgCustomerId: input.orgCustomerId,
      sysCustomerId: input.sysCustomerId,
      addressId: input.pickupAddressId,
    });
    if (!resolved) {
      throw new CustomerQuickDropError('ADDRESS_NOT_FOUND', 'Pickup address not found');
    }
    pickupAddressId = resolved.id;
    pickupAddressSource = resolved.source;
    collectionAddressSnapshot = {
      label: resolved.label,
      description: resolved.description,
      building: resolved.building,
      floor: resolved.floor,
      apartment: resolved.apartment,
      street: resolved.street,
      area: resolved.area,
      city: resolved.city,
      deliveryNotes: resolved.deliveryNotes,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    };
  }

  let deliveryAddressId: string | null = null;
  let deliveryAddressSource: CustomerAddressSource | null = null;
  let deliveryAddressSnapshot: Record<string, unknown> = {};

  if (input.deliveryMode === 'deliver_address') {
    const targetDelivId = input.deliveryAddressId ?? input.pickupAddressId;
    if (!targetDelivId) {
      throw new CustomerQuickDropError(
        'DELIVERY_ADDRESS_REQUIRED',
        'Delivery address is required when requesting home delivery',
      );
    }
    const resolved = await resolveCustomerAppAddress({
      tenantOrgId: input.tenantOrgId,
      orgCustomerId: input.orgCustomerId,
      sysCustomerId: input.sysCustomerId,
      addressId: targetDelivId,
    });
    if (!resolved) {
      throw new CustomerQuickDropError('ADDRESS_NOT_FOUND', 'Delivery address not found');
    }
    deliveryAddressId = resolved.id;
    deliveryAddressSource = resolved.source;
    deliveryAddressSnapshot = {
      label: resolved.label,
      description: resolved.description,
      building: resolved.building,
      floor: resolved.floor,
      apartment: resolved.apartment,
      street: resolved.street,
      area: resolved.area,
      city: resolved.city,
      deliveryNotes: resolved.deliveryNotes,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
    };
  }

  // ─── Validate Optional Catalog Product & Service Category References ─────
  const declaredLines = input.declaredLines ?? [];
  const productIds = Array.from(
    new Set(
      declaredLines
        .map((l) => l.productId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  const validProducts = new Map<string, { id: string; name: string; serviceCategoryCode: string | null }>();
  if (productIds.length > 0) {
    const { data: prodRows } = await supabase
      .from('org_product_data_mst')
      .select('id, product_name, service_category_code')
      .eq('tenant_org_id', input.tenantOrgId)
      .in('id', productIds)
      .eq('is_active', true);

    for (const p of prodRows ?? []) {
      validProducts.set(p.id as string, {
        id: p.id as string,
        name: (p.product_name as string | null) ?? '',
        serviceCategoryCode: (p.service_category_code as string | null) ?? null,
      });
    }
  }

  const categoryCodes = Array.from(
    new Set(
      declaredLines
        .map((l) => l.serviceCategoryCode)
        .filter((c): c is string => typeof c === 'string' && c.length > 0),
    ),
  );
  const validCategoryCodes = new Set<string>();
  if (categoryCodes.length > 0) {
    const { data: catRows } = await supabase
      .from('org_service_category_cf')
      .select('service_category_code')
      .eq('tenant_org_id', input.tenantOrgId)
      .in('service_category_code', categoryCodes)
      .eq('is_active', true);

    for (const c of catRows ?? []) {
      if (c.service_category_code) validCategoryCodes.add(c.service_category_code as string);
    }
  }

  // ─── Insert Request Header (org_ord_requests_mst) ────────────────────────
  const requestNo = generateRequestNo();
  const collectionMethodCode =
    input.pickupMode === 'collect_address' ? 'COLLECT_FROM_ADDRESS' : 'DROP_OFF';
  const deliveryModeCode =
    input.deliveryMode === 'deliver_address' ? 'DELIVER_ADDRESS' : 'STORE_PICKUP';
  const createdInfo = input.idempotencyKey?.trim()
    ? `idemp:${input.idempotencyKey.trim().slice(0, 80)}`
    : 'customer_app_quick_drop';

  const { data: inserted, error: insertErr } = await supabase
    .from('org_ord_requests_mst')
    .insert({
      tenant_org_id: input.tenantOrgId,
      request_no: requestNo,
      customer_id: input.orgCustomerId,
      requested_branch_id: validBranchId,
      request_type_code: 'FAST_QUICK_DROP',
      request_source_code: 'CUSTOMER_APP',
      request_status_code: 'SUBMITTED',
      branch_verification_status: validBranchId ? 'PENDING' : 'NOT_REQUIRED',
      service_speed_code: input.serviceSpeedCode?.trim() || null,
      collection_method_code: collectionMethodCode,
      delivery_mode_code: deliveryModeCode,
      return_delivery_requested: deliveryModeCode === 'DELIVER_ADDRESS',
      pickup_address_id: pickupAddressId,
      pickup_address_source: pickupAddressSource,
      collection_address_snapshot: collectionAddressSnapshot as unknown as import('@/types/database').Json,
      delivery_address_id: deliveryAddressId,
      delivery_address_source: deliveryAddressSource,
      delivery_address_snapshot: deliveryAddressSnapshot as unknown as import('@/types/database').Json,
      estimated_total_bags: Math.max(0, Math.trunc(input.estimatedTotalBags)),
      estimated_total_pieces: Math.max(0, Math.trunc(input.estimatedTotalPieces)),
      customer_notes: input.customerNotes?.trim() || null,
      created_by: input.orgCustomerId,
      created_info: createdInfo,
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    logger.error('Failed to insert Fast Quick Drop request', insertErr as Error, {
      feature: 'customer_app_requests',
      tenantOrgId: input.tenantOrgId,
      orgCustomerId: input.orgCustomerId,
    });
    throw insertErr ?? new Error('Failed to create Fast Quick Drop request');
  }

  // ─── Insert Optional Declared Lines (org_ord_request_lines_dtl) ──────────
  if (declaredLines.length > 0) {
    const lineRows = declaredLines.map((line, index) => {
      const matchedProduct = line.productId ? validProducts.get(line.productId) : undefined;
      const requestedCat =
        line.serviceCategoryCode && validCategoryCodes.has(line.serviceCategoryCode)
          ? line.serviceCategoryCode
          : matchedProduct?.serviceCategoryCode &&
              validCategoryCodes.has(matchedProduct.serviceCategoryCode)
            ? matchedProduct.serviceCategoryCode
            : null;
      const itemName = line.itemName.trim() || matchedProduct?.name || 'Item';

      return {
        tenant_org_id: input.tenantOrgId,
        request_id: inserted.id as string,
        line_no: index + 1,
        service_category_code: requestedCat,
        product_id: matchedProduct?.id ?? null,
        item_name: itemName,
        quantity: Math.max(1, Number(line.quantity)),
        customer_notes: line.customerNotes?.trim() || null,
        created_by: input.orgCustomerId,
        created_info: 'customer_app_quick_drop_line',
      };
    });

    const { error: linesErr } = await supabase
      .from('org_ord_request_lines_dtl')
      .insert(lineRows);

    if (linesErr) {
      logger.error('Failed to insert Fast Quick Drop lines', linesErr as Error, {
        feature: 'customer_app_requests',
        tenantOrgId: input.tenantOrgId,
        requestId: inserted.id,
      });
      throw linesErr;
    }
  }

  // Remember customer's last selected branch inside this Organization.
  if (validBranchId) {
    await syncCustomerLastBranch(input.tenantOrgId, input.orgCustomerId, validBranchId);
  }

  const list = await listCustomerQuickDropRequests(input.tenantOrgId, input.orgCustomerId);
  const created = list.find((r) => r.id === inserted.id);
  if (!created) {
    throw new Error('Created request could not be reloaded');
  }
  return created;
}

/**
 * Cancels an un-converted Fast Quick Drop request on behalf of its owner.
 *
 * @param tenantOrgId - Organization tenant_org_id.
 * @param orgCustomerId - Owning org_customers_mst.id.
 * @param requestId - Request UUID.
 * @param reason - Optional cancellation explanation.
 */
export async function cancelCustomerQuickDropRequest(
  tenantOrgId: string,
  orgCustomerId: string,
  requestId: string,
  reason?: string | null,
): Promise<CustomerQuickDropRequestDto> {
  const supabase = createAdminSupabaseClient();

  const { data: existing } = await supabase
    .from('org_ord_requests_mst')
    .select('id, request_status_code')
    .eq('tenant_org_id', tenantOrgId)
    .eq('customer_id', orgCustomerId)
    .eq('id', requestId)
    .maybeSingle();

  if (!existing) {
    throw new CustomerQuickDropError('REQUEST_NOT_FOUND', 'Request not found');
  }

  const cancellable = ['SUBMITTED', 'IN_REVIEW', 'AWAITING_CUSTOMER'];
  if (!cancellable.includes(existing.request_status_code as string)) {
    throw new CustomerQuickDropError(
      'REQUEST_NOT_CANCELLABLE',
      'This request can no longer be cancelled',
    );
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('org_ord_requests_mst')
    .update({
      request_status_code: 'CANCELLED',
      cancelled_at: nowIso,
      cancellation_reason: reason?.trim() || 'Cancelled by customer',
      updated_at: nowIso,
      updated_by: orgCustomerId,
      updated_info: 'customer_app_cancel',
    })
    .eq('tenant_org_id', tenantOrgId)
    .eq('customer_id', orgCustomerId)
    .eq('id', requestId);

  if (error) throw error;

  const list = await listCustomerQuickDropRequests(tenantOrgId, orgCustomerId);
  const updated = list.find((r) => r.id === requestId);
  if (!updated) throw new CustomerQuickDropError('REQUEST_NOT_FOUND', 'Request not found');
  return updated;
}
