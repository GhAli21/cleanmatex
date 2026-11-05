/**
 * `assembleOrderFinancialView` (DESIGN §1 step 4): header, sections and view
 * envelope from a normalized source set. Pure, runs on client and server.
 * A snapshot that was never written yields no figures at all (PR-09):
 * "Financial data unavailable", never zeros.
 */
import { MONEY_COMPARISON_TOLERANCE } from '@/lib/constants/financial-tolerances';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';
import { ORDER_FIN_VIEW_SCHEMA_VERSION } from '@/lib/constants/order-fin-view';
import type {
  FinancialWarning,
  OrderFinBalanceState,
  OrderFinHeaderPayload,
  OrderFinHeaderView,
  OrderFinSectionKey,
  OrderFinSectionPayload,
  OrderFinSnapshotInput,
  OrderFinSourceSet,
  OrderFinancialView,
  ResolvedOrderFinDisplayConfig,
} from '@/lib/types/order-fin-view';
import { buildListSection } from './build-sections';
import { buildSpecialSection } from './build-special-sections';
import { buildOrderFinWarnings } from './build-warnings';

/** The word the balance carries (D31). */
export function balanceStateFor(s: OrderFinSnapshotInput): OrderFinBalanceState {
  if (s.overpaid > MONEY_COMPARISON_TOLERANCE) return 'overpaid';
  if (s.outstanding <= MONEY_COMPARISON_TOLERANCE) return 'settled';
  if (s.settlementType === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION) return 'dueAtCollection';
  if (s.settlementType === SETTLEMENT_TYPE_CODES.CREDIT_INVOICE) return 'dueOnInvoice';
  return 'due';
}

function buildHeader(s: OrderFinSnapshotInput | null, edit?: OrderFinSourceSet['edit']): OrderFinHeaderPayload {
  if (!s) return { metrics: {}, balanceState: null, paymentStatus: null, settlementType: null };
  return {
    metrics: {
      total: s.total,
      paid: s.paid,
      credits: s.credits,
      balance: s.outstanding,
      refunded: s.refunded,
      netCollected: s.netCollected,
      overpaid: s.overpaid,
      changeReturned: s.changeReturned,
      receivable: s.receivable,
      discount: s.discount,
      tax: s.tax,
      ...(edit ? {
        originalTotal: edit.originalTotal,
        projectedTotal: edit.projectedTotal,
        totalDelta: edit.totalDelta,
        projectedBalance: s.outstanding,
      } : {}),
    },
    balanceState: balanceStateFor(s),
    paymentStatus: s.paymentStatus,
    settlementType: s.settlementType,
    ...(edit ? { editOutcome: edit.outcome } : {}),
    baseCurrency: s.baseCurrency,
  };
}

/** Envelope and header from the snapshot alone (plus the edit quote's was → now); shared by the full view and the batch header reader. */
export function buildOrderFinHeaderView(s: OrderFinSnapshotInput | null, edit?: OrderFinSourceSet['edit']): OrderFinHeaderView {
  return {
    orderId: s?.orderId ?? null,
    orderNo: s?.orderNo ?? null,
    orderStatus: s?.orderStatus ?? null,
    currency: { code: s?.currencyCode ?? null, decimalPlaces: s?.currencyDecimals ?? null },
    currencyKnown: Boolean(s?.currencyCode) && s?.currencyDecimals != null,
    snapshotStatus: s?.snapshotStatus ?? null,
    header: buildHeader(s, edit),
  };
}

/**
 * @param set - normalized sources (saved, draft or edit)
 * @param resolved - output of `resolveOrderFinDisplayConfig`
 * @param generatedAt - ISO time, passed in so the function stays pure
 */
export function assembleOrderFinancialView(
  set: OrderFinSourceSet,
  resolved: ResolvedOrderFinDisplayConfig,
  generatedAt: string,
): OrderFinancialView {
  const s = set.snapshot;
  const sections: Partial<Record<OrderFinSectionKey, OrderFinSectionPayload>> = {};
  let warnings: FinancialWarning[] = [];
  if (s) {
    const withSnapshot = { ...set, snapshot: s };
    const placed = buildOrderFinWarnings(withSnapshot);
    warnings = placed.map((p) => p.warning);
    for (const key of resolved.sectionOrder) {
      const mode = resolved.sections[key];
      if (mode === 'hidden') continue;
      const section = buildListSection(key, mode, withSnapshot) ?? buildSpecialSection(key, mode, withSnapshot, warnings);
      if (!section) continue;
      const codes = placed.filter((p) => p.section === key).map((p) => p.warning.code);
      sections[key] = codes.length ? { ...section, warningCodes: [...(section.warningCodes ?? []), ...codes] } : section;
    }
  }

  const { header, ...envelope } = buildOrderFinHeaderView(s, set.edit);
  return {
    schemaVersion: ORDER_FIN_VIEW_SCHEMA_VERSION,
    ...envelope,
    sourceKind: set.sourceKind,
    generatedAt,
    header,
    sections,
    warnings,
  };
}
