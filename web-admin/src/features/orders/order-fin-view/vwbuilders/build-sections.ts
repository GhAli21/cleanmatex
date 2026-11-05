/**
 * Section builders (DESIGN §1 step 3). Pure: a normalized source set in,
 * section payloads out. No money arithmetic: section totals are snapshot
 * values, lines are fact rows as stored. `countsInTotal` follows the line state.
 */
import { TAX_PRICING_MODES } from '@/lib/constants/order-financial';
import type {
  OrderFinDataSource,
  OrderFinFactInput,
  OrderFinLine,
  OrderFinSectionKey,
  OrderFinSectionMode,
  OrderFinSectionPayload,
  OrderFinSnapshotInput,
  OrderFinSourceSet,
} from '@/lib/types/order-fin-view';

interface SectionSpec {
  source: OrderFinDataSource;
  sign: OrderFinLine['sign'];
  /** Snapshot total; absent for records sections, which show a count instead. */
  total?: (s: OrderFinSnapshotInput) => number;
  /** Role of the total and of default-role lines; `additive` when absent. */
  role?: (s: OrderFinSnapshotInput) => OrderFinLine['role'];
}

/** Sections built from one fact source. */
export const LIST_SECTION_SPECS: Partial<Record<OrderFinSectionKey, SectionSpec>> = {
  items:        { source: 'items',        sign: 'plus',    total: (s) => s.itemsBase },
  charges:      { source: 'charges',      sign: 'plus',    total: (s) => s.charges },
  discounts:    { source: 'discounts',    sign: 'minus',   total: (s) => s.discount },
  // Tax-inclusive prices already hold the tax: shown as "included", never added again (writer's taxAddend).
  taxes:        { source: 'taxes',        sign: 'plus',    total: (s) => s.tax,
    role: (s) => (s.taxPricingMode === TAX_PRICING_MODES.TAX_INCLUSIVE ? 'included' : 'additive') },
  payments:     { source: 'payments',     sign: 'minus',   total: (s) => s.paid },
  credits:      { source: 'credits',      sign: 'minus',   total: (s) => s.credits },
  // Refunds, overpayment and receivable explain the balance; they are not part of the value sum.
  refunds:      { source: 'refunds',      sign: 'neutral', total: (s) => s.refunded },
  overpayment:  { source: 'overpayment',  sign: 'neutral', total: (s) => s.overpaid },
  receivable:   { source: 'receivable',   sign: 'neutral', total: (s) => s.receivable },
  taxDocuments: { source: 'taxDocuments', sign: 'neutral' },
  vouchers:     { source: 'vouchers',     sign: 'neutral' },
  loyalty:      { source: 'loyalty',      sign: 'neutral' },
  adjustments:  { source: 'adjustments',  sign: 'neutral' },
  orderChanges: { source: 'orderChanges', sign: 'neutral' },
  receipts:     { source: 'receipts',     sign: 'neutral' },
};

export const sectionLabelKey = (key: OrderFinSectionKey) => `orders.finView.sections.${key}`;

/** A fact as a statement line; informational and points lines never count toward a money total. */
export function factToLine(fact: OrderFinFactInput, sign: OrderFinLine['sign']): OrderFinLine {
  const meta: NonNullable<OrderFinLine['meta']> = {};
  if (fact.dateIso) meta.dateIso = fact.dateIso;
  if (fact.methodCode) meta.methodCode = fact.methodCode;
  if (fact.ref) meta.ref = fact.ref;
  if (fact.statusCode) meta.statusCode = fact.statusCode;
  const unit = fact.unit ?? 'money';
  const role = fact.role ?? 'additive';
  return {
    id: fact.id,
    ...(fact.labelKey ? { labelKey: fact.labelKey } : {}),
    ...(fact.label ? { label: fact.label } : {}),
    unit,
    amount: fact.amount,
    ...(fact.previousAmount !== undefined ? { previousAmount: fact.previousAmount } : {}),
    sign,
    role,
    state: fact.state,
    countsInTotal: fact.state === 'normal' && unit === 'money' && role === 'additive',
    ...(Object.keys(meta).length ? { meta } : {}),
  };
}

/** Parts already inside item prices (P0-08(h)): `included` lines, never added again. Unknown or zero: no line. */
function includedExtras(s: OrderFinSnapshotInput): OrderFinLine[] {
  const parts = [['speedPremiumIncluded', s.speedPremiumIncluded], ['extrasIncluded', s.extrasIncluded]] as const;
  return parts
    .filter(([, amount]) => amount)
    .map(([key, amount]) => ({
      id: `items-${key}`,
      labelKey: `orders.finView.lines.${key}`,
      unit: 'money' as const,
      amount,
      sign: 'plus' as const,
      role: 'included' as const,
      state: 'normal' as const,
      countsInTotal: false,
    }));
}

const countByState = (lines: OrderFinLine[]) =>
  lines.reduce<Record<string, number>>((acc, l) => {
    acc[l.state] = (acc[l.state] ?? 0) + 1;
    return acc;
  }, {});

/**
 * One fact-backed section; undefined when the key has no spec.
 * @param key - section key
 * @param mode - resolved mode (never 'hidden' here)
 * @param set - normalized sources with a written snapshot
 */
export function buildListSection(
  key: OrderFinSectionKey,
  mode: Exclude<OrderFinSectionMode, 'hidden'>,
  set: OrderFinSourceSet & { snapshot: OrderFinSnapshotInput },
): OrderFinSectionPayload | undefined {
  const spec = LIST_SECTION_SPECS[key];
  if (!spec) return undefined;

  const total = spec.total?.(set.snapshot);
  const role = spec.role?.(set.snapshot) ?? 'additive';
  const totals: OrderFinLine[] = total === undefined ? [] : [{
    id: `${key}-total`,
    labelKey: sectionLabelKey(key),
    unit: 'money',
    amount: total,
    sign: spec.sign,
    role,
    state: 'normal',
    countsInTotal: role === 'additive',
  }];

  // A snapshot total stays valid when only the detail source failed.
  if (set.errors[spec.source]) return { key, status: 'error', totals };

  const facts = set.facts[spec.source];
  const all = facts && [
    ...facts.map((f) => factToLine(role === 'additive' || f.role ? f : { ...f, role }, spec.sign)),
    ...(key === 'items' ? includedExtras(set.snapshot) : []),
  ];
  const lines = mode === 'total' ? undefined : all;

  const isEmpty = (total === undefined || total === 0) && (!all || all.length === 0);
  return {
    key,
    status: isEmpty ? 'empty' : 'ok',
    totals,
    ...(all ? { counts: countByState(all) } : {}),
    ...(lines ? { lines } : {}),
  };
}
