/**
 * Order Data Access Layer
 *
 * Database operations for orders using Prisma.
 * All queries automatically filter by tenant_org_id via Prisma middleware.
 */

import { prisma } from '@/lib/db/prisma';
import type {
  Order,
  OrderItem,
  OrderWithDetails,
  OrderListItem,
  OrderListResponse,
  OrderFilters,
  CreateOrderInput,
  AddOrderItemsInput,
  CompletePreparationInput,
} from '@/types/order';
import { generateOrderNumber } from '@/lib/utils/order-number-generator';
import { generateQRCode, generateBarcode } from '@/lib/utils/barcode-generator';
import { calculateReadyBy, DEFAULT_BUSINESS_HOURS } from '@/lib/utils/ready-by-calculator';
import { calculateItemPrice, calculateOrderTotal } from '@/lib/utils/pricing-calculator';
import { OrderPieceService } from '@/lib/services/order-piece-service';
import { TenantSettingsService } from '@/lib/services/tenant-settings.service';

// ==================================================================
// CREATE OPERATIONS
// ==================================================================

/**
 * Create a new Quick Drop order
 */
export async function createOrder(
  tenantOrgId: string,
  input: CreateOrderInput
): Promise<Order> {
  // Generate unique order number
  const orderNumber = await generateOrderNumber(tenantOrgId);

  // Generate QR code and barcode
  const qrCode = await generateQRCode({
    orderNumber,
    tenantOrgId,
    customerId: input.customerId,
  });

  const barcode = await generateBarcode(orderNumber);

  // Get priority multiplier
  const priorityMultiplier = {
    normal: 1.0,
    urgent: 0.7,
    express: 0.5,
  }[input.priority];

  // Create order
  const order = await prisma.org_orders_mst.create({
    data: {
      tenant_org_id: tenantOrgId,
      customer_id: input.customerId,
      branch_id: input.branchId,
      order_no: orderNumber,
      order_type_id: input.orderType,
      service_category_code: input.serviceCategory,
      bag_count: input.bagCount,
      priority: input.priority,
      priority_multiplier: priorityMultiplier,
      preparation_status: 'pending',
      status: 'intake',
      customer_notes: input.customerNotes,
      internal_notes: input.internalNotes,
      photo_urls: input.photoUrls || [],
      qr_code: qrCode,
      barcode: barcode,
      received_at: new Date(),
      total_items: 0,
      subtotal: 0,
      discount: 0,
      tax: 0,
      total: 0,
      payment_status: 'pending',
    },
  });

  return order as unknown as Order;
}

/**
 * Add items to an order
 */
