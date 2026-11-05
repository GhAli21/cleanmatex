/**
 * Sections not backed by one fact source: rounding, currency, reconciliation,
 * debug and the timeline (PLAN §5). Pure; every amount except rounding is informational.
 */
import type {
  FinancialWarning,
  OrderFinLine,
  OrderFinSectionKey,
  OrderFinSectionMode,
  OrderFinSectionPayload,
  OrderFinSnapshotInput,
  OrderFinSourceSet,
} from '@/lib/types/order-fin-view';
import { TIMELINE_EVENT_SOURCES } from '../config/section-sources';
import { LIST_SECTION_SPECS, factToLine, sectionLabelKey } from './build-sections';

const info = (id: string, labelKey: string, amount: number | null, meta?: OrderFinLine['meta']): OrderFinLine => ({
  id, labelKey, unit: 'money', amount, sign: 'neutral', role: 'informational', state: 'normal', countsInTotal: false,
  ...(meta ? { meta } : {}),
});

/**
 * Cash rounding (B17), the last step before the total: items + charges − discounts
 * + tax (exclusive) + rounding = total, the snapshot writer's formula. The line
 * carries the size and the direction separately, like every other line.
 */
function roundingSection(s: OrderFinSnapshotInput): OrderFinSectionPayload {
  if (s.rounding === 0) return { key: 'rounding', status: 'empty', totals: [] };
  return {
    key: 'rounding',
    status: 'ok',
    totals: [{
      id: 'rounding-total', labelKey: sectionLabelKey('rounding'), unit: 'money',
      amount: Math.abs(s.rounding), sign: s.rounding < 0 ? 'minus' : 'plus',
      role: 'additive', state: 'normal', countsInTotal: true,
    }],
  };
}

function currencySection(s: OrderFinSnapshotInput, detail: boolean): OrderFinSectionPayload {
  if (!s.baseCurrency) return { key: 'currency', status: 'empty', totals: [] };
  return {
    key: 'currency',
    status: 'ok',
    totals: [],
    ...(detail ? { lines: [info('currency-base-total', 'orders.finView.lines.baseTotal', s.baseCurrency.total, { methodCode: s.baseCurrency.code })] } : {}),
  };
}

function reconciliationSection(s: OrderFinSnapshotInput, warnings: FinancialWarning[]): OrderFinSectionPayload {
  return {
    key: 'reconciliation',
    status: 'ok',
    totals: [],
    counts: { warnings: warnings.length, storedMismatches: s.mismatchCount },
    warningCodes: warnings.map((w) => w.code),
  };
}

function debugSection(s: OrderFinSnapshotInput, detail: boolean): OrderFinSectionPayload {
  const refs: Array<[string, string | null]> = [
    ['hash', s.calculationHash], ['traceId', s.traceId], ['engineVersion', s.engineVersion?.toString() ?? null],
  ];
  const lines = refs
    .filter(([, v]) => v)
    .map(([k, v]) => ({ ...info(`debug-${k}`, `orders.finView.lines.${k}`, null), meta: { ref: v as string } }));
  return { key: 'debug', status: lines.length ? 'ok' : 'empty', totals: [], ...(detail ? { lines } : {}) };
}

/**
 * Every dated fact, oldest first. `partial` when an event source was not
 * loaded or failed: the timeline then promises less than the full history.
 */
function timelineSection(set: OrderFinSourceSet, detail: boolean): OrderFinSectionPayload {
  const events: OrderFinLine[] = [];
  let partial = false;
  for (const source of TIMELINE_EVENT_SOURCES) {
    const facts = set.facts[source];
    if (!facts || set.errors[source]) {
      partial = true;
      continue;
    }
    const sectionKey = (Object.keys(LIST_SECTION_SPECS) as OrderFinSectionKey[]).find((k) => LIST_SECTION_SPECS[k]?.source === source);
    for (const f of facts) {
      if (!f.dateIso) continue;
      events.push({
        ...factToLine(f, 'neutral'),
        id: `${source}:${f.id}`,
        labelKey: sectionLabelKey(sectionKey ?? 'timeline'),
        role: 'informational',
        countsInTotal: false,
      });
    }
  }
  events.sort((a, b) => (a.meta?.dateIso ?? '').localeCompare(b.meta?.dateIso ?? ''));
  return {
    key: 'timeline',
    status: events.length ? 'ok' : 'empty',
    totals: [],
    counts: { events: events.length },
    partial,
    ...(detail ? { lines: events } : {}),
  };
}

/** Currency, reconciliation, debug or timeline; undefined for any other key. */
export function buildSpecialSection(
  key: OrderFinSectionKey,
  mode: Exclude<OrderFinSectionMode, 'hidden'>,
  set: OrderFinSourceSet & { snapshot: OrderFinSnapshotInput },
  warnings: FinancialWarning[],
): OrderFinSectionPayload | undefined {
  const detail = mode !== 'total';
  switch (key) {
    case 'rounding': return roundingSection(set.snapshot);
    case 'currency': return currencySection(set.snapshot, detail);
    case 'reconciliation': return reconciliationSection(set.snapshot, warnings);
    case 'debug': return debugSection(set.snapshot, detail);
    case 'timeline': return timelineSection(set, detail);
    default: return undefined;
  }
}
