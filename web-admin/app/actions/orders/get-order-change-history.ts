'use server';

import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/server-auth';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { listOrderChangeHistoryDetail } from '@/lib/services/order-change/order-change-history.service';
import type { OrderChangeHistoryPage } from '@/lib/services/order-change/order-change-history-view';
import { logger } from '@/lib/utils/logger';

export type OrderChangeHistoryErrorCode = 'FORBIDDEN' | 'INVALID_ORDER' | 'LOAD_FAILED';

export type OrderChangeHistoryActionResult =
  | { success: true; data: OrderChangeHistoryPage }
  | { success: false; error: OrderChangeHistoryErrorCode };

const orderIdSchema = z.string().uuid();
const cursorSchema = z.number().int().positive();

/**
 * Tenant-scoped Change history for the order details tab.
 * Financial snapshots are included, so either order read or the financial
 * breakdown permission is required. Replay secrets are not selected.
 */
export async function getOrderChangeHistoryAction(
  orderId: string,
  cursor?: number,
): Promise<OrderChangeHistoryActionResult> {
  if (!orderIdSchema.safeParse(orderId).success) return { success: false, error: 'INVALID_ORDER' };
  if (cursor !== undefined && !cursorSchema.safeParse(cursor).success) {
    return { success: false, error: 'LOAD_FAILED' };
  }

  try {
    const { tenantId } = await getAuthContext();
    const [canReadOrder, canViewFinancial] = await Promise.all([
      hasPermissionServer(ORDERS_PERMISSIONS.READ),
      hasPermissionServer(ORDERS_PERMISSIONS.VIEW_FINANCIAL_BREAKDOWN),
    ]);
    if (!canReadOrder && !canViewFinancial) return { success: false, error: 'FORBIDDEN' };

    const data = await listOrderChangeHistoryDetail({ tenantId, orderId, cursor });
    return { success: true, data };
  } catch (error) {
    logger.error('[getOrderChangeHistoryAction] failed', error instanceof Error ? error : undefined, {
      feature: 'order_change',
      action: 'history',
      orderId,
    });
    return { success: false, error: 'LOAD_FAILED' };
  }
}
