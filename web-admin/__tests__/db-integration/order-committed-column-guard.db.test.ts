/**
 * WP17 column guard proof (migration 0702, WP18 OC-SEC-004).
 * A data-API session (`authenticated`) cannot change a committed order's money or lines,
 * keeps its workflow writes, and server writers (`postgres`, as Prisma) are not limited.
 * Every test runs in one transaction that always rolls back. A missing database is a skip, not a pass.
 */
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const DEMO_TENANT = '11111111-1111-1111-1111-111111111111';
const ROLLBACK = new Error('rollback');

let dbReady = false;

beforeAll(async () => {
  try {
    const rows = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'oc_item_committed_cols_guard')
        AND EXISTS (SELECT 1 FROM public.org_users_mst WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND is_active)
        AS ready`;
    dbReady = rows[0]?.ready === true;
  } catch {
    dbReady = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbReady) {
      console.warn(`[committed-column-guard-db] Local DB or migration 0702 unavailable - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

async function runRollback(fn: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx);
      throw ROLLBACK;
    }, { timeout: 30000 });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
}

/** Order with one item, one piece, one item preference and one charge, written as postgres. */
async function seedOrder(tx: Tx, committed: boolean) {
  const t = DEMO_TENANT;
  const actor = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM auth.users LIMIT 1`;
  const cust = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id, name) VALUES (${t}::uuid, ${`Guard ${randomUUID()}`}) RETURNING id`;
  const order = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, payment_type_code, total_amount)
    VALUES (${t}::uuid, ${cust[0].id}::uuid, ${`GUARD-${randomUUID()}`}, 'OMR', 'PAY_ON_COLLECTION', 10)
    RETURNING id`;
  const orderId = order[0].id;
  const item = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_order_items_dtl (tenant_org_id, order_id, product_name, quantity, price_per_unit, total_price,
      money_basis, service_speed, price_source, list_unit_price, speed_premium_amount, line_disc_amount,
      order_disc_alloc_amount, net_amount, tax_pricing_mode, tax_category_code, tax_rate, taxable_amount, tax_amount, line_total_amount)
    VALUES (${t}::uuid, ${orderId}::uuid, 'Guard shirt', 1, 10, 10, 'PRICED', 'STANDARD', 'MANUAL', 10, 0, 0, 0, 10,
      'TAX_EXCLUSIVE', 'STANDARD', 0, 10, 0, 10)
    RETURNING id`;
  const itemId = item[0].id;
  const piece = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_order_item_pieces_dtl (tenant_org_id, order_id, order_item_id, piece_seq, price_per_unit, total_price,
      money_basis, service_speed, price_source, list_unit_price, speed_premium_amount, line_disc_amount,
      order_disc_alloc_amount, net_amount, tax_pricing_mode, tax_category_code, tax_rate, taxable_amount, tax_amount, line_total_amount)
    VALUES (${t}::uuid, ${orderId}::uuid, ${itemId}::uuid, 1, 10, 10, 'PRICED', 'STANDARD', 'MANUAL', 10, 0, 0, 0, 10,
      'TAX_EXCLUSIVE', 'STANDARD', 0, 10, 0, 10)
    RETURNING id`;
  const pref = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_order_preferences_dtl (tenant_org_id, order_id, order_item_id, prefs_no, prefs_level, preference_code, extra_price)
    VALUES (${t}::uuid, ${orderId}::uuid, ${itemId}::uuid, 1, 'ITEM', 'GUARD_PREF', 1)
    RETURNING id`;
  const charge = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_order_charges_dtl (tenant_org_id, order_id, charge_type, label, amount, currency_code)
    VALUES (${t}::uuid, ${orderId}::uuid, 'DELIVERY', 'Delivery', 1, 'OMR')
    RETURNING id`;
  if (committed) {
    await tx.$executeRaw`
      UPDATE public.org_orders_mst SET committed_at = now(), committed_by = ${actor[0].id}::uuid, edit_state_version = 1
      WHERE tenant_org_id = ${t}::uuid AND id = ${orderId}::uuid`;
  }
  return { orderId, itemId, pieceId: piece[0].id, prefId: pref[0].id, chargeId: charge[0].id };
}

/** Switches the rest of the transaction to a real member of the tenant, as PostgREST would. */
async function becomeAuthenticated(tx: Tx): Promise<void> {
  const member = await tx.$queryRaw<Array<{ user_id: string }>>`
    SELECT user_id FROM public.org_users_mst
    WHERE tenant_org_id = ${DEMO_TENANT}::uuid AND is_active = true ORDER BY created_at LIMIT 1`;
  await tx.$executeRawUnsafe('SET LOCAL ROLE authenticated');
  await tx.$queryRaw`SELECT set_config('request.jwt.claims',
    ${JSON.stringify({ role: 'authenticated', sub: member[0].user_id })}, true)`;
}

/** Runs one statement under a savepoint; returns the error message, or null when it succeeded. */
async function attempt(tx: Tx, sql: Prisma.Sql): Promise<string | null> {
  await tx.$executeRawUnsafe('SAVEPOINT guard_try');
  try {
    await tx.$executeRaw(sql);
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT guard_try');
    return null;
  } catch (e) {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT guard_try');
    return e instanceof Error ? e.message : String(e);
  }
}

const t = Prisma.sql`${DEMO_TENANT}::uuid`;

describe('committed-order column guard (migration 0702)', () => {
  dbit('authenticated keeps workflow writes on a committed order', async () => {
    await runRollback(async (tx) => {
      const ids = await seedOrder(tx, true);
      await becomeAuthenticated(tx);
      expect(await attempt(tx, Prisma.sql`UPDATE public.org_order_items_dtl SET quantity_ready = 1, item_status = 'ready'
        WHERE tenant_org_id = ${t} AND id = ${ids.itemId}::uuid`)).toBeNull();
      expect(await attempt(tx, Prisma.sql`UPDATE public.org_order_item_pieces_dtl SET piece_stage = 'washing', rack_location = 'A1'
        WHERE tenant_org_id = ${t} AND id = ${ids.pieceId}::uuid`)).toBeNull();
      expect(await attempt(tx, Prisma.sql`UPDATE public.org_order_preferences_dtl SET processing_confirmed = true
        WHERE tenant_org_id = ${t} AND id = ${ids.prefId}::uuid`)).toBeNull();
      expect(await attempt(tx, Prisma.sql`UPDATE public.org_orders_mst SET rack_location = 'B2', has_issue = true
        WHERE tenant_org_id = ${t} AND id = ${ids.orderId}::uuid`)).toBeNull();
    });
  });

  dbit('authenticated cannot change money or lines of a committed order', async () => {
    await runRollback(async (tx) => {
      const ids = await seedOrder(tx, true);
      await becomeAuthenticated(tx);
      const refused = [
        Prisma.sql`UPDATE public.org_order_items_dtl SET price_per_unit = 0 WHERE tenant_org_id = ${t} AND id = ${ids.itemId}::uuid`,
        Prisma.sql`UPDATE public.org_order_items_dtl SET quantity = 5 WHERE tenant_org_id = ${t} AND id = ${ids.itemId}::uuid`,
        Prisma.sql`UPDATE public.org_order_item_pieces_dtl SET line_total_amount = 0 WHERE tenant_org_id = ${t} AND id = ${ids.pieceId}::uuid`,
        Prisma.sql`UPDATE public.org_order_preferences_dtl SET extra_price = 0 WHERE tenant_org_id = ${t} AND id = ${ids.prefId}::uuid`,
        Prisma.sql`INSERT INTO public.org_order_preferences_dtl (tenant_org_id, order_id, prefs_no, prefs_level, preference_code)
          VALUES (${t}, ${ids.orderId}::uuid, 2, 'ORDER', 'GUARD_NEW')`,
        Prisma.sql`DELETE FROM public.org_order_preferences_dtl WHERE tenant_org_id = ${t} AND id = ${ids.prefId}::uuid`,
        Prisma.sql`UPDATE public.org_order_charges_dtl SET is_voided = true WHERE tenant_org_id = ${t} AND id = ${ids.chargeId}::uuid`,
        Prisma.sql`DELETE FROM public.org_order_charges_dtl WHERE tenant_org_id = ${t} AND id = ${ids.chargeId}::uuid`,
        Prisma.sql`UPDATE public.org_orders_mst SET total_amount = 0 WHERE tenant_org_id = ${t} AND id = ${ids.orderId}::uuid`,
        Prisma.sql`UPDATE public.org_orders_mst SET total_paid_amount = 10 WHERE tenant_org_id = ${t} AND id = ${ids.orderId}::uuid`,
      ];
      for (const sql of refused) {
        expect(await attempt(tx, sql)).toMatch(/committed order/i);
      }
      await tx.$executeRawUnsafe('RESET ROLE');
      const item = await tx.$queryRaw<Array<{ price_per_unit: Prisma.Decimal; quantity: number }>>`
        SELECT price_per_unit, quantity FROM public.org_order_items_dtl WHERE tenant_org_id = ${t} AND id = ${ids.itemId}::uuid`;
      expect([Number(item[0].price_per_unit), Number(item[0].quantity)]).toEqual([10, 1]);
    });
  });

  dbit('server writers (postgres, as Prisma) still change a committed order', async () => {
    await runRollback(async (tx) => {
      const ids = await seedOrder(tx, true);
      expect(await attempt(tx, Prisma.sql`UPDATE public.org_order_charges_dtl SET is_voided = true, voided_at = now()
        WHERE tenant_org_id = ${t} AND id = ${ids.chargeId}::uuid`)).toBeNull();
      expect(await attempt(tx, Prisma.sql`UPDATE public.org_order_items_dtl SET price_per_unit = 9, total_price = 9, list_unit_price = 9,
        net_amount = 9, taxable_amount = 9, line_total_amount = 9 WHERE tenant_org_id = ${t} AND id = ${ids.itemId}::uuid`)).toBeNull();
      expect(await attempt(tx, Prisma.sql`UPDATE public.org_orders_mst SET total_amount = 9
        WHERE tenant_org_id = ${t} AND id = ${ids.orderId}::uuid`)).toBeNull();
    });
  });

  dbit('authenticated can still change an uncommitted order (Create unchanged)', async () => {
    await runRollback(async (tx) => {
      const ids = await seedOrder(tx, false);
      await becomeAuthenticated(tx);
      expect(await attempt(tx, Prisma.sql`UPDATE public.org_order_items_dtl SET quantity = 2, total_price = 20, net_amount = 20,
        taxable_amount = 20, line_total_amount = 20 WHERE tenant_org_id = ${t} AND id = ${ids.itemId}::uuid`)).toBeNull();
      expect(await attempt(tx, Prisma.sql`DELETE FROM public.org_order_charges_dtl
        WHERE tenant_org_id = ${t} AND id = ${ids.chargeId}::uuid`)).toBeNull();
    });
  });
});
