import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { NotFoundError } from '@/lib/errors/base-errors';
import type { OrderFinSourceSet, OrderFinancialView, ResolvedOrderFinDisplayConfig } from '@/lib/types/order-fin-view';
import { assembleOrderFinancialView } from '@features/orders/order-fin-view/vwbuilders/assemble';
import { normalizeOrderFinSources } from './normalize';
import { loadOrderCore } from './sources/core.source';
import { loadOrderFinSources } from './sources/registry';

/**
 * The saved order's normalized source set: the core snapshot first, then only
 * the requested sources, in parallel. Shared by the saved view and the Edit
 * quote view so both read the order the same way.
 * @param tenantId - authenticated tenant, from the session only
 * @param orderId - order header id
 * @param sources - the resolver's `requiredSources`
 * @throws NotFoundError when the order is not in this tenant
 */
export async function loadSavedOrderFinSourceSet(
  tenantId: string,
  orderId: string,
  sources: ResolvedOrderFinDisplayConfig['requiredSources'],
): Promise<OrderFinSourceSet> {
  const core = await loadOrderCore(tenantId, orderId);
  if (!core) throw new NotFoundError('Order', orderId);

  const [{ data, errors }, currency] = await Promise.all([
    loadOrderFinSources(tenantId, orderId, sources),
    // sys_currency_cd is a global catalog (no tenant column).
    core.currency_code
      ? prisma.sys_currency_cd.findUnique({ where: { code: core.currency_code }, select: { minor_unit: true } })
      : Promise.resolve(null),
  ]);
  return normalizeOrderFinSources(core, data, errors, currency?.minor_unit ?? null);
}

/**
 * The Order Financial View for one saved order (PLAN P3-03). Loads the core
 * snapshot first, then only the sources the resolved config needs, in
 * parallel. No permission logic (D10): the caller decides first.
 *
 * @param tenantId - authenticated tenant, from the session only
 * @param orderId - order header id
 * @param resolved - output of `resolveOrderFinDisplayConfig(config, 'saved')`
 * @returns the view; a failed non-core source marks only its own section `error`
 * @throws NotFoundError when the order is not in this tenant
 * @example await getOrderFinancialView(tenantId, orderId, resolveOrderFinDisplayConfig({ preset: 'detailed' }))
 */
export async function getOrderFinancialView(
  tenantId: string,
  orderId: string,
  resolved: ResolvedOrderFinDisplayConfig,
): Promise<OrderFinancialView> {
  const set = await loadSavedOrderFinSourceSet(tenantId, orderId, resolved.requiredSources);
  const view = assembleOrderFinancialView(set, resolved, new Date().toISOString());
  const differs = view.warnings.filter((w) => w.severity !== 'info').map((w) => w.code);
  // "Figures differ" counter (PR-13): which checks failed, ids only.
  if (differs.length) logger.warn('Order fin view figures differ', { feature: 'order_fin_view', action: 'figures_differ', tenantId, orderId, codes: differs });
  return view;
}
