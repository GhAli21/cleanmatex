/**
 * Reusable Order Fin View P3-02/P3-05 — the source loaders against the real DB.
 *
 * Proves: `loadOrderCore` reads the snapshot row for the owning tenant only,
 * the registry loads only the requested sources, keeps voided charges, and
 * returns nothing for another tenant's order (tenant filter in every query).
 *
 * Isolation: every write runs inside a transaction that is always rolled back.
 * Gating: skips cleanly when no DB is reachable.
 *
 * @jest-environment node
 */
jest.mock('server-only', () => ({}));
// Route every `prisma` read to the open fixture transaction.
jest.mock('@/lib/db/prisma', () => {
  const actual = jest.requireActual('@/lib/db/prisma');
  const real = actual.prisma;
  const routed = new Proxy(real, {
    get(target, prop, receiver) {
      const tx = (globalThis as { __finViewTx?: Record<string | symbol, unknown> }).__finViewTx;
      if (tx && prop === '$transaction') {
        return async (arg: unknown) => (typeof arg === 'function' ? (arg as (t: unknown) => unknown)(tx) : Promise.all(arg as unknown[]));
      }
      if (tx && prop !== '$disconnect' && prop in tx) return tx[prop];
      return Reflect.get(target, prop, receiver);
    },
  });
  return { ...actual, prisma: routed, default: routed };
});

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { loadOrderCore } from '@/lib/services/order-fin-view/sources/core.source';
import { loadOrderFinSources } from '@/lib/services/order-fin-view/sources/registry';
import { ORDER_FIN_DATA_SOURCES } from '@/lib/constants/order-fin-view';
import { getOrderFinancialView } from '@/lib/services/order-fin-view/order-fin-view.service';
import { resolveOrderFinDisplayConfig } from '@/src/features/orders/order-fin-view/config/resolve-display-config';
import { orderFinancialViewSchema } from '@/lib/validations/order-fin-view-schemas';
import { NotFoundError, ValidationError } from '@/lib/errors/base-errors';
import { ORDER_FIN_HEADERS_MAX, getOrderFinancialHeaders } from '@/lib/services/order-fin-view/order-fin-headers.service';
import { getPublicOrderFinancialView, resolveCustomerOwnedOrderId } from '@/lib/services/order-fin-view/public-view.service';
import { orderFinancialPublicViewSchema } from '@/lib/validations/order-fin-view-schemas';
import { createTaxDocumentTx, issueTaxDocumentTx } from '@/lib/services/tax-document-write.service';
import { getTaxDocumentPrintDetail } from '@/lib/services/tax-document-read.service';
import { recalculateOrderFinancialSnapshotTx } from '@/lib/services/order-financial-write.service';
import { ORDER_FIN_SECTION_GROUP } from '@/lib/constants/order-fin-view';
import type { OrderFinSectionKey } from '@/lib/types/order-fin-view';

let dbUp = false;
let tenantA = '';

