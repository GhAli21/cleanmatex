import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { ValidationError } from '@/lib/errors/base-errors';
import type { OrderFinHeaderView } from '@/lib/types/order-fin-view';
import { buildOrderFinHeaderView } from '@features/orders/order-fin-view/vwbuilders/assemble';
import { normalizeSnapshot } from './normalize';
import { ORDER_FIN_CORE_SELECT } from './sources/core.source';

import { ORDER_FIN_HEADERS_MAX } from '@/lib/constants/order-fin-view';

export { ORDER_FIN_HEADERS_MAX };

// The calculation JSON is large and no header reads it.
const { financial_calculation_snapshot: _json, ...HEADER_SELECT } = ORDER_FIN_CORE_SELECT;

/**
 * Financial headers for many saved orders at once (PLAN P3-04, BF-15): the
 * snapshot columns only, one query, no detail sources and no warnings. For
 * list and handover screens; the order detail page uses `getOrderFinancialView`.
 *
 * @param tenantId - authenticated tenant, from the session only
 * @param orderIds - order header ids; duplicates are ignored
 * @returns header per order id; ids not in this tenant are left out
 * @throws ValidationError when more than `ORDER_FIN_HEADERS_MAX` distinct ids are asked for
 * @example const headers = await getOrderFinancialHeaders(tenantId, ['8f1c…', '2a9e…']); headers['8f1c…']?.header.metrics.balance
 */
export async function getOrderFinancialHeaders(
  tenantId: string,
  orderIds: readonly string[],
): Promise<Record<string, OrderFinHeaderView>> {
  const ids = [...new Set(orderIds)];
  if (ids.length > ORDER_FIN_HEADERS_MAX) {
    throw new ValidationError(`At most ${ORDER_FIN_HEADERS_MAX} orders per call`, {
      orderIds: [`max ${ORDER_FIN_HEADERS_MAX}, got ${ids.length}`],
    });
  }
  if (ids.length === 0) return {};

  const rows = await withTenantContext(tenantId, () =>
    prisma.org_orders_mst.findMany({
      where: { tenant_org_id: tenantId, id: { in: ids } },
      // sys_currency_cd is a global catalog (no tenant column).
      select: { ...HEADER_SELECT, sys_currency_cd: { select: { minor_unit: true } } },
    }),
  );

  return Object.fromEntries(
    rows.map(({ sys_currency_cd, ...core }) => [
      core.id,
      buildOrderFinHeaderView(normalizeSnapshot(core, sys_currency_cd?.minor_unit ?? null)),
    ]),
  );
}
