/**
 * `resolveOrderFinDisplayConfig` (PLAN §6, DESIGN §1 step 1): merges the
 * preset with caller overrides and works out the minimum data sources.
 * Pure, runs on client and server. No permission logic (D10).
 *
 * Source constraints win over the preset and any override:
 * - `public` preset: sections and header metrics are fixed to the §6.2 allowlist;
 * - draft source: sections with no meaning before submission are hidden, and nothing loads from the DB;
 * - edit-only metrics are dropped for other sources.
 */
import {
  ORDER_FIN_DATA_SOURCES,
  ORDER_FIN_DEFAULT_LINE_CAP,
  ORDER_FIN_GROUP_KEYS,
  ORDER_FIN_SECTION_KEYS,
} from '@/lib/constants/order-fin-view';
import type {
  OrderFinDataSource,
  OrderFinHeaderMetric,
  OrderFinSectionKey,
  OrderFinSectionMode,
  OrderFinSourceKind,
  OrderFinancialDisplayConfig,
  ResolvedOrderFinDisplayConfig,
} from '@/lib/types/order-fin-view';
import { PUBLIC_HEADER_METRICS, presetHeader, presetSectionModes } from './presets';
import { ORDER_FIN_SECTION_SOURCES } from './section-sources';

/** Hidden for drafts whatever the caller asks (PLAN §6.3). */
export const DRAFT_HIDDEN_SECTIONS: OrderFinSectionKey[] = [
  'refunds', 'overpayment', 'receivable', 'vouchers', 'taxDocuments', 'loyalty',
  'orderChanges', 'adjustments', 'receipts', 'timeline', 'reconciliation', 'debug',
];

const EDIT_ONLY_METRICS: OrderFinHeaderMetric[] = ['originalTotal', 'projectedTotal', 'totalDelta', 'projectedBalance'];

/** Caller's keys first (deduplicated, unknown dropped), then the rest in default order. */
function completeOrder<K extends string>(all: readonly K[], requested: readonly K[] | undefined): K[] {
  const known = (requested ?? []).filter((k, i, arr) => all.includes(k) && arr.indexOf(k) === i);
  return [...known, ...all.filter((k) => !known.includes(k))];
}

/** Sources needed to render the given modes; `core` always first. */
export function requiredSourcesFor(sections: Record<OrderFinSectionKey, OrderFinSectionMode>): OrderFinDataSource[] {
  const needed = new Set<OrderFinDataSource>(['core']);
  for (const key of ORDER_FIN_SECTION_KEYS) {
    const mode = sections[key];
    if (mode === 'hidden') continue;
    const { totalFromSnapshot, detail } = ORDER_FIN_SECTION_SOURCES[key];
    if (mode !== 'total' || !totalFromSnapshot) detail.forEach((s) => needed.add(s));
  }
  return ORDER_FIN_DATA_SOURCES.filter((s) => needed.has(s));
}

/**
 * @param config - caller configuration (preset default `summary`)
 * @param sourceKind - where the figures come from
 * @returns every option filled, plus `requiredSources`
 * @example resolveOrderFinDisplayConfig({ preset: 'totals' }, 'saved').requiredSources // ['core']
 */
export function resolveOrderFinDisplayConfig(
  config: OrderFinancialDisplayConfig = {},
  sourceKind: OrderFinSourceKind = 'saved',
): ResolvedOrderFinDisplayConfig {
  const preset = config.preset ?? 'summary';
  const isPublic = preset === 'public';

  const sections = presetSectionModes(preset);
  if (!isPublic) {
    for (const key of ORDER_FIN_SECTION_KEYS) {
      const override = config.sections?.[key];
      if (override) sections[key] = override;
    }
  }
  if (sourceKind === 'draft') DRAFT_HIDDEN_SECTIONS.forEach((key) => { sections[key] = 'hidden'; });

  const base = presetHeader(preset);
  const header = isPublic ? base : { ...base, ...stripUndefined(config.header ?? {}) };
  const allowed = (m: OrderFinHeaderMetric) =>
    (sourceKind === 'edit' || !EDIT_ONLY_METRICS.includes(m)) && (!isPublic || PUBLIC_HEADER_METRICS.includes(m));
  header.metrics = header.metrics.filter(allowed);
  if (!allowed(header.emphasize)) header.emphasize = 'balance';
  if (isPublic) {
    header.showSettlementType = false;
    header.showReconciliationBadge = false;
    header.showBaseCurrency = false;
  }

  const layout = config.layout ?? 'card';
  const showsAll = preset === 'audit' || layout === 'print';
  const cap = config.lineCap;

  return {
    preset,
    sourceKind,
    header,
    sections,
    sectionOrder: completeOrder(ORDER_FIN_SECTION_KEYS, config.sectionOrder),
    groupOrder: completeOrder(ORDER_FIN_GROUP_KEYS, config.groupOrder),
    lineCap: showsAll ? null : cap && Number.isInteger(cap) && cap > 0 ? cap : ORDER_FIN_DEFAULT_LINE_CAP,
    layout,
    columns: config.columns ?? 'auto',
    density: config.density ?? 'comfortable',
    showEmptySections: config.showEmptySections ?? (preset === 'full' || preset === 'audit'),
    showWarnings: isPublic ? false : config.showWarnings ?? true,
    forbiddenSectionBehavior: config.forbiddenSectionBehavior ?? 'hide',
    presetSwitcher: isPublic ? [] : config.presetSwitcher ?? [],
    requiredSources: sourceKind === 'draft' ? [] : requiredSourcesFor(sections),
  };
}

/** An explicit `undefined` in caller config must not erase a preset default. */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