export async function addOrderItems(
  tenantOrgId: string,
  orderId: string,
  input: AddOrderItemsInput
): Promise<{ items: OrderItem[]; order: Order }> {
  // Get products for pricing
  const productIds = input.items.map((item) => item.productId);
  const products = await prisma.org_product_data_mst.findMany({
    where: {
      tenant_org_id: tenantOrgId,
      id: { in: productIds },
    },
  });

  // Fetch order to build item barcode value with order_no
  const orderForBarcode = await prisma.org_orders_mst.findUnique({
    where: { id: orderId, tenant_org_id: tenantOrgId },
    select: { order_no: true },
  });

  // Create product map for easy lookup
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Calculate pricing for each item
  const itemsWithPricing = input.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    const basePrice = Number(product.default_sell_price || 0);
    // Prefer explicit express price if provided; otherwise fall back to multiplier
    const explicitExpressPrice = Number(product.default_express_sell_price || 0);
    const expressMultiplier = Number(product.multiplier_express || 1.5);
    const isExpress = Boolean(input.isExpressService);
    const effectiveBase = isExpress && explicitExpressPrice > 0 ? explicitExpressPrice : basePrice;
    const taxRate = 0.05; // TODO: fetch from tenant settings per tenant_org_id

    const pricing = calculateItemPrice({
      basePrice: effectiveBase,
      quantity: item.quantity,
      isExpress,
      expressMultiplier,
      taxRate,
    });

    return {
      ...item,
      product,
      pricing,
    };
  });

  // Create items in database
  const createdItems = await prisma.$transaction(async (tx) => {
    const items = [];
    for (const item of itemsWithPricing) {
      // Create first to get generated order_item_srno via trigger; then update barcode
      const created = await tx.org_order_items_dtl.create({
        data: {
          order_id: orderId,
          tenant_org_id: tenantOrgId,
          product_id: item.productId,
          product_name: item.product.product_name,
          product_name2: item.product.product_name2,
          service_category_code: item.serviceCategoryCode,
          quantity: item.quantity,
          price_per_unit: item.pricing.unitPrice,
          total_price: item.pricing.total,
          color: item.color,
          brand: item.brand,
          has_stain: item.hasStain,
          stain_notes: item.stainNotes,
          has_damage: item.hasDamage,
          damage_notes: item.damageNotes,
          notes: item.notes,
          status: 'pending',
        },
      });

      // Compute an item code for barcode (ORD + SRNO)
      const srno = (created as any).order_item_srno as string | null;
      const orderNo = orderForBarcode?.order_no || '';
      const barcodeValue = srno ? `${orderNo}-${srno}` : orderNo;
      const itemBarcode = await generateBarcode(barcodeValue);

      const updated = await tx.org_order_items_dtl.update({
        where: { id: (created as any).id, tenant_org_id: tenantOrgId } as any,
        data: { barcode: itemBarcode },
      });
      items.push(updated);
    }
    return items;
  });

  // Check if USE_TRACK_BY_PIECE is enabled and auto-create pieces
  const tenantSettingsService = new TenantSettingsService();
  const trackByPiece = await tenantSettingsService.checkIfSettingAllowed(
    tenantOrgId,
    'USE_TRACK_BY_PIECE'
  );

  if (trackByPiece && createdItems.length > 0) {
    // Create pieces for each item
    const piecesErrors: Array<{ itemId: string; error: string }> = [];
    
    for (let i = 0; i < createdItems.length; i++) {
      const createdItem = createdItems[i];
      const itemData = itemsWithPricing[i];

      if (createdItem && itemData.quantity > 0) {
        const piecesResult = await OrderPieceService.createPiecesForItem(
          tenantOrgId,
          orderId,
          (createdItem as any).id,
          itemData.quantity,
          {
            serviceCategoryCode: itemData.serviceCategoryCode,
            productId: itemData.productId,
            pricePerUnit: itemData.pricing.unitPrice,
            totalPrice: itemData.pricing.total,
            color: itemData.color,
            brand: itemData.brand,
            hasStain: itemData.hasStain,
            hasDamage: itemData.hasDamage,
            notes: itemData.notes,
            metadata: {},
          }
        );

        // If pieces creation failed, collect the error
        if (!piecesResult.success) {
          piecesErrors.push({
            itemId: (createdItem as any).id,
            error: piecesResult.error || 'Failed to create pieces',
          });
        }
      }
    }

    // If any pieces creation failed, throw error to prevent partial state
    if (piecesErrors.length > 0) {
      // Delete the items that were just created since pieces failed
      const itemIds = createdItems.map(item => (item as any).id);
      await prisma.org_order_items_dtl.deleteMany({
        where: {
          id: { in: itemIds },
          tenant_org_id: tenantOrgId,
        } as any,
      });

      throw new Error(
        `Failed to create pieces for order items: ${piecesErrors.map(e => e.error).join('; ')}`
      );
    }
  }

  // Calculate order totals
  const allItems = itemsWithPricing.map((item) => item.pricing);
  const orderTotals = calculateOrderTotal({ items: allItems });

  // Update order with totals and item count
  const updatedOrder = await prisma.org_orders_mst.update({
    where: {
      id: orderId,
      tenant_org_id: tenantOrgId,
    },
    data: {
      total_items: { increment: input.items.reduce((sum, item) => sum + item.quantity, 0) },
      subtotal: orderTotals.subtotalAfterDiscount,
      tax: orderTotals.tax,
      total: orderTotals.total,
    },
  });

  return {
    items: createdItems as unknown as OrderItem[],
    order: updatedOrder as unknown as Order,
  };
}

