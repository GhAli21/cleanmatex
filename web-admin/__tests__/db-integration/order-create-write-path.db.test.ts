/**
 * Order-create write path measurement (Cart Line Grouping PF,
 * docs/features/Order_Cart_Line_Grouping/DESIGN.md §9.2).
 *
 * A measurement, not a regression test: it is skipped unless `PF_MEASURE=1`. It creates orders of three
 * sizes through the shared quoted-create path on local PostgreSQL, counts the SQL statements and times the
 * create transaction, optionally through a TCP proxy that adds network latency. Every order is rolled back.
 *
 * Run: PF_MEASURE=1 PF_RTT_MS=0,2,10 npx jest --config jest.db.config.js order-create-write-path
 */
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import type { Prisma } from '@prisma/client';

jest.mock('server-only', () => ({}));
// Route every `prisma` read to the open fixture transaction, on the client that goes through the proxy.
jest.mock('@/lib/db/prisma', () => {
  const routed = new Proxy({}, {
    get(_target, prop) {
      const scope = globalThis as { __pfTx?: Record<string | symbol, unknown>; __pfClient?: Record<string | symbol, unknown> };
      if (scope.__pfTx && prop === '$transaction') {
        return async (arg: unknown) => (typeof arg === 'function' ? (arg as (t: unknown) => unknown)(scope.__pfTx) : Promise.all(arg as unknown[]));
      }
      if (scope.__pfTx && prop !== '$disconnect' && prop in scope.__pfTx) return scope.__pfTx[prop];
      return scope.__pfClient?.[prop];
    },
  });
  return { prisma: routed, default: routed };
});
jest.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }));
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({}), supabase: {} }));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  ...jest.requireActual('@/lib/services/tenant-settings.service'),
  createTenantSettingsService: () => ({ getCurrencyConfig: async () => ({ currencyCode: 'OMR', decimalPlaces: 3 }) }),
}));

import { PrismaClient } from '@prisma/client';
import type { CreateOrderParams } from '@/lib/services/order-service';
import { createUnpaidOrderFromCheckoutTx } from '@/lib/services/order-create-from-checkout.service';
import { quoteCheckout } from '@/lib/services/commercial/commercial-checkout.service';
import type { CommercialDb } from '@/lib/services/commercial/commercial-context.loader';

const ROLLBACK = 'PF_MEASURE_ROLLBACK';
const RUNS = Number(process.env.PF_RUNS ?? 10);
const RTTS = (process.env.PF_RTT_MS ?? '0').split(',').map(Number);

/** `heavy` gives every line a preference and every piece a preference, two conditions and a colour. */
const SHAPES = [
  { name: 'small', lines: 5, pieces: 10, heavy: false },
  { name: 'typical-large', lines: 30, pieces: 60, heavy: false },
  { name: 'heavy', lines: 60, pieces: 150, heavy: true },
] as const;

/** Adds `rttMs` of round-trip latency in front of local PostgreSQL (half in each direction, order kept). */
async function delayProxy(targetPort: number, rttMs: number): Promise<{ port: number; close: () => void }> {
  const sockets = new Set<net.Socket>();
  const server = net.createServer((client) => {
    const upstream = net.connect(targetPort, '127.0.0.1');
    for (const [from, to] of [[client, upstream], [upstream, client]]) {
      from.setNoDelay(true);
      sockets.add(from);
      from.on('data', (chunk) => {
        const send = () => { if (!to.destroyed) to.write(chunk); };
        if (rttMs > 0) setTimeout(send, rttMs / 2); else send();
      });
      from.on('error', () => to.destroy());
      from.on('close', () => to.destroy());
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as net.AddressInfo).port,
    close: () => { sockets.forEach((socket) => socket.destroy()); server.close(); },
  };
}

const percentile = (values: number[], p: number) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(p * values.length) - 1)];
const statementOf = (sql: string) => {
  const verb = sql.trim().split(/\s+/)[0].toUpperCase();
  const table = /(?:INTO|UPDATE|FROM)\s+(?:"public"\.|public\.)?"?([a-z_]+)"?/i.exec(sql)?.[1];
  return table ? `${verb} ${table}` : verb;
};

const describeMeasure = process.env.PF_MEASURE === '1' ? describe : describe.skip;

