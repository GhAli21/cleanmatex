/**
 * Preset matrix (PLAN §6, §6.2). Each cell can be overridden per section by
 * the caller, except for the `public` preset and the draft source, whose
 * constraints the resolver enforces.
 */
import { ORDER_FIN_PUBLIC_HEADER_METRICS } from '@/lib/constants/order-fin-view';
import type {
  OrderFinHeaderConfig,
  OrderFinHeaderMetric,
  OrderFinPreset,
  OrderFinSectionKey,
  OrderFinSectionMode,
} from '@/lib/types/order-fin-view';

type Row = Record<Exclude<OrderFinPreset, 'public'>, OrderFinSectionMode>;
const row = (badge: OrderFinSectionMode, totals: OrderFinSectionMode, summary: OrderFinSectionMode,
  detailed: OrderFinSectionMode, full: OrderFinSectionMode, audit: OrderFinSectionMode): Row =>
  ({ badge, totals, summary, detailed, full, audit });

const VALUE_ROW = row('hidden', 'total', 'expandable', 'expanded', 'detail', 'detail');
const ADJUST_ROW = row('hidden', 'total', 'expandable', 'expandable', 'detail', 'detail');
const SETTLE_ROW = row('hidden', 'total', 'expandable', 'expanded', 'detail', 'detail');
// Summary shows these as `total`; their builders return `empty` when zero, so they stay hidden then.
const BALANCE_EXTRA_ROW = row('hidden', 'hidden', 'total', 'expandable', 'detail', 'detail');
const RECORDS_ROW = row('hidden', 'hidden', 'hidden', 'expandable', 'detail', 'detail');
const LATE_ROW = row('hidden', 'hidden', 'hidden', 'hidden', 'expandable', 'detail');
// Summary and detailed show reconciliation as a header badge only.
const RECON_ROW = row('hidden', 'hidden', 'hidden', 'hidden', 'expandable', 'detail');
// Cash rounding is one stored figure, never expanded; it is `empty` (so not shown) when zero.
const ROUNDING_ROW = row('hidden', 'total', 'total', 'total', 'total', 'total');
const DEBUG_ROW = row('hidden', 'hidden', 'hidden', 'hidden', 'hidden', 'expandable');

const MATRIX: Record<OrderFinSectionKey, Row> = {
  items: VALUE_ROW, charges: VALUE_ROW,
  discounts: ADJUST_ROW, taxes: ADJUST_ROW, rounding: ROUNDING_ROW,
  payments: SETTLE_ROW, credits: SETTLE_ROW, refunds: SETTLE_ROW,
  overpayment: BALANCE_EXTRA_ROW, receivable: BALANCE_EXTRA_ROW,
  taxDocuments: RECORDS_ROW, vouchers: RECORDS_ROW, loyalty: RECORDS_ROW,
  adjustments: RECORDS_ROW, orderChanges: RECORDS_ROW, currency: RECORDS_ROW,
  receipts: LATE_ROW, timeline: LATE_ROW,
  reconciliation: RECON_ROW, debug: DEBUG_ROW,
};

/** `public` (§6.2): fixed; the caller cannot widen it. */
const PUBLIC_SECTIONS: Partial<Record<OrderFinSectionKey, OrderFinSectionMode>> = {
  items: 'total', charges: 'total', discounts: 'total', taxes: 'total', rounding: 'total',
  credits: 'total', refunds: 'total', payments: 'expandable',
};

/** Section modes for a preset; unlisted sections are `hidden`. */
export function presetSectionModes(preset: OrderFinPreset): Record<OrderFinSectionKey, OrderFinSectionMode> {
  return Object.fromEntries(
    (Object.keys(MATRIX) as OrderFinSectionKey[]).map((key) => [
      key,
      preset === 'public' ? PUBLIC_SECTIONS[key] ?? 'hidden' : MATRIX[key][preset],
    ]),
  ) as Record<OrderFinSectionKey, OrderFinSectionMode>;
}

/** Header metrics a public viewer may see (§6.2 allowlist). */
export const PUBLIC_HEADER_METRICS: readonly OrderFinHeaderMetric[] = ORDER_FIN_PUBLIC_HEADER_METRICS;

/** Header defaults per preset: hero `balance` plus at most three (D31). */
export function presetHeader(preset: OrderFinPreset): Required<OrderFinHeaderConfig> {
  const metrics: OrderFinHeaderMetric[] =
    preset === 'badge' ? ['balance']
      : preset === 'totals' || preset === 'public' ? ['balance', 'total', 'paid']
        : ['balance', 'total', 'paid', 'credits'];
  const internal = preset !== 'public';
  return {
    visible: true,
    metrics,
    emphasize: 'balance',
    layout: preset === 'badge' ? 'badge' : preset === 'totals' ? 'compact' : 'inline',
    showPaymentStatus: preset !== 'badge',
    showSettlementType: internal && preset !== 'badge',
    showReconciliationBadge: internal && preset !== 'badge' && preset !== 'totals',
    showBaseCurrency: internal && (preset === 'full' || preset === 'audit'),
    hideZeroMetrics: false,
  };
}