/**
 * Complete order preparation
 */
export async function completePreparation(
  tenantOrgId: string,
  orderId: string,
  userId: string,
  input: CompletePreparationInput
): Promise<Order> {
  // Get order with service category info
  const order = await prisma.org_orders_mst.findUnique({
    where: {
      id: orderId,
      tenant_org_id: tenantOrgId,
    },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  // Calculate Ready-By date if not overridden
  let readyBy = input.readyByOverride;

  if (!readyBy) {
    // Get service category turnaround time
    const serviceCategory = await prisma.sys_service_category_cd.findUnique({
      where: { service_category_code: order.service_category_code || '' },
    });

    const turnaroundHours = Number(serviceCategory?.turnaround_hh || 48);

    // Use current date if received_at is null (shouldn't happen but handle gracefully)
    const receivedAt = order.received_at || new Date();

    const readyByCalc = calculateReadyBy({
      receivedAt,
      turnaroundHours,
      priority: order.priority as 'normal' | 'urgent' | 'express',
      businessHours: DEFAULT_BUSINESS_HOURS,
    });

    readyBy = readyByCalc.readyBy;
  }

  // Update order
  const updatedOrder = await prisma.org_orders_mst.update({
    where: {
      id: orderId,
      tenant_org_id: tenantOrgId,
    },
    data: {
      preparation_status: 'completed',
      prepared_at: new Date(),
      prepared_by: userId,
      ready_by: readyBy,
      ready_by_override: input.readyByOverride || null,
      status: 'processing',
      internal_notes: input.internalNotes || order.internal_notes,
    },
  });

  return updatedOrder as unknown as Order;
}

// ==================================================================
// READ OPERATIONS
// ==================================================================

/**
 * Get order by ID with full details
 */
export async function getOrderById(
  tenantOrgId: string,
  orderId: string
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
        orderBy: { created_at: 'asc' },
      },
      org_branches_mst: {
        select: {
          id: true,
          branch_name: true,
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  // Get customer data from org_customers_mst, fallback to sys_customers_mst if available
  const customerData = order.org_customers_mst?.sys_customers_mst || order.org_customers_mst;

  return {
    ...order,
    customer: customerData,
    items: order.org_order_items_dtl,
    branch: order.org_branches_mst,
  } as unknown as OrderWithDetails;
}

/**
 * List orders with filters and pagination
 */
export async function listOrders(
  tenantOrgId: string,
  filters: OrderFilters
): Promise<OrderListResponse> {
  // Validate tenantOrgId is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantOrgId)) {
    throw new Error(`Invalid tenant ID format: ${tenantOrgId}. Expected UUID format.`);
  }
  const {
    status,
    preparationStatus,
    priority,
    customerId,
    branchId,
    fromDate,
    toDate,
    search,
    page = 1,
    limit = 20,
    sortBy = 'received_at',
    sortOrder = 'desc',
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

  if (search) {
    where.OR = [
      { order_no: { contains: search, mode: 'insensitive' } },
      {
        org_customers_mst: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { sys_customers_mst: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }},
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
      org_order_items_dtl: {
        select: {
          id: true,
        },
      },
    },
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Get piece counts for all orders in batch
  const orderIds = orders.map(o => o.id);
  const itemIds = orders.flatMap(o => o.org_order_items_dtl.map(item => item.id));
  
  const pieceCounts = itemIds.length > 0 ? await prisma.org_order_item_pieces_dtl.groupBy({
    by: ['order_id'],
    where: {
      order_id: { in: orderIds },
      tenant_org_id: tenantOrgId,
    },
    _count: {
      id: true,
    },
  }) : [];

  const pieceCountMap = new Map(
    pieceCounts.map(pc => [pc.order_id, pc._count.id])
  );

  const orderList: OrderListItem[] = orders.map((order) => {
    // Get customer data from org_customers_mst, fallback to sys_customers_mst if available
    const customerData = order.org_customers_mst?.sys_customers_mst || order.org_customers_mst;
    
    // Ensure customer data is properly formatted (defensive check)
    const customerId = customerData?.id || order.org_customers_mst?.id || '';
    const customerName = customerData?.name || order.org_customers_mst?.name || '';
    const customerPhone = customerData?.phone || order.org_customers_mst?.phone || '';
    
    // Ensure all values are strings, not objects
    const safeCustomer = {
      id: typeof customerId === 'string' ? customerId : String(customerId || ''),
      name: typeof customerName === 'string' ? customerName : String(customerName || ''),
      phone: typeof customerPhone === 'string' ? customerPhone : String(customerPhone || ''),
    };
    
    return {
      id: order.id,
      order_no: order.order_no,
      customer: safeCustomer,
      status: order.status as any,
      preparation_status: order.preparation_status as any,
      priority: order.priority as any,
      total_items: order.total_items ?? 0,
      total_pieces: pieceCountMap.get(order.id) ?? null,
      total: Number(order.total),
      received_at: order.received_at || new Date(),
      ready_by: order.ready_by,
      branch_name: order.org_branches_mst?.branch_name ?? undefined,
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

/**
 * Get order for preparation (with product catalog)
 */
export async function getOrderForPreparation(
  tenantOrgId: string,
  orderId: string
) {
  // Get order with details
  const order = await getOrderById(tenantOrgId, orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  // Get product catalog for the service category
  const products = await prisma.org_product_data_mst.findMany({
    where: {
      tenant_org_id: tenantOrgId,
      service_category_code: order.service_category_code,
      is_active: true,
    },
    orderBy: { product_order: 'asc' },
  });

  return {
    order,
    productCatalog: products.map((p) => ({
      id: p.id,
      code: p.product_code,
      name: p.product_name || '',
      name2: p.product_name2 || '',
      price: Number(p.default_sell_price || 0),
      expressPrice: Number(p.default_express_sell_price || 0),
      serviceCategory: p.service_category_code || '',
      unit: p.product_unit || 'piece',
      isActive: p.is_active,
    })),
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
  notes?: string
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
    },
  });

  return updatedOrder as unknown as Order;
}

/**
 * Delete order item
 */
export async function deleteOrderItem(
  tenantOrgId: string,
  orderId: string,
  itemId: string
): Promise<void> {
  await prisma.org_order_items_dtl.delete({
    where: {
      id: itemId,
      order_id: orderId,
      tenant_org_id: tenantOrgId,
    },
  });

  // Recalculate order totals
  await recalculateOrderTotals(tenantOrgId, orderId);
}

/**
 * Recalculate order totals
 */
async function recalculateOrderTotals(
  tenantOrgId: string,
  orderId: string
): Promise<void> {
  const items = await prisma.org_order_items_dtl.findMany({
    where: {
      order_id: orderId,
      tenant_org_id: tenantOrgId,
    },
  });

  const subtotal = items.reduce((sum, item) => sum + Number(item.total_price), 0);
  const tax = subtotal * 0.05; // Should come from tenant settings
  const total = subtotal + tax;
  const totalItems = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);

  await prisma.org_orders_mst.update({
    where: {
      id: orderId,
      tenant_org_id: tenantOrgId,
    },
    data: {
      subtotal,
      tax,
      total,
      total_items: totalItems,
    },
  });
}

// ==================================================================
// STATISTICS
// ==================================================================

/**
 * Get order statistics for dashboard
 */
export async function getOrderStats(tenantOrgId: string) {
  // Validate tenantOrgId is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantOrgId)) {
    throw new Error(`Invalid tenant ID format: ${tenantOrgId}. Expected UUID format.`);
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
