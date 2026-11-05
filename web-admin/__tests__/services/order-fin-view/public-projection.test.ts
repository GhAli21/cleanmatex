/**
 * P3-06 — public projection allowlist (PLAN §6.2, D7, D11).
 * A new view field fails "every field is classified" until someone marks it
 * public or private here, on purpose.
 */
jest.mock('server-only', () => ({}));

import { ORDER_FIN_PUBLIC_HEADER_METRICS, ORDER_FIN_PUBLIC_SECTION_KEYS } from '@/lib/constants/order-fin-view';
import { projectOrderFinancialViewForPublic } from '@/lib/services/order-fin-view/projections/public.projection';
import type { OrderFinLine, OrderFinSectionPayload, OrderFinSnapshotInput, OrderFinSourceSet, OrderFinancialView } from '@/lib/types/order-fin-view';
import {
  orderFinLineSchema,
  orderFinSectionPayloadSchema,
  orderFinancialPublicViewSchema,
  orderFinancialViewSchema,
} from '@/lib/validations/order-fin-view-schemas';
import { presetSectionModes } from '@/src/features/orders/order-fin-view/config/presets';
import { resolveOrderFinDisplayConfig } from '@/src/features/orders/order-fin-view/config/resolve-display-config';
import { assembleOrderFinancialView } from '@/src/features/orders/order-fin-view/vwbuilders/assemble';

type Cls = 'public' | 'private';

// The classification. Changing a 'private' to 'public' is a product decision (§6.2), not a refactor.
const VIEW_FIELDS = {
  schemaVersion: 'public', orderId: 'private', orderNo: 'public', orderStatus: 'private',
  currency: 'public', currencyKnown: 'public', snapshotStatus: 'private', sourceKind: 'public',
  generatedAt: 'public', header: 'public', sections: 'public', warnings: 'private',
} as const satisfies Record<keyof OrderFinancialView, Cls>;
const HEADER_FIELDS = {
  metrics: 'public', balanceState: 'public', paymentStatus: 'public',
  settlementType: 'private', editOutcome: 'private', baseCurrency: 'private',
} as const satisfies Record<keyof OrderFinancialView['header'], Cls>;
const SECTION_FIELDS = {
  key: 'public', status: 'public', totals: 'public', lines: 'public',
  counts: 'private', warningCodes: 'private', partial: 'private',
} as const satisfies Record<keyof OrderFinSectionPayload, Cls>;
const LINE_FIELDS = {
  id: 'public', labelKey: 'public', label: 'public', unit: 'public', amount: 'public',
  previousAmount: 'private', sign: 'public', role: 'public', state: 'public', countsInTotal: 'public', meta: 'public',
} as const satisfies Record<keyof OrderFinLine, Cls>;
const META_FIELDS = {
  methodCode: 'public', dateIso: 'private', ref: 'private', statusCode: 'private',
} as const satisfies Record<keyof NonNullable<OrderFinLine['meta']>, Cls>;

const keysOf = (shape: object) => Object.keys(shape).sort();
const publicOf = (cls: Record<string, Cls>) => Object.keys(cls).filter((k) => cls[k] === 'public').sort();

const NOW = '2026-10-31T10:00:00.000Z';
const snapshot: OrderFinSnapshotInput = {
  orderId: 'o1', orderNo: '10234', orderStatus: 'processing',
  currencyCode: 'OMR', currencyDecimals: 3, snapshotStatus: 'CURRENT',
  paymentStatus: 'PARTIALLY_PAID', settlementType: 'PAY_ON_COLLECTION', mismatchCount: 1,
  itemsBase: 10, extrasIncluded: 1, speedPremiumIncluded: null, charges: 1.5, discount: 0.5, tax: 0.475,
  rounding: 0, taxPricingMode: 'TAX_EXCLUSIVE', total: 11.475, paid: 8, credits: 1, refunded: 0, netCollected: 8,
  outstanding: 2.475, overpaid: 0, changeReturned: 0, receivable: 0,
  baseCurrency: { code: 'USD', total: 29.8, exchangeRate: 2.597 },
  engineVersion: 2, calculationHash: 'HASH-SECRET', traceId: 'TRACE-SECRET',
};
const set: OrderFinSourceSet = {
  sourceKind: 'saved',
  snapshot,
  facts: {
    items: [{ id: 'i1', label: { name: 'Shirt', name2: 'قميص' }, amount: 10, state: 'normal' }],
    charges: [{ id: 'c1', label: { name: 'Delivery', name2: 'توصيل' }, amount: 1.5, state: 'normal', methodCode: 'DELIVERY' }],
    payments: [
      { id: 'p1', amount: 5, state: 'normal', methodCode: 'CASH', statusCode: 'COMPLETED', dateIso: NOW },
      { id: 'p2', amount: 2, state: 'normal', methodCode: 'CARD', ref: '••4821', statusCode: 'COMPLETED' },
      { id: 'p3', amount: 1, state: 'normal', methodCode: 'CARD', ref: '••9310', statusCode: 'COMPLETED' },
      { id: 'p4', amount: 4, state: 'pending', methodCode: 'CARD', ref: '••0001', statusCode: 'PENDING' },
    ],
    credits: [{ id: 'cr1', amount: 1, state: 'normal', methodCode: 'GIFT_CARD', ref: 'GC-7781' }],
    vouchers: [{ id: 'v1', amount: 8, role: 'informational', state: 'normal', ref: 'RV-000123' }],
  },
  errors: {},
  checks: { expectedOutstanding: 9 },
};
// The richest internal view: every section, warnings, debug, base currency.
const full = assembleOrderFinancialView(set, resolveOrderFinDisplayConfig({ preset: 'audit' }), NOW);

