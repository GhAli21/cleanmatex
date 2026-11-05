'use server';

import { z } from 'zod';

import { ACTION_GUARD_ERRORS, resolveActionTenant } from '@/lib/auth/server-action-guard';
import { ORDER_FIN_API_ERRORS } from '@/lib/constants/order-fin-view';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { NotFoundError } from '@/lib/errors/base-errors';
import { getOrderFinancialView } from '@/lib/services/order-fin-view/order-fin-view.service';
import type { OrderFinancialDisplayConfig, OrderFinancialView } from '@/lib/types/order-fin-view';
import { logger } from '@/lib/utils/logger';
import { orderFinViewConfigSchema } from '@/lib/validations/order-fin-view-schemas';
import { resolveOrderFinDisplayConfig } from '@features/orders/order-fin-view/config/resolve-display-config';

/**
 * The Order Financial View of one saved order, for server components and
 * client code that prefer an action to the route (PLAN P4-03).
 *
 * A `'use server'` export is a callable endpoint: tenant and permission come
 * only from the session (`orders:read`); the caller passes the order id and a
 * display request, never a tenant. Errors are the route's codes (PR-05); the
 * internal error is logged, never returned. Flat result type (web-admin
 * `strict: false` does not narrow unions).
 * @param orderId - order id within the session tenant
 * @param config - preset and section overrides (whitelisted)
 * @returns `{ success, data?, error? }` where `error` is an `ORDER_FIN_API_ERRORS` code
 * @example const r = await getOrderFinancialViewAction(orderId, { preset: 'detailed' }); if (r.success && r.data) render(r.data);
 */
export async function getOrderFinancialViewAction(
  orderId: string,
  config: Pick<OrderFinancialDisplayConfig, 'preset' | 'sections'> = {},
): Promise<{ success: boolean; data?: OrderFinancialView; error?: string }> {
  const guard = await resolveActionTenant({ action: 'orders.getOrderFinancialViewAction', permission: ORDERS_PERMISSIONS.READ });
  if (!guard.ok || !guard.tenantId) {
    return { success: false, error: guard.error === ACTION_GUARD_ERRORS.FORBIDDEN ? ORDER_FIN_API_ERRORS.PERMISSION_DENIED : ORDER_FIN_API_ERRORS.UNAUTHENTICATED };
  }
  const id = z.string().uuid().safeParse(orderId);
  const parsed = orderFinViewConfigSchema.safeParse(config);
  if (!id.success || !parsed.success) return { success: false, error: ORDER_FIN_API_ERRORS.VALIDATION_FAILED };

  try {
    const view = await getOrderFinancialView(guard.tenantId, id.data, resolveOrderFinDisplayConfig(parsed.data, 'saved'));
    return { success: true, data: view };
  } catch (error) {
    if (error instanceof NotFoundError) return { success: false, error: ORDER_FIN_API_ERRORS.ORDER_NOT_FOUND };
    logger.error('getOrderFinancialViewAction failed', error instanceof Error ? error : new Error('Unknown financial view error'), {
      feature: 'order_fin_view', action: 'getOrderFinancialViewAction', tenantId: guard.tenantId, orderId: id.data,
    });
    return { success: false, error: ORDER_FIN_API_ERRORS.INTERNAL_ERROR };
  }
}
