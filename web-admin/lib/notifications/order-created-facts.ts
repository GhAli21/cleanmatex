import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';

/** What the order-created message shows besides the order number and ready time. */
export interface OrderCreatedFacts {
  customerName?: string;
  /** "2 × Shirt, 1 × Dishdasha" in the customer's language. */
  orderItems?: string;
  /** Public tracking token: the WhatsApp "Track your order" link ends with it. */
  trackCode?: string;
  /** Customer's language (en / ar), for names and dates. */
  locale?: string;
}

const MAX_ITEMS = 10;

/**
 * Reads the customer's name and language, the item list and the tracking token of a new order.
 * Never throws: a missing fact only leaves its template variable out (the message is optional,
 * the order is already committed).
 * @param tenantId Order's tenant.
 * @param orderId The new order.
 */
export async function loadOrderCreatedFacts(tenantId: string, orderId: string): Promise<OrderCreatedFacts> {
  try {
    const order = await prisma.org_orders_mst.findFirst({
      where: { id: orderId, tenant_org_id: tenantId },
      select: { customer_id: true, public_tracking_token: true },
    });
    if (!order) return {};

    const [customer, items] = await Promise.all([
      prisma.org_customers_mst.findFirst({
        where: { id: order.customer_id, tenant_org_id: tenantId },
        select: { display_name: true, name: true, name2: true, preferred_language: true },
      }),
      prisma.org_order_items_dtl.findMany({
        where: { order_id: orderId, tenant_org_id: tenantId },
        select: { product_name: true, product_name2: true, quantity: true },
        orderBy: { created_at: 'asc' },
        take: MAX_ITEMS + 1,
      }),
    ]);

    const arabic = customer?.preferred_language === 'ar';
    // WhatsApp template values may not contain line breaks, so the list is one line.
    const lines = items.slice(0, MAX_ITEMS).map((item) => {
      const name = (arabic && item.product_name2) || item.product_name || item.product_name2 || '';
      return `${item.quantity ?? 1} × ${name}`.trim();
    });
    if (items.length > MAX_ITEMS) lines.push('…');

    return {
      customerName: (arabic && customer?.name2) || customer?.display_name || customer?.name || undefined,
      orderItems: lines.length > 0 ? lines.join(', ') : undefined,
      trackCode: order.public_tracking_token?.trim() || undefined,
      locale: customer?.preferred_language ?? undefined,
    };
  } catch (error) {
    logger.warn('loadOrderCreatedFacts failed; the message goes without customer, items and tracking values', {
      feature: 'notifications', tenantId, orderId, error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}