beforeAll(async () => {
  try {
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 1`;
    tenantA = tenants[0]?.id ?? '';
    dbUp = tenantA.length > 0;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const ROLLBACK = Symbol('fin-view-sources-rollback');
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
async function runRollback(fn: (tx: TxClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      (globalThis as { __finViewTx?: unknown }).__finViewTx = tx;
      try {
        await fn(tx as TxClient);
      } finally {
        delete (globalThis as { __finViewTx?: unknown }).__finViewTx;
      }
      throw ROLLBACK;
    }, { timeout: 30000 });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
}

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[order-fin-view-sources] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('Order Fin View sources (DB-level)', () => {
  dbit('loads requested sources for the owning tenant only', async () => {
    await runRollback(async (tx) => {
      const t = tenantA;
      const cust = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${t}::uuid) RETURNING id`;
      const order = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, total_amount, outstanding_amount)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 11.475, 2.475)
        RETURNING id`;
      const orderId = order[0].id;
      await tx.$executeRaw`
        INSERT INTO public.org_order_charges_dtl (tenant_org_id, order_id, charge_type, label, amount, currency_code, is_voided)
        VALUES (${t}::uuid, ${orderId}::uuid, 'EXPRESS', 'Express', 1, 'OMR', false),
               (${t}::uuid, ${orderId}::uuid, 'SPECIAL_HANDLING', 'Special handling', 0.3, 'OMR', true)`;

      const core = await loadOrderCore(t, orderId);
      expect(core?.id).toBe(orderId);
      expect(Number(core?.total_amount)).toBe(11.475);
      expect(core?.currency_code).toBe('OMR');

      const { data, errors } = await loadOrderFinSources(t, orderId, ['core', 'charges', 'payments']);
      expect(errors).toEqual({});
      expect(Object.keys(data).sort()).toEqual(['charges', 'payments']);
      expect(data.charges?.map((c) => [c.charge_type, c.is_voided])).toEqual([['EXPRESS', false], ['SPECIAL_HANDLING', true]]);
      expect(data.payments).toEqual([]);

      // 0680: DELIVERY is a catalog code now, so a delivery fee row is accepted.
      await tx.$executeRaw`
        INSERT INTO public.org_order_charges_dtl (tenant_org_id, order_id, charge_type, label, amount, currency_code)
        VALUES (${t}::uuid, ${orderId}::uuid, 'DELIVERY', 'Delivery', 0.5, 'OMR')`;

      // Every source runs against the real schema without error.
      const all = await loadOrderFinSources(t, orderId, ORDER_FIN_DATA_SOURCES);
      expect(all.errors).toEqual({});
      expect(Object.keys(all.data).sort()).toEqual(ORDER_FIN_DATA_SOURCES.filter((k) => k !== 'core').sort());
      expect(all.data.charges?.map((c) => c.charge_type)).toContain('DELIVERY');
      expect(all.data.receivable).toEqual({ links: [], invoices: [], payments: [], creditAllocations: [] });

      // Another tenant asking for this order id sees nothing, from any source.
      const other = randomUUID();
      expect(await loadOrderCore(other, orderId)).toBeNull();
      const leaked = await loadOrderFinSources(other, orderId, ORDER_FIN_DATA_SOURCES);
      expect(leaked.errors).toEqual({});
      for (const [key, value] of Object.entries(leaked.data)) {
        const rows = key === 'receivable' ? (value as { links: unknown[] }).links : value;
        expect([key, rows]).toEqual([key, []]);
      }
    });
  });

  dbit('getOrderFinancialView: snapshot figures, voided charge not counted, other tenant 404', async () => {
    await runRollback(async (tx) => {
      const t = tenantA;
      const cust = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${t}::uuid) RETURNING id`;
      // A written snapshot (engine version set), pay on collection, partly paid.
      const order = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, payment_type_code,
          total_amount, total_charges_amount, total_paid_amount, outstanding_amount, financial_engine_version, financial_snapshot_status)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 'PAY_ON_COLLECTION',
          11.475, 1, 8, 3.475, 1, 'CURRENT')
        RETURNING id`;
      const orderId = order[0].id;
      await tx.$executeRaw`
        INSERT INTO public.org_order_charges_dtl (tenant_org_id, order_id, charge_type, label, amount, currency_code, is_voided)
        VALUES (${t}::uuid, ${orderId}::uuid, 'DELIVERY', 'Delivery', 1, 'OMR', false),
               (${t}::uuid, ${orderId}::uuid, 'SERVICE', 'Service', 0.3, 'OMR', true)`;

      const view = await getOrderFinancialView(t, orderId, resolveOrderFinDisplayConfig({ preset: 'detailed' }));
      expect(orderFinancialViewSchema.safeParse(view).success).toBe(true);
      expect(view.currency).toEqual({ code: 'OMR', decimalPlaces: 3 });
      expect(view.header.metrics).toMatchObject({ total: 11.475, paid: 8, balance: 3.475 });
      expect(view.header.balanceState).toBe('dueAtCollection');
      expect(view.sections.charges?.totals[0].amount).toBe(1);
      expect(view.sections.charges?.lines?.map((l) => [l.meta?.methodCode, l.countsInTotal])).toEqual([['DELIVERY', true], ['SERVICE', false]]);
      // The stored snapshot says paid 8 but no payment rows exist: the shared aggregation (D005) disagrees.
      expect(view.warnings.map((w) => w.code)).toContain('OUTSTANDING_MISMATCH');
      expect(view.sections.payments?.warningCodes).toContain('OUTSTANDING_MISMATCH');

      await expect(getOrderFinancialView(randomUUID(), orderId, resolveOrderFinDisplayConfig())).rejects.toThrow(NotFoundError);
    });
  });

  dbit('golden fixture: view = snapshot written by the real writer = reconciliation rules (P3-05)', async () => {
    await runRollback(async (tx) => {
      const t = tenantA;
      const cust = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${t}::uuid) RETURNING id`;
      const order = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, payment_type_code, tax_pricing_mode)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 'PAY_ON_COLLECTION', 'TAX_EXCLUSIVE')
        RETURNING id`;
      const orderId = order[0].id;
      // 6 + 4 items, delivery 1, order discount 0.5, VAT 5% on 9.5 → total 10.975.
      await tx.$executeRaw`
        INSERT INTO public.org_order_items_dtl (tenant_org_id, order_id, price_per_unit, total_price, quantity)
        VALUES (${t}::uuid, ${orderId}::uuid, 6, 6, 1), (${t}::uuid, ${orderId}::uuid, 4, 4, 1)`;
      await tx.$executeRaw`
        INSERT INTO public.org_order_charges_dtl (tenant_org_id, order_id, charge_type, label, amount, currency_code)
        VALUES (${t}::uuid, ${orderId}::uuid, 'DELIVERY', 'Delivery', 1, 'OMR')`;
      await tx.$executeRaw`
        INSERT INTO public.org_order_discounts_dtl (tenant_org_id, order_id, applied_seq, source_type, discount_type, discount_amount, discount_level)
        VALUES (${t}::uuid, ${orderId}::uuid, 1, 'MANUAL', 'FIXED_AMOUNT', 0.5, 'ORDER')`;
      await tx.$executeRaw`
        INSERT INTO public.org_order_taxes_dtl (tenant_org_id, order_id, tax_type, label, rate, taxable_amount, tax_amount, currency_code)
        VALUES (${t}::uuid, ${orderId}::uuid, 'VAT', 'VAT', 5, 9.5, 0.475, 'OMR')`;
      // One cash payment counted, one failed card payment not; one applied wallet credit.
      await tx.$executeRaw`
        INSERT INTO public.org_order_payments_dtl (tenant_org_id, order_id, payment_method_code, amount, currency_code, payment_status, paid_at)
        VALUES (${t}::uuid, ${orderId}::uuid, 'CASH', 5, 'OMR', 'COMPLETED', now()),
               (${t}::uuid, ${orderId}::uuid, 'CARD', 3, 'OMR', 'FAILED', now())`;
      await tx.$executeRaw`
        INSERT INTO public.org_order_credit_apps_dtl (tenant_org_id, order_id, credit_type, applied_amount, currency_code)
        VALUES (${t}::uuid, ${orderId}::uuid, 'WALLET', 1, 'OMR')`;

      await recalculateOrderFinancialSnapshotTx(tx as never, t, orderId);
      const stored = (await tx.$queryRaw<Array<Record<string, string>>>`
        SELECT total_amount::text, total_paid_amount::text, total_credit_applied_amount::text, outstanding_amount::text,
               total_tax_amount::text, total_discount_amount::text, items_base_amount::text, total_charges_amount::text
        FROM public.org_orders_mst WHERE id = ${orderId}::uuid AND tenant_org_id = ${t}::uuid`)[0];
      expect(Number(stored.total_amount)).toBe(10.975);

      const v = await getOrderFinancialView(t, orderId, resolveOrderFinDisplayConfig({ preset: 'audit' }));
      expect(orderFinancialViewSchema.safeParse(v).success).toBe(true);
      // View = snapshot.
      expect(v.header.metrics).toMatchObject({
        total: Number(stored.total_amount), paid: Number(stored.total_paid_amount), credits: Number(stored.total_credit_applied_amount),
        balance: Number(stored.outstanding_amount), tax: Number(stored.total_tax_amount), discount: Number(stored.total_discount_amount),
      });
      expect(v.header.metrics).toMatchObject({ paid: 5, credits: 1, balance: 4.975 });
      // Snapshot = reconciliation: the shared aggregation and the writer's total formula raise nothing.
      expect(v.warnings.filter((w) => w.severity !== 'info')).toEqual([]);
      // The statement adds up, and each value section's counted lines add up to its total.
      let sum = 0;
      for (const [key, sec] of Object.entries(v.sections)) {
        if (!sec || ORDER_FIN_SECTION_GROUP[key as OrderFinSectionKey] !== 'value') continue;
        for (const l of sec.totals) if (l.countsInTotal) sum += (l.sign === 'minus' ? -1 : 1) * (l.amount ?? 0);
        if (sec.lines && sec.totals[0]) {
          const counted = sec.lines.filter((l) => l.countsInTotal).reduce((a, l) => a + (l.amount ?? 0), 0);
          expect([key, Math.round(counted * 1e4) / 1e4]).toEqual([key, sec.totals[0].amount]);
        }
      }
      expect(Math.round(sum * 1e4) / 1e4).toBe(10.975);
      for (const key of ['payments', 'credits'] as const) {
        const sec = v.sections[key]!;
        const counted = sec.lines!.filter((l) => l.countsInTotal).reduce((a, l) => a + (l.amount ?? 0), 0);
        expect([key, counted]).toEqual([key, sec.totals[0].amount]);
      }
      expect(v.sections.payments!.lines!.map((l) => [l.meta?.methodCode, l.state])).toEqual(expect.arrayContaining([['CASH', 'normal'], ['CARD', 'failed']]));

      // P7-03: the richest preset stays fast (target p95 < 300 ms; local harness, every source loaded).
      const runs: number[] = [];
      for (let i = 0; i < 20; i += 1) {
        const t0 = performance.now();
        await getOrderFinancialView(t, orderId, resolveOrderFinDisplayConfig({ preset: 'audit' }));
        runs.push(performance.now() - t0);
      }
      const p95 = [...runs].sort((a, b) => a - b)[Math.ceil(runs.length * 0.95) - 1];
      console.info(`[P7-03] audit view p95 ${p95.toFixed(1)} ms over ${runs.length} runs`);
      expect(p95).toBeLessThan(300);

      // P4-06/P4-07: the public view of the same order is the strict projection; ownership needs tenant AND customer.
      await tx.$executeRaw`UPDATE public.org_orders_mst SET financial_snapshot_status = 'CURRENT' WHERE id = ${orderId}::uuid AND tenant_org_id = ${t}::uuid`;
      const pub = await getPublicOrderFinancialView(t, orderId);
      expect(orderFinancialPublicViewSchema.safeParse(pub).success).toBe(true);
      expect(pub.header.metrics).toMatchObject({ total: 10.975, paid: 5, credits: 1, balance: 4.975 });
      expect(pub.sections.payments!.lines!.map((l) => [l.meta?.methodCode, l.amount])).toEqual([['CASH', 5]]);
      const orderNo = (await tx.$queryRaw<Array<{ order_no: string }>>`
        SELECT order_no FROM public.org_orders_mst WHERE id = ${orderId}::uuid AND tenant_org_id = ${t}::uuid`)[0].order_no;
      expect(await resolveCustomerOwnedOrderId(t, cust[0].id, orderNo)).toBe(orderId);
      await expect(resolveCustomerOwnedOrderId(t, randomUUID(), orderNo)).rejects.toThrow(NotFoundError);
      await expect(resolveCustomerOwnedOrderId(randomUUID(), cust[0].id, orderNo)).rejects.toThrow(NotFoundError);
      await expect(getPublicOrderFinancialView(randomUUID(), orderId)).rejects.toThrow(NotFoundError);
    });
  });

  dbit('tax document copies the item table at issue and reads it back (Line-Level P8-02)', async () => {
    await runRollback(async (tx) => {
      const t = tenantA;
      const cust = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${t}::uuid) RETURNING id`;
      const order = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, total_amount, commercial_calc_version)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 10.08, 1) RETURNING id`;
      const orderId = order[0].id;
      const cat = (await tx.$queryRaw<Array<{ code: string }>>`SELECT code FROM public.sys_tax_category_cd ORDER BY code LIMIT 1`)[0].code;
      await tx.$executeRaw`
        INSERT INTO public.org_order_items_dtl (tenant_org_id, order_id, product_name, product_name2, price_per_unit, total_price, quantity,
          line_disc_amount, order_disc_alloc_amount, net_amount, tax_category_code, tax_rate, tax_amount, line_total_amount, created_at)
        VALUES (${t}::uuid, ${orderId}::uuid, 'Shirt', 'قميص', 3, 6, 2, 0.5, 0.1, 5.4, ${cat}, 5, 0.27, 5.67, now() - interval '1 minute'),
               (${t}::uuid, ${orderId}::uuid, 'Trousers', NULL, 4, 4, 1, 0, 0.2, 3.8, ${cat}, 5, 0.19, 3.99, now())`;
      const docId = await createTaxDocumentTx(tx as never, {
        tenantId: t, orderId, documentType: 'SIMPLIFIED_INVOICE', triggerEvent: 'ON_ORDER_SUBMIT',
        totalAmount: 9.66, taxAmount: 0.46, currencyCode: 'OMR',
      });
      await issueTaxDocumentTx(tx as never, docId, t, 'test');
      const detail = await getTaxDocumentPrintDetail(t, orderId, docId);
      expect(detail.items).toEqual([
        expect.objectContaining({ lineNo: 1, productName: 'Shirt', productName2: 'قميص', quantity: 2, pricePerUnit: 3, discountAmount: 0.6, netAmount: 5.4, taxRate: 5, taxAmount: 0.27, lineTotalAmount: 5.67 }),
        expect.objectContaining({ lineNo: 2, productName: 'Trousers', discountAmount: 0.2, lineTotalAmount: 3.99 }),
      ]);

      // An order written before the calculator has no line money: no item lines, never invented.
      const legacy = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, total_amount)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 4) RETURNING id`;
      await tx.$executeRaw`
        INSERT INTO public.org_order_items_dtl (tenant_org_id, order_id, product_name, price_per_unit, total_price, quantity)
        VALUES (${t}::uuid, ${legacy[0].id}::uuid, 'Old shirt', 4, 4, 1)`;
      const legacyDoc = await createTaxDocumentTx(tx as never, {
        tenantId: t, orderId: legacy[0].id, documentType: 'SIMPLIFIED_INVOICE', triggerEvent: 'ON_ORDER_SUBMIT',
        totalAmount: 4, taxAmount: 0, currencyCode: 'OMR',
      });
      expect((await getTaxDocumentPrintDetail(t, legacy[0].id, legacyDoc)).items).toEqual([]);
    });
  });

  dbit('getOrderFinancialView: tax mode from the writer record, rounding line, total check', async () => {
    await runRollback(async (tx) => {
      const t = tenantA;
      const cust = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${t}::uuid) RETURNING id`;
      // Older order: no tax_pricing_mode column value; the snapshot writer recorded TAX_INCLUSIVE.
      // 10 + 1 − 0.5 (+ tax inside) − 0.05 rounding = 10.45.
      const json = JSON.stringify({ version: 5, taxPricingModeAtCalculation: 'TAX_INCLUSIVE' });
      const inclusive = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, payment_type_code,
          items_base_amount, total_charges_amount, total_discount_amount, total_tax_amount, rounding_adjustment_amount,
          total_amount, outstanding_amount, financial_engine_version, financial_snapshot_status, financial_calculation_snapshot)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 'PAY_ON_COLLECTION',
          10, 1, 0.5, 0.476, -0.05, 10.45, 10.45, 5, 'CURRENT', ${json}::jsonb)
        RETURNING id`;
      const v = await getOrderFinancialView(t, inclusive[0].id, resolveOrderFinDisplayConfig({ preset: 'detailed' }));
      expect(orderFinancialViewSchema.safeParse(v).success).toBe(true);
      expect(v.sections.taxes?.totals[0]).toMatchObject({ amount: 0.476, role: 'included', countsInTotal: false });
      expect(v.sections.rounding?.totals[0]).toMatchObject({ amount: 0.05, sign: 'minus', countsInTotal: true });
      expect(v.warnings.map((w) => w.code)).not.toContain('ORDER_TOTAL_COMPONENT_MISMATCH');

      // A total that the stored parts do not give (written outside the snapshot writer).
      const drifted = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, payment_type_code, tax_pricing_mode,
          items_base_amount, total_tax_amount, total_amount, outstanding_amount, financial_engine_version, financial_snapshot_status)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 'PAY_ON_COLLECTION', 'TAX_EXCLUSIVE',
          10, 0.5, 12, 12, 5, 'CURRENT')
        RETURNING id`;
      const d = await getOrderFinancialView(t, drifted[0].id, resolveOrderFinDisplayConfig({ preset: 'detailed' }));
      expect(d.sections.taxes?.totals[0]).toMatchObject({ role: 'additive', countsInTotal: true });
      expect(d.warnings.find((w) => w.code === 'ORDER_TOTAL_COMPONENT_MISMATCH')?.messageParams).toEqual({ expected: 10.5, stored: 12 });
    });
  });

  dbit('getOrderFinancialView: included speed premium and extras lines on calculator orders, none on older orders', async () => {
    await runRollback(async (tx) => {
      const t = tenantA;
      const cust = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${t}::uuid) RETURNING id`;
      const make = async (calcVersion: number | null) => {
        const o = await tx.$queryRaw<Array<{ id: string }>>`
          INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, payment_type_code,
            items_base_amount, piece_extra_price_amount, preference_extra_price_amount, total_amount, outstanding_amount,
            financial_engine_version, financial_snapshot_status, commercial_calc_version)
          VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 'PAY_ON_COLLECTION',
            8, 0.5, 1, 8, 8, 5, 'CURRENT', ${calcVersion}::smallint)
          RETURNING id`;
        // Two lines; inside total_price: extras 0.4 + 0.35, express premium 1 on the first.
        await tx.$executeRaw`
          INSERT INTO public.org_order_items_dtl (tenant_org_id, order_id, price_per_unit, total_price, service_pref_charge, speed_premium_amount)
          VALUES (${t}::uuid, ${o[0].id}::uuid, 5, 5, 0.4, 1), (${t}::uuid, ${o[0].id}::uuid, 3, 3, 0.35, 0)`;
        return getOrderFinancialView(t, o[0].id, resolveOrderFinDisplayConfig({ preset: 'detailed' }));
      };

      const calc = await make(1);
      const included = calc.sections.items?.lines?.filter((l) => l.role === 'included');
      // The stored piece/preference columns (0.5 / 1) overlap and are not used.
      expect(included).toEqual([
        expect.objectContaining({ id: 'items-speedPremiumIncluded', amount: 1, countsInTotal: false }),
        expect.objectContaining({ id: 'items-extrasIncluded', amount: 0.75, countsInTotal: false }),
      ]);
      expect(calc.sections.items?.totals[0].amount).toBe(8);

      const legacy = await make(null);
      expect(legacy.sections.items?.lines?.some((l) => l.role === 'included')).toBe(false);
      expect(legacy.sections.items?.lines).toHaveLength(2);

      const totalsOnly = await getOrderFinancialView(t, (await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.org_orders_mst WHERE tenant_org_id = ${t}::uuid AND customer_id = ${cust[0].id}::uuid AND commercial_calc_version = 1`)[0].id,
        resolveOrderFinDisplayConfig({ preset: 'totals' }));
      expect(totalsOnly.sections.items?.lines).toBeUndefined();
    });
  });

  dbit('getOrderFinancialHeaders: one batch, snapshot figures, missing snapshot has none, tenant-scoped, capped', async () => {
    await runRollback(async (tx) => {
      const t = tenantA;
      const cust = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${t}::uuid) RETURNING id`;
      const written = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, payment_type_code,
          total_amount, total_paid_amount, outstanding_amount, financial_engine_version, financial_snapshot_status)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 'PAY_IN_ADVANCE', 5, 5, 0, 1, 'CURRENT')
        RETURNING id`;
      const never = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, total_amount, financial_engine_version)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 9, NULL)
        RETURNING id`;
      // Column defaults: engine version 1, status RECALCULATION_REQUIRED — figures shown, flagged stale.
      const stale = await tx.$queryRaw<Array<{ id: string }>>`
        INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, total_amount)
        VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`FV-${randomUUID()}`}, 'OMR', 7)
        RETURNING id`;
      const [a, b, c] = [written[0].id, never[0].id, stale[0].id];

      const headers = await getOrderFinancialHeaders(t, [a, b, c, a, randomUUID()]);
      expect(Object.keys(headers).sort()).toEqual([a, b, c].sort());
      expect(headers[c]).toMatchObject({ snapshotStatus: 'RECALCULATION_REQUIRED', header: { metrics: { total: 7 } } });
      expect(headers[a]).toMatchObject({ currency: { code: 'OMR', decimalPlaces: 3 }, currencyKnown: true, snapshotStatus: 'CURRENT' });
      expect(headers[a].header).toMatchObject({ metrics: { total: 5, paid: 5, balance: 0 }, balanceState: 'settled' });
      // Never written: no figures, never zeros (PR-09).
      expect(headers[b].header).toEqual({ metrics: {}, balanceState: null, paymentStatus: null, settlementType: null });

      expect(await getOrderFinancialHeaders(randomUUID(), [a, b])).toEqual({});
      expect(await getOrderFinancialHeaders(t, [])).toEqual({});
      const tooMany = Array.from({ length: ORDER_FIN_HEADERS_MAX + 1 }, () => randomUUID());
      await expect(getOrderFinancialHeaders(t, tooMany)).rejects.toThrow(ValidationError);
    });
  });
});
