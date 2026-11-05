import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { ORDER_FIN_PUBLIC_MAX_BYTES } from '@/lib/constants/order-fin-view';
import { NotFoundError } from '@/lib/errors/base-errors';
import type { OrderFinancialView } from '@/lib/types/order-fin-view';
import { resolveOrderFinDisplayConfig } from '@features/orders/order-fin-view/config/resolve-display-config';
import { getOrderFinancialView } from './order-fin-view.service';
import { projectOrderFinancialViewForPublic } from './projections/public.projection';

/** Thrown when a projected public view is larger than the cap (PR-06); the route answers 404, never a cut-off view. */
export class PublicViewTooLargeError extends Error {}

/**
 * The customer-safe view of one order (PLAN §6.2, P4-06/P4-07). Always the
 * `public` preset and always the server projection, whatever the caller wants:
 * public routes take no display options at all.
 * @param tenantId - resolved from the tracking token or the verified customer session, never from input
 * @param orderId - order id already resolved for that tenant
 * @returns the projected view
 * @throws NotFoundError when the order is not in this tenant; PublicViewTooLargeError over the size cap
 * @example const view = await getPublicOrderFinancialView(reference.tenantId, reference.orderId);
 */
export async function getPublicOrderFinancialView(tenantId: string, orderId: string): Promise<OrderFinancialView> {
  const view = await getOrderFinancialView(tenantId, orderId, resolveOrderFinDisplayConfig({ preset: 'public' }, 'saved'));
  const projected = projectOrderFinancialViewForPublic(view);
  if (Buffer.byteLength(JSON.stringify(projected)) > ORDER_FIN_PUBLIC_MAX_BYTES) throw new PublicViewTooLargeError();
  return projected;
}

/**
 * The id of an order owned by the signed-in customer (D13, PR-06): it must
 * match the session tenant **and** the session customer.
 * @param tenantId - the verified session's tenant
 * @param customerId - the verified session's customer
 * @param orderNo - order number from the URL
 * @returns the order id
 * @throws NotFoundError for a missing order or one that belongs to someone else (same answer)
 */
export async function resolveCustomerOwnedOrderId(tenantId: string, customerId: string, orderNo: string): Promise<string> {
  const order = await prisma.org_orders_mst.findFirst({
    where: { tenant_org_id: tenantId, customer_id: customerId, order_no: orderNo },
    select: { id: true },
  });
  if (!order) throw new NotFoundError('Order', orderNo);
  return order.id;
}
