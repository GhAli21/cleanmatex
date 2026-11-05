import 'server-only';

import { ORDER_FINANCIAL_SNAPSHOT_STATUS as SNAP } from '@/lib/constants/order-financial';
import { ORDER_FIN_PUBLIC_HEADER_METRICS, ORDER_FIN_PUBLIC_SECTION_KEYS } from '@/lib/constants/order-fin-view';
import { round4 } from '@/lib/services/order-financial-aggregation';
import type {
  OrderFinHeaderPayload,
  OrderFinLine,
  OrderFinSectionPayload,
  OrderFinancialView,
} from '@/lib/types/order-fin-view';

/*
 * Public projection (PLAN §6.2, D7, D11): the only way order money leaves the
 * server to a customer (tracking token, customer portal). An allowlist: a
 * field is copied only when named here, so a new view field stays private
 * until someone adds it on purpose. The browser preset is never the boundary.
 */

// Figures go out only from a snapshot the engine stands behind; otherwise "unavailable", never provisional numbers.
const PUBLIC_SNAPSHOT_STATUSES: readonly string[] = [SNAP.CURRENT, SNAP.LOCKED];

function publicLine(l: OrderFinLine): OrderFinLine {
  return {
    id: l.id,
    ...(l.labelKey ? { labelKey: l.labelKey } : {}),
    ...(l.label ? { label: { name: l.label.name, name2: l.label.name2 } } : {}),
    unit: l.unit,
    amount: l.amount,
    sign: l.sign,
    role: l.role,
    state: l.state,
    countsInTotal: l.countsInTotal,
  };
}

/** Counted payment lines summed per method (D11): "Cash 5.000, Card 3.000", no references, no pending rows. */
function tenderTotals(lines: OrderFinLine[]): OrderFinLine[] {
  const byMethod = new Map<string, OrderFinLine>();
  for (const l of lines) {
    if (!l.countsInTotal) continue;
    const method = l.meta?.methodCode ?? '';
    const prev = byMethod.get(method);
    byMethod.set(method, {
      id: `payments:${method || 'other'}`,
      unit: 'money',
      amount: round4((prev?.amount ?? 0) + (l.amount ?? 0)),
      sign: l.sign,
      role: 'additive',
      state: 'normal',
      countsInTotal: true,
      ...(method ? { meta: { methodCode: method } } : {}),
    });
  }
  return [...byMethod.values()];
}

function publicSection(s: OrderFinSectionPayload): OrderFinSectionPayload {
  return {
    key: s.key,
    status: s.status,
    totals: s.totals.map(publicLine),
    ...(s.key === 'payments' && s.lines ? { lines: tenderTotals(s.lines) } : {}),
  };
}

function publicHeader(h: OrderFinHeaderPayload): OrderFinHeaderPayload {
  const metrics: OrderFinHeaderPayload['metrics'] = {};
  for (const m of ORDER_FIN_PUBLIC_HEADER_METRICS) if (m in h.metrics) metrics[m] = h.metrics[m];
  return { metrics, balanceState: h.balanceState, paymentStatus: h.paymentStatus, settlementType: null };
}

/**
 * Strip a saved-order view down to what a customer may see. Pure; apply it
 * at every public entry point whatever config the caller asked for.
 *
 * @param view - a view from `getOrderFinancialView` (ideally resolved with the `public` preset)
 * @returns the same contract with only allowlisted fields; validate with `orderFinancialPublicViewSchema`
 * @example projectOrderFinancialViewForPublic(await getOrderFinancialView(tenantId, orderId, resolveOrderFinDisplayConfig({ preset: 'public' })))
 */
export function projectOrderFinancialViewForPublic(view: OrderFinancialView): OrderFinancialView {
  const healthy = view.snapshotStatus != null && PUBLIC_SNAPSHOT_STATUSES.includes(view.snapshotStatus);
  const sections: OrderFinancialView['sections'] = {};
  if (healthy) {
    for (const key of ORDER_FIN_PUBLIC_SECTION_KEYS) {
      const s = view.sections[key];
      if (s) sections[key] = publicSection(s);
    }
  }
  return {
    schemaVersion: view.schemaVersion,
    orderId: null,
    orderNo: view.orderNo,
    orderStatus: null,
    currency: { code: view.currency.code, decimalPlaces: view.currency.decimalPlaces },
    currencyKnown: view.currencyKnown,
    snapshotStatus: null,
    sourceKind: 'saved',
    generatedAt: view.generatedAt,
    header: healthy
      ? publicHeader(view.header)
      : { metrics: {}, balanceState: null, paymentStatus: null, settlementType: null },
    sections,
    warnings: [],
  };
}