describe('projectOrderFinancialViewForPublic', () => {
  it('every view field is classified public or private', () => {
    expect(keysOf(VIEW_FIELDS)).toEqual(keysOf(orderFinancialViewSchema.shape));
    expect(keysOf(HEADER_FIELDS)).toEqual(keysOf(orderFinancialViewSchema.shape.header.shape));
    expect(keysOf(SECTION_FIELDS)).toEqual(keysOf(orderFinSectionPayloadSchema.shape));
    expect(keysOf(LINE_FIELDS)).toEqual(keysOf(orderFinLineSchema.shape));
    expect(keysOf(META_FIELDS)).toEqual(keysOf(orderFinLineSchema.shape.meta.unwrap().shape));
  });

  it('the public schema allows exactly the public fields', () => {
    const pub = orderFinancialPublicViewSchema.shape;
    // Private top-level fields stay in the shape as null/[] so the one component renders both.
    expect(keysOf(pub)).toEqual(keysOf(VIEW_FIELDS));
    expect(publicOf(HEADER_FIELDS)).toEqual(keysOf(pub.header.shape).filter((k) => k !== 'settlementType'));
    const section = pub.sections.valueType;
    expect(keysOf(section.shape)).toEqual(publicOf(SECTION_FIELDS));
    expect(keysOf(section.shape.totals.element.shape)).toEqual(publicOf(LINE_FIELDS));
    expect(keysOf(section.shape.totals.element.shape.meta.unwrap().shape)).toEqual(publicOf(META_FIELDS));
    expect([...ORDER_FIN_PUBLIC_SECTION_KEYS]).toEqual(['items', 'charges', 'discounts', 'taxes', 'rounding', 'credits', 'refunds', 'payments']);
    expect([...ORDER_FIN_PUBLIC_HEADER_METRICS]).toEqual(['total', 'paid', 'credits', 'balance', 'refunded', 'discount', 'tax']);
  });

  it('the public preset shows exactly the allowlisted sections', () => {
    const modes = presetSectionModes('public');
    expect(Object.keys(modes).filter((k) => modes[k as keyof typeof modes] !== 'hidden').sort())
      .toEqual([...ORDER_FIN_PUBLIC_SECTION_KEYS].sort());
  });

  it('projects the richest view into a valid public view with no internals', () => {
    expect(full.warnings.length).toBeGreaterThan(0);
    const pub = projectOrderFinancialViewForPublic(full);
    expect(orderFinancialPublicViewSchema.safeParse(pub).success).toBe(true);
    expect(orderFinancialViewSchema.safeParse(pub).success).toBe(true); // same component renders it

    expect(Object.keys(pub.sections).sort()).toEqual([...ORDER_FIN_PUBLIC_SECTION_KEYS].sort());
    expect(Object.keys(pub.header.metrics).sort()).toEqual([...ORDER_FIN_PUBLIC_HEADER_METRICS].sort());
    expect(pub.header).toMatchObject({ balanceState: 'dueAtCollection', paymentStatus: 'PARTIALLY_PAID', settlementType: null });
    expect(pub.warnings).toEqual([]);

    const text = JSON.stringify(pub);
    for (const secret of ['••', 'GC-7781', 'RV-000123', 'HASH-SECRET', 'TRACE-SECRET', 'USD', '"o1"', 'processing', 'CURRENT', 'p1', 'cr1']) {
      expect([secret, text.includes(secret)]).toEqual([secret, false]);
    }
  });

  it('payments go out as completed tender totals per method (D11)', () => {
    const pub = projectOrderFinancialViewForPublic(full);
    expect(pub.sections.payments!.totals[0].amount).toBe(8);
    expect(pub.sections.payments!.lines!.map((l) => [l.meta?.methodCode, l.amount])).toEqual([['CASH', 5], ['CARD', 3]]);
  });

  it('a snapshot the engine does not stand behind shows no figures', () => {
    for (const status of ['RECALCULATION_REQUIRED', 'MISMATCH', 'STALE', null]) {
      const pub = projectOrderFinancialViewForPublic({ ...full, snapshotStatus: status });
      expect(pub.sections).toEqual({});
      expect(pub.header).toEqual({ metrics: {}, balanceState: null, paymentStatus: null, settlementType: null });
      expect(orderFinancialPublicViewSchema.safeParse(pub).success).toBe(true);
    }
    expect(Object.keys(projectOrderFinancialViewForPublic({ ...full, snapshotStatus: 'LOCKED' }).sections)).toHaveLength(8);
  });

  it('the public schema rejects anything outside the allowlist', () => {
    const pub = projectOrderFinancialViewForPublic(full);
    const bad: unknown[] = [
      { ...pub, debug: {} },
      { ...pub, orderId: 'o1' },
      { ...pub, warnings: full.warnings },
      { ...pub, header: { ...pub.header, metrics: { ...pub.header.metrics, receivable: 0 } } },
      { ...pub, sections: { ...pub.sections, debug: { key: 'debug', status: 'ok', totals: [] } } },
      { ...pub, sections: { ...pub.sections, items: { ...pub.sections.items!, counts: { normal: 1 } } } },
      { ...pub, sections: { ...pub.sections, payments: { ...pub.sections.payments!, lines: [{ ...pub.sections.payments!.lines![0], meta: { methodCode: 'CASH', ref: '••1' } }] } } },
    ];
    for (const v of bad) expect(orderFinancialPublicViewSchema.safeParse(v).success).toBe(false);
  });
});