describeMeasure('order create write path (local PostgreSQL)', () => {
  it('measures statements and transaction time per order shape', async () => {
    const base = new URL(process.env.DATABASE_URL ?? '');
    if (!['localhost', '127.0.0.1'].includes(base.hostname) || base.port !== '54322') {
      throw new Error('The measurement requires local Supabase on port 54322');
    }
    const report: Array<Record<string, unknown>> = [];

    for (const rtt of RTTS) {
      const proxy = await delayProxy(54322, rtt);
      const url = new URL(base);
      url.hostname = '127.0.0.1';
      url.port = String(proxy.port);
      const client = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [{ emit: 'event', level: 'query' }] });
      const statements: string[] = [];
      client.$on('query' as never, ((event: { query: string }) => { statements.push(event.query); }) as never);
      (globalThis as { __pfClient?: unknown }).__pfClient = client;
      try {
        await client.$queryRaw`SELECT 1`;
        const pings: number[] = [];
        for (let i = 0; i < 10; i += 1) {
          const start = performance.now();
          await client.$queryRaw`SELECT 1`;
          pings.push(performance.now() - start);
        }
        const tenantId = (await client.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM public.org_tenants_mst
          WHERE (name ILIKE '%test%' OR name ILIKE '%demo%' OR name ILIKE '%sandbox%') AND timezone IS NOT NULL
          ORDER BY id LIMIT 1`)[0]?.id;
        const actorId = (await client.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth.users ORDER BY id LIMIT 1`)[0]?.id;
        if (!tenantId || !actorId) throw new Error('The measurement requires a demo organization and an application actor');

        for (const shape of SHAPES) {
          const createMs: number[] = [];
          const quoteMs: number[] = [];
          let createStatements: string[] = [];
          for (let run = 0; run < RUNS; run += 1) {
            await expect(client.$transaction(async (tx: Prisma.TransactionClient) => {
              (globalThis as { __pfTx?: unknown }).__pfTx = tx;
              try {
                const customerId = randomUUID();
                const productId = randomUUID();
                await tx.$executeRaw`
                  INSERT INTO public.org_customers_mst(id, tenant_org_id, name, customer_code)
                  VALUES (${customerId}::uuid, ${tenantId}::uuid, 'Write path measurement', ${`PF-C-${customerId.slice(0, 8)}`})`;
                await tx.$executeRaw`
                  INSERT INTO public.org_product_data_mst(id, tenant_org_id, product_code, product_name, service_category_code, price_type,
                    default_sell_price, turnaround_hh, tax_category_code, is_active, rec_status)
                  VALUES (${productId}::uuid, ${tenantId}::uuid, ${`PF-${productId.slice(0, 8)}`}, 'Write path shirt', 'WASH_AND_IRON', 'PER_UNIT', 2, 24, 'STANDARD', true, 1)`;
                const pref = (await tx.$queryRaw<Array<{ id: string; preference_code: string }>>`
                  SELECT id, preference_code FROM public.org_service_preference_cf
                  WHERE tenant_org_id = ${tenantId}::uuid AND preference_sys_kind = 'service_prefs' AND is_active = true AND branch_id IS NULL
                  ORDER BY preference_code LIMIT 1`)[0];
                if (shape.heavy && !pref) throw new Error('The heavy shape requires one service preference');
                const prefs = shape.heavy ? [{ preference_code: pref.preference_code, source: 'manual', extra_price: 0, preferenceCfId: pref.id }] : undefined;

                // Pieces spread evenly over the lines: the first lines take the remainder.
                const lines = Array.from({ length: shape.lines }, (_, i) =>
                  Math.floor(shape.pieces / shape.lines) + (i < shape.pieces % shape.lines ? 1 : 0));
                const items: CreateOrderParams['items'] = lines.map((quantity) => ({
                  productId, quantity, pricePerUnit: 0, totalPrice: 0, servicePrefs: prefs,
                  pieces: Array.from({ length: quantity }, (_, k) => ({
                    pieceSeq: k + 1,
                    ...(shape.heavy ? { servicePrefs: prefs, conditions: ['coffee', 'button_missing'], colorCodes: ['white'] } : {}),
                  })),
                }));

                let start = performance.now();
                const checkout = await quoteCheckout({
                  db: tx as unknown as CommercialDb, tenantId, customerId,
                  items: items.map((item) => ({
                    productId, quantity: item.quantity,
                    servicePrefs: prefs?.map((p) => ({ preference_code: p.preference_code })),
                    pieces: item.pieces?.map(() => ({ servicePrefs: prefs?.map((p) => ({ preference_code: p.preference_code })) })),
                  })),
                });
                quoteMs.push(performance.now() - start);

                await new Promise((resolve) => setImmediate(resolve));
                const before = statements.length;
                start = performance.now();
                await createUnpaidOrderFromCheckoutTx(tx as never, {
                  tenantId, checkout, committedBy: null, issuedBy: customerId,
                  order: { customerId, orderTypeId: 'POS', userId: actorId, userName: 'Measurement', paymentTypeCode: 'PAY_ON_COLLECTION', items },
                });
                createMs.push(performance.now() - start);
                await new Promise((resolve) => setImmediate(resolve));
                createStatements = statements.slice(before);
              } finally {
                delete (globalThis as { __pfTx?: unknown }).__pfTx;
              }
              throw new Error(ROLLBACK);
            }, { maxWait: 10000, timeout: 120000 })).rejects.toThrow(ROLLBACK);
          }
          const byStatement = createStatements.reduce<Record<string, number>>((tally, sql) => {
            const key = statementOf(sql);
            tally[key] = (tally[key] ?? 0) + 1;
            return tally;
          }, {});
          report.push({
            rttMs: rtt, measuredPingMs: Math.round(percentile(pings, 0.5) * 10) / 10, shape: shape.name,
            lines: shape.lines, pieces: shape.pieces, statements: createStatements.length,
            createP50Ms: Math.round(percentile(createMs, 0.5)), createP95Ms: Math.round(percentile(createMs, 0.95)),
            quoteP50Ms: Math.round(percentile(quoteMs, 0.5)),
            top: Object.entries(byStatement).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${n}× ${k}`),
          });
          process.stdout.write(`PF ${JSON.stringify(report[report.length - 1])}\n`);
        }
      } finally {
        await client.$disconnect();
        proxy.close();
      }
    }
    expect(report).toHaveLength(RTTS.length * SHAPES.length);
  }, 3_600_000);
});
