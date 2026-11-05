import 'server-only';

import type { OrderFinDataSource } from '@/lib/types/order-fin-view';
import { logger } from '@/lib/utils/logger';
import {
  loadOrderAdjustments,
  loadOrderCharges,
  loadOrderCredits,
  loadOrderDiscounts,
  loadOrderPayments,
  loadOrderRefunds,
  loadOrderTaxDocuments,
  loadOrderTaxes,
} from './settlement.sources';
import { loadOrderItems } from './items.source';
import { loadOrderOverpayment } from './overpayment.source';
import { loadOrderReceivable } from './receivable.source';
import { loadOrderVouchers } from './vouchers.source';
import { loadOrderLoyalty } from './loyalty.source';
import { loadOrderChanges } from './order-changes.source';
import { loadOrderReceipts } from './receipts.source';

/**
 * Non-core sources, one line each (DESIGN §1 step 2). Every loader filters
 * by tenant_org_id itself. `core` is loaded separately, first.
 */
export const ORDER_FIN_SOURCE_LOADERS = {
  items: loadOrderItems,
  charges: loadOrderCharges,
  discounts: loadOrderDiscounts,
  taxes: loadOrderTaxes,
  payments: loadOrderPayments,
  credits: loadOrderCredits,
  refunds: loadOrderRefunds,
  taxDocuments: loadOrderTaxDocuments,
  adjustments: loadOrderAdjustments,
  overpayment: loadOrderOverpayment,
  receivable: loadOrderReceivable,
  vouchers: loadOrderVouchers,
  loyalty: loadOrderLoyalty,
  orderChanges: loadOrderChanges,
  receipts: loadOrderReceipts,
} satisfies Record<Exclude<OrderFinDataSource, 'core'>, (tenantId: string, orderId: string) => Promise<unknown>>;

export type OrderFinLoadableSource = keyof typeof ORDER_FIN_SOURCE_LOADERS;

/** Rows per loaded source. */
export type OrderFinSourceData = {
  [K in OrderFinLoadableSource]?: Awaited<ReturnType<(typeof ORDER_FIN_SOURCE_LOADERS)[K]>>;
};

/** Error code for a source that failed; only its own section shows an error. */
export const ORDER_FIN_SOURCE_LOAD_FAILED = 'SOURCE_LOAD_FAILED';

/**
 * Loads the requested sources in parallel; a failure is isolated to its key.
 * `core` is skipped here (the service loads it first).
 * @param tenantId - authenticated tenant
 * @param orderId - order already confirmed to exist in this tenant
 * @param keys - the resolver's `requiredSources`
 */
export async function loadOrderFinSources(
  tenantId: string,
  orderId: string,
  keys: readonly OrderFinDataSource[],
): Promise<{ data: OrderFinSourceData; errors: Partial<Record<OrderFinDataSource, string>> }> {
  const loadable = keys.filter((k): k is OrderFinLoadableSource => k in ORDER_FIN_SOURCE_LOADERS);
  const startedAt = Date.now();
  const timings: Partial<Record<OrderFinDataSource, number>> = {};
  // Per-source timing (PR-13): each loader is timed on its own; they still run in parallel.
  const settled = await Promise.allSettled(loadable.map(async (k) => {
    const t0 = Date.now();
    try {
      return await ORDER_FIN_SOURCE_LOADERS[k](tenantId, orderId);
    } finally {
      timings[k] = Date.now() - t0;
    }
  }));

  const data: Record<string, unknown> = {};
  const errors: Partial<Record<OrderFinDataSource, string>> = {};
  settled.forEach((result, i) => {
    const key = loadable[i];
    if (result.status === 'fulfilled') {
      data[key] = result.value;
    } else {
      errors[key] = ORDER_FIN_SOURCE_LOAD_FAILED;
      logger.error('Order fin view source failed', result.reason as Error, { tenantId, orderId, source: key });
    }
  });
  // Ids and timings only, no customer data (PR-13).
  logger.debug('Order fin view sources loaded', {
    feature: 'order_fin_view', action: 'load_sources', tenantId, orderId,
    totalMs: Date.now() - startedAt, timings, failed: Object.keys(errors),
  });
  return { data: data as OrderFinSourceData, errors };
}
