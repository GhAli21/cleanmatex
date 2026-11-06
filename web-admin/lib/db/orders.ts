/* eslint-disable jsdoc/require-param */
/**
 * Order Data Access Layer
 *
 * Database operations for orders using Prisma.
 * All queries automatically filter by tenant_org_id via Prisma middleware.
 */

import { prisma } from '@/lib/db/prisma';
import type {
  Order,
  OrderWithDetails,
  OrderListItem,
  OrderListResponse,
  OrderFilters,
} from '@/types/order';

/**
 * Localized profile label attached to an immutable order workflow snapshot.
 *
 * The profile catalog remains global, while the owning order predicate keeps
 * this read within the authenticated tenant boundary.
 */
type OrderWorkflowProfileLabelRow = {
  workflow_profile_name: string | null;
  workflow_profile_name2: string | null;
};
import { orderNoFromCode } from '@/lib/validations/code-format-schemas';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Gets an order with its current operational structure.
 *
 * Removed items remain available through immutable Change history, so this live
 * reader deliberately excludes them from the editable and operational projection.
 *
 * @param tenantOrgId - Tenant organisation ID that scopes every order child query.
 * @param orderId - Order identity within the tenant.
 * @returns The order with active items, or `null` when it is absent for the tenant.
 */
export async function getOrderById(
  tenantOrgId: string,
  orderId: string,
): Promise<OrderWithDetails | null> {
  const order = await prisma.org_orders_mst.findUnique({
    where: {
      id: orderId,
      tenant_org_id: tenantOrgId,
    },
    include: {
      org_customers_mst: {
        select: {
          id: true,
          name: true,
          name2: true,
          phone: true,
          email: true,
          type: true,
          preferences: true,
          sys_customers_mst: {
            select: {
              id: true,
              name: true,
              name2: true,
              phone: true,
              email: true,
              preferences: true,
            },
          },
        },
      },
      org_order_items_dtl: {
        where: { tenant_org_id: tenantOrgId, rec_status: 1 },
        orderBy: { created_at: 'asc' },
      },
      org_branches_mst: {
        select: {
          id: true,
          branch_name: true,
        },
      },
      sys_order_sources_cd: {
        select: {
          order_source_code: true,
          name: true,
          name2: true,
          requires_remote_intake_confirm: true,
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  const workflowProfileLabel = await prisma.$queryRaw<
    OrderWorkflowProfileLabelRow[]
  >`
    SELECT
      profile_row.name AS workflow_profile_name,
      profile_row.name2 AS workflow_profile_name2
    FROM public.org_orders_mst AS order_row
    LEFT JOIN public.sys_wf_profiles_cd AS profile_row
      ON profile_row.profile_id = order_row.wf_profile_id
    WHERE order_row.id = ${orderId}::uuid
      AND order_row.tenant_org_id = ${tenantOrgId}::uuid
    LIMIT 1
  `;

  // Get customer data from org_customers_mst, fallback to sys_customers_mst if available
  const customerData =
    order.org_customers_mst?.sys_customers_mst || order.org_customers_mst;

  return {
    ...order,
    // state_version is BIGINT in the DB (workflow-engine optimistic concurrency token);
    // Prisma returns it as a native bigint, which JSON.stringify cannot serialize.
    state_version:
      typeof order.state_version === 'bigint'
        ? Number(order.state_version)
        : order.state_version,
    customer: customerData,
    items: order.org_order_items_dtl,
    branch: order.org_branches_mst,
    order_source: order.sys_order_sources_cd,
    // A pinned profile may be retired after ordering; retain its label for operational traceability.
    workflow_profile_name:
      workflowProfileLabel[0]?.workflow_profile_name ?? null,
    workflow_profile_name2:
      workflowProfileLabel[0]?.workflow_profile_name2 ?? null,
  } as unknown as OrderWithDetails;
}

/**
 * Resolve an order from either its UUID or its human-readable order number.
 *
 * We prefer UUID when it matches and exists, then fall back to an exact
 * case-insensitive order number lookup within the same tenant.
 */
export async function getOrderByReference(
  tenantOrgId: string,
  orderReference: string,
): Promise<OrderWithDetails | null> {
  const normalizedReference = orderReference.trim();
  if (!normalizedReference) {
    return null;
  }

  if (UUID_REGEX.test(normalizedReference)) {
    const orderById = await getOrderById(tenantOrgId, normalizedReference);
    if (orderById) {
      return orderById;
    }
  }

  const orderRow = await prisma.org_orders_mst.findFirst({
    where: {
      tenant_org_id: tenantOrgId,
      order_no: {
        equals: normalizedReference,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
    },
  });

  if (!orderRow?.id) {
    return null;
  }

  return getOrderById(tenantOrgId, orderRow.id);
}

/**
 * Lists tenant orders with current item and piece counts.
 *
 * Counts exclude V2-removed structure so queue and summary views never revive
 * historical rows preserved for Change lineage.
 *
 * @param tenantOrgId - Tenant organisation ID that scopes orders and structural counts.
 * @param filters - Pagination, search, and lifecycle filters for the list projection.
 * @returns A paginated order list with active structural counts.
 */
export async function listOrders(
  tenantOrgId: string,
  filters: OrderFilters,
): Promise<OrderListResponse> {
  // Validate tenantOrgId is a valid UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantOrgId)) {
    throw new Error(
      `Invalid tenant ID format: ${tenantOrgId}. Expected UUID format.`,
    );
  }
  const {
    status,
    preparationStatus,
    priority,
    isRetail,
    customerId,
    branchId,
    fromDate,
    toDate,
    search,
    page = 1,
    limit = 20,
    sortBy = 'received_at',
    sortOrder = 'desc',
    orderSourceCode,
    physicalIntakeStatus,
  } = filters;

  // Build where clause
  const where: any = {
    tenant_org_id: tenantOrgId,
  };

  if (status) {
    where.status = Array.isArray(status) ? { in: status } : status;
  }

  if (preparationStatus) {
    where.preparation_status = Array.isArray(preparationStatus)
      ? { in: preparationStatus }
      : preparationStatus;
  }

  if (priority) {
    where.priority = Array.isArray(priority) ? { in: priority } : priority;
  }

  if (isRetail === 'true') {
    where.is_retail = true;
  } else if (isRetail === 'false') {
    where.is_retail = false;
  }

  if (customerId) {
    where.customer_id = customerId;
  }

  if (branchId) {
    where.branch_id = branchId;
  }

  if (fromDate) {
    where.received_at = { ...where.received_at, gte: fromDate };
  }

  if (toDate) {
    where.received_at = { ...where.received_at, lte: toDate };
  }

  if (orderSourceCode) {
    const codes = orderSourceCode
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (codes.length > 1) {
      where.order_source_code = { in: codes };
    } else if (codes.length === 1) {
      where.order_source_code = codes[0];
    }
  }

  if (physicalIntakeStatus) {
    const statuses = physicalIntakeStatus
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length > 1) {
      where.physical_intake_status = { in: statuses };
    } else if (statuses.length === 1) {
      where.physical_intake_status = statuses[0];
    }
  }

  // Fast path (HFC T3.9): a full order number, line code or piece code finds that order (and its sub-orders) by
  // exact order_no, so the unique index is used and customer text search is skipped.
  const searchOrderNo = search ? orderNoFromCode(search) : null;
  if (searchOrderNo) {
    where.OR = [{ order_no: searchOrderNo }, { order_no: { startsWith: `${searchOrderNo}-S` } }];
  } else if (search) {
    where.OR = [
      { order_no: { contains: search, mode: 'insensitive' } },
      {
        org_customers_mst: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            {
              sys_customers_mst: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { phone: { contains: search } },
                ],
              },
            },
          ],
        },
      },
    ];
  }

  // Get total count
  const total = await prisma.org_orders_mst.count({ where });

  // Get orders
  const orders = await prisma.org_orders_mst.findMany({
    where,
    include: {
      org_customers_mst: {
        select: {
          id: true,
          name: true,
          name2: true,
          phone: true,
          email: true,
          sys_customers_mst: {
            select: {
              id: true,
              name: true,
              name2: true,
              phone: true,
              email: true,
            },
          },
        },
      },
      org_branches_mst: {
        select: {
          branch_name: true,
        },
      },
      sys_order_sources_cd: {
        select: {
          order_source_code: true,
          name: true,
          name2: true,
          requires_remote_intake_confirm: true,
        },
      },
      org_order_items_dtl: {
        where: { tenant_org_id: tenantOrgId, rec_status: 1 },
        select: {
          id: true,
        },
      },
    },
    orderBy:
      sortBy === 'received_at'
        ? [
            { received_at: { sort: sortOrder, nulls: 'last' } },
            { created_at: sortOrder },
          ]
        : { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Get piece counts for all orders in batch
  const orderIds = orders.map((o) => o.id);
  const itemIds = orders.flatMap((o) =>
    o.org_order_items_dtl.map((item) => item.id),
  );

  const pieceCounts =
    itemIds.length > 0
      ? await prisma.org_order_item_pieces_dtl.groupBy({
          by: ['order_id'],
          where: {
            order_id: { in: orderIds },
            tenant_org_id: tenantOrgId,
            rec_status: 1,
          },
          _count: {
            id: true,
          },
        })
      : [];

  const pieceCountMap = new Map(
    pieceCounts.map((pc) => [pc.order_id, pc._count.id]),
  );

  const orderList: OrderListItem[] = orders.map((order) => {
    // The order snapshot preserves who the counter served at the time of sale;
    // master records only fill legacy orders whose snapshot was never written.
    const customerData =
      order.org_customers_mst?.sys_customers_mst || order.org_customers_mst;

    // Ensure customer data is properly formatted (defensive check)
    const customerId = customerData?.id || order.org_customers_mst?.id || '';
    const customerName =
      order.customer_name?.trim() ||
      order.org_customers_mst?.name?.trim() ||
      order.org_customers_mst?.sys_customers_mst?.name?.trim() ||
      '';
    const customerPhone =
      customerData?.phone || order.org_customers_mst?.phone || '';

    // Ensure all values are strings, not objects
    const safeCustomer = {
      id:
        typeof customerId === 'string' ? customerId : String(customerId || ''),
      name:
        typeof customerName === 'string'
          ? customerName
          : String(customerName || ''),
      phone:
        typeof customerPhone === 'string'
          ? customerPhone
          : String(customerPhone || ''),
    };

    return {
      id: order.id,
      order_no: order.order_no,
      customer: safeCustomer,
      status: order.status as any,
      preparation_status: order.preparation_status as any,
      priority: order.priority as any,
      is_retail: (order as { is_retail?: boolean }).is_retail ?? false,
      total_items: order.total_items ?? 0,
      total_pieces: pieceCountMap.get(order.id) ?? null,
      total: Number(order.total_amount ?? 0),
      received_at: order.received_at ?? null,
      ready_by: order.ready_by,
      branch_name: order.org_branches_mst?.branch_name ?? undefined,
      order_source_code: order.order_source_code ?? undefined,
      physical_intake_status: order.physical_intake_status ?? null,
      physical_intake_at: order.physical_intake_at ?? null,
      order_source: order.sys_order_sources_cd
        ? {
            order_source_code: order.sys_order_sources_cd.order_source_code,
            name: order.sys_order_sources_cd.name,
            name2: order.sys_order_sources_cd.name2,
            requires_remote_intake_confirm:
              order.sys_order_sources_cd.requires_remote_intake_confirm,
          }
        : null,
    };
  });

  return {
    orders: orderList,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ==================================================================
// UPDATE OPERATIONS
// ==================================================================

/**
 * Update order status
 */
export async function updateOrderStatus(
  tenantOrgId: string,
  orderId: string,
  status: string,
  notes?: string,
  userId?: string,
): Promise<Order> {
  const updatedOrder = await prisma.org_orders_mst.update({
    where: {
      id: orderId,
      tenant_org_id: tenantOrgId,
    },
    data: {
      status,
      internal_notes: notes,
      updated_at: new Date(),
      ...(userId && { updated_by: userId }),
    },
  });

  return updatedOrder as unknown as Order;
}

// ==================================================================
// STATISTICS
// ==================================================================

/**
 * Get order statistics for dashboard
 */
export async function getOrderStats(tenantOrgId: string) {
  // Validate tenantOrgId is a valid UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantOrgId)) {
    throw new Error(
      `Invalid tenant ID format: ${tenantOrgId}. Expected UUID format.`,
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    total,
    pendingPreparation,
    inPreparation,
    processing,
    ready,
    outForDelivery,
    deliveredToday,
    overdue,
  ] = await Promise.all([
    prisma.org_orders_mst.count({ where: { tenant_org_id: tenantOrgId } }),
    prisma.org_orders_mst.count({
      where: { tenant_org_id: tenantOrgId, preparation_status: 'pending' },
    }),
    prisma.org_orders_mst.count({
      where: { tenant_org_id: tenantOrgId, preparation_status: 'in_progress' },
    }),
    prisma.org_orders_mst.count({
      where: { tenant_org_id: tenantOrgId, status: 'processing' },
    }),
    prisma.org_orders_mst.count({
      where: { tenant_org_id: tenantOrgId, status: 'ready' },
    }),
    prisma.org_orders_mst.count({
      where: { tenant_org_id: tenantOrgId, status: 'out_for_delivery' },
    }),
    prisma.org_orders_mst.count({
      where: {
        tenant_org_id: tenantOrgId,
        status: 'delivered',
        delivered_at: { gte: today },
      },
    }),
    prisma.org_orders_mst.count({
      where: {
        tenant_org_id: tenantOrgId,
        ready_by: { lt: new Date() },
        status: { notIn: ['delivered', 'closed', 'cancelled'] },
      },
    }),
  ]);

  return {
    total,
    pending_preparation: pendingPreparation,
    in_preparation: inPreparation,
    processing,
    ready,
    out_for_delivery: outForDelivery,
    delivered_today: deliveredToday,
    overdue,
  };
}
