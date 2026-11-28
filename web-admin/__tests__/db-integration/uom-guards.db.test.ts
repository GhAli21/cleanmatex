/**
 * Live proof of the unit guards PLAN §3.14 lists (0813 / 0814): tenant isolation, seeding and HQ sync,
 * reset to system, locked fields, units in use, restricted deletes, conversion rules and the
 * billed-measure checks. Every case runs in a transaction that is always rolled back.
 * Run with npm run test:db-integration; skips when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const ROLLBACK = new Error('rollback');

/** Runs fn in a transaction and always rolls back; returns fn's result. */
async function inRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let out!: T;
  await prisma.$transaction(async (tx) => { out = await fn(tx); throw ROLLBACK; }, { timeout: 60_000 })
    .catch((e) => { if (e !== ROLLBACK) throw e; });
  return out;
}

// Prisma raw errors carry the SQLSTATE, not the RAISE text.
const CHECK_VIOLATION = '23514';
const FK_VIOLATION = '23503';
const NO_PRIVILEGE = '42501';

interface Member { orgUserId: string; userId: string; tenantId: string }

let member: Member | undefined;
let tenantId = '';

beforeAll(async () => {
  try {
    const members = await prisma.$queryRaw<Array<{ org_user_id: string; user_id: string; tenant_org_id: string }>>`
      SELECT ou.id AS org_user_id, ou.user_id, ou.tenant_org_id
        FROM public.org_users_mst ou
        JOIN public.sys_users_mst su ON su.id = ou.user_id
       WHERE ou.is_active AND NOT ou.is_membership_locked AND NOT su.is_globally_locked
         AND (su.attack_locked_until IS NULL OR su.attack_locked_until <= now())
         AND EXISTS (SELECT 1 FROM public.org_uom_cf u WHERE u.tenant_org_id = ou.tenant_org_id)
         AND EXISTS (SELECT 1 FROM public.org_uom_cf o WHERE o.tenant_org_id <> ou.tenant_org_id)
       ORDER BY ou.tenant_org_id, ou.id LIMIT 1`;
    const found = members[0];
    member = found && { orgUserId: found.org_user_id, userId: found.user_id, tenantId: found.tenant_org_id };
    tenantId = member?.tenantId ?? '';
  } catch { tenantId = ''; }
});
afterAll(async () => { await prisma.$disconnect(); });

/** A case that needs the local database; it says so when it cannot run. */
function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!tenantId) { console.warn(`SKIPPED (no local database or member): ${name}`); return; }
    await fn();
  }, 90_000);
}

/** Signs the transaction in as the member, bound by row security like a real request. */
async function signIn(tx: Tx, who: Member): Promise<void> {
  const sessionId = randomUUID();
  await tx.$executeRaw`
    INSERT INTO public.sys_auth_user_sessions_mst (auth_session_id, auth_user_id, tenant_org_id, org_user_id, status, expires_at)
    VALUES (${sessionId}::uuid, ${who.userId}::uuid, ${who.tenantId}::uuid, ${who.orgUserId}::uuid, 'ACTIVE', now() + interval '1 hour')`;
  await tx.$executeRaw`SET LOCAL ROLE authenticated`;
  await tx.$executeRaw`SELECT set_config('request.jwt.claims',
    ${JSON.stringify({ sub: who.userId, session_id: sessionId, role: 'authenticated' })}, true)`;
}

/** The unit row of the Organization. */
const unit = async (tx: Tx, code: string) => (await tx.$queryRaw<Array<{ name: string; unece_code: string | null; is_customized: boolean; is_active: boolean }>>`
  SELECT name, unece_code, is_customized, is_active FROM public.org_uom_cf WHERE tenant_org_id = ${tenantId}::uuid AND uom_code = ${code}`)[0];

/** The Organization-wide rate from → to, as text. */
const rate = async (tx: Tx, from: string, to: string) => (await tx.$queryRaw<Array<{ m: string; is_customized: boolean; id: string }>>`
  SELECT id, multiply_rate::text AS m, is_customized FROM public.org_uom_conv_cf
   WHERE tenant_org_id = ${tenantId}::uuid AND product_id IS NULL AND from_uom_code = ${from} AND to_uom_code = ${to}`)[0];

const addProduct = async (tx: Tx, unitCode: string) => (await tx.$queryRaw<Array<{ id: string }>>`
  INSERT INTO public.org_product_data_mst (tenant_org_id, service_category_code, product_code, product_name, base_uom_code)
  SELECT ${tenantId}::uuid, service_category_code, ${`UG-${randomUUID().slice(0, 8)}`}, 'Guard proof', ${unitCode}
    FROM public.org_service_category_cf WHERE tenant_org_id = ${tenantId}::uuid ORDER BY service_category_code LIMIT 1
  RETURNING id`)[0].id;

describe('Unit guards (local PostgreSQL)', () => {
  dbit('a signed-in member reads only their Organization\'s units and conversions', async () => {
    const seen = await inRollback(async (tx) => {
      await signIn(tx, member!);
      return (await tx.$queryRaw<Array<{ own_units: number; other_units: number; own_pairs: number; other_pairs: number }>>`
        SELECT
          (SELECT count(*)::int FROM public.org_uom_cf WHERE tenant_org_id = ${tenantId}::uuid) AS own_units,
          (SELECT count(*)::int FROM public.org_uom_cf WHERE tenant_org_id <> ${tenantId}::uuid) AS other_units,
          (SELECT count(*)::int FROM public.org_uom_conv_cf WHERE tenant_org_id = ${tenantId}::uuid) AS own_pairs,
          (SELECT count(*)::int FROM public.org_uom_conv_cf WHERE tenant_org_id <> ${tenantId}::uuid) AS other_pairs`)[0];
    });
    expect(seen.own_units).toBeGreaterThan(0);
    expect(seen.own_pairs).toBeGreaterThan(0);
    expect([seen.other_units, seen.other_pairs]).toEqual([0, 0]);
  });

  dbit('a signed-in member cannot write units or conversions directly', async () => {
    await expect(inRollback(async (tx) => {
      await signIn(tx, member!);
      await tx.$executeRaw`UPDATE public.org_uom_cf SET name = 'x' WHERE tenant_org_id = ${tenantId}::uuid AND uom_code = 'KG'`;
    })).rejects.toThrow(NO_PRIVILEGE);
    await expect(inRollback(async (tx) => {
      await signIn(tx, member!);
      await tx.$executeRaw`DELETE FROM public.org_uom_conv_cf WHERE tenant_org_id = ${tenantId}::uuid`;
    })).rejects.toThrow(NO_PRIVILEGE);
  });

  dbit('seeding twice adds nothing; HQ changes reach copies but keep the Organization\'s own wording and rates', async () => {
    const out = await inRollback(async (tx) => {
      await tx.$queryRaw`SELECT public.fn_uom_seed_tenant(${tenantId}::uuid, ARRAY['G', 'KG', 'MM', 'M']::text[])`;
      const [again] = await tx.$queryRaw<Array<{ added: number }>>`
        SELECT public.fn_uom_seed_tenant(${tenantId}::uuid, ARRAY['G', 'KG', 'MM', 'M']::text[]) AS added`;
      // The Organization renames kilogram and re-rates gram → kilogram.
      await tx.$executeRaw`UPDATE public.org_uom_cf SET name = 'Our kilo' WHERE tenant_org_id = ${tenantId}::uuid AND uom_code = 'KG'`;
      await tx.$executeRaw`UPDATE public.org_uom_conv_cf SET multiply_rate = 0.002, divide_rate = 500
        WHERE tenant_org_id = ${tenantId}::uuid AND product_id IS NULL AND from_uom_code = 'G' AND to_uom_code = 'KG'`;
      // HQ changes both units (wording and e-invoice code) and both rates; its triggers sync every Organization.
      await tx.$executeRaw`UPDATE public.sys_uom_cd SET name = 'HQ kilogram', unece_code = 'ZZ1' WHERE uom_code = 'KG'`;
      await tx.$executeRaw`UPDATE public.sys_uom_cd SET name = 'HQ gram' WHERE uom_code = 'G'`;
      await tx.$executeRaw`UPDATE public.sys_uom_conv_cd SET multiply_rate = 0.004, divide_rate = 250 WHERE from_uom_code = 'G' AND to_uom_code = 'KG'`;
      await tx.$executeRaw`UPDATE public.sys_uom_conv_cd SET multiply_rate = 0.005, divide_rate = 200 WHERE from_uom_code = 'MM' AND to_uom_code = 'M'`;
      const synced = {
        added: again.added, kg: await unit(tx, 'KG'), g: await unit(tx, 'G'),
        own: await rate(tx, 'G', 'KG'), followed: await rate(tx, 'MM', 'M'),
      };
      // Reset to system gives the HQ values back.
      await tx.$executeRaw`SELECT public.fn_uom_reset_unit(${tenantId}::uuid, 'KG', 'guard-test')`;
      await tx.$executeRaw`SELECT public.fn_uom_reset_conv(${tenantId}::uuid, ${synced.own.id}::uuid, 'guard-test')`;
      return { ...synced, kgReset: await unit(tx, 'KG'), rateReset: await rate(tx, 'G', 'KG') };
    });

    expect(out.added).toBe(0);
    expect(out.kg).toMatchObject({ name: 'Our kilo', unece_code: 'ZZ1', is_customized: true });
    expect(out.g).toMatchObject({ name: 'HQ gram', is_customized: false });
    expect([Number(out.own.m), out.own.is_customized]).toEqual([0.002, true]);
    expect([Number(out.followed.m), out.followed.is_customized]).toEqual([0.005, false]);
    expect(out.kgReset).toMatchObject({ name: 'HQ kilogram', is_customized: false });
    expect([Number(out.rateReset.m), out.rateReset.is_customized]).toEqual([0.004, false]);
  });

  dbit('HQ-owned and identity fields cannot be changed by an Organization', async () => {
    for (const change of [
      (tx: Tx) => tx.$executeRaw`UPDATE public.org_uom_cf SET unece_code = 'ZZ9' WHERE tenant_org_id = ${tenantId}::uuid AND uom_code = 'KG'`,
      (tx: Tx) => tx.$executeRaw`UPDATE public.org_uom_cf SET uom_dimension = 'LENGTH' WHERE tenant_org_id = ${tenantId}::uuid AND uom_code = 'KG'`,
      (tx: Tx) => tx.$executeRaw`UPDATE public.org_uom_cf SET uom_code = 'KILO' WHERE tenant_org_id = ${tenantId}::uuid AND uom_code = 'KG'`,
      (tx: Tx) => tx.$executeRaw`UPDATE public.org_uom_conv_cf SET is_from_system = false
        WHERE tenant_org_id = ${tenantId}::uuid AND is_from_system`,
    ]) {
      await expect(inRollback(change)).rejects.toThrow(CHECK_VIOLATION);
    }
  });

  dbit('a unit in use stays on, an unused one can be switched off, and a product cannot take it then', async () => {
    const off = (tx: Tx) => tx.$executeRaw`UPDATE public.org_uom_cf SET is_active = false WHERE tenant_org_id = ${tenantId}::uuid AND uom_code = 'MIN'`;
    const seedMinute = (tx: Tx) => tx.$queryRaw`SELECT public.fn_uom_seed_tenant(${tenantId}::uuid, ARRAY['MIN']::text[])`;

    await expect(inRollback(async (tx) => { await seedMinute(tx); await addProduct(tx, 'MIN'); await off(tx); })).rejects.toThrow(CHECK_VIOLATION);
    const free = await inRollback(async (tx) => {
      await seedMinute(tx);
      await tx.$executeRaw`DELETE FROM public.org_product_data_mst WHERE tenant_org_id = ${tenantId}::uuid AND base_uom_code = 'MIN'`;
      await off(tx);
      return unit(tx, 'MIN');
    });
    expect(free.is_active).toBe(false);
    await expect(inRollback(async (tx) => {
      await seedMinute(tx);
      await tx.$executeRaw`DELETE FROM public.org_product_data_mst WHERE tenant_org_id = ${tenantId}::uuid AND base_uom_code = 'MIN'`;
      await off(tx);
      await addProduct(tx, 'MIN');
    })).rejects.toThrow(CHECK_VIOLATION);
  });

  dbit('referenced units and products cannot be deleted', async () => {
    // A unit with a conversion.
    await expect(inRollback((tx) => tx.$executeRaw`
      DELETE FROM public.org_uom_cf WHERE tenant_org_id = ${tenantId}::uuid AND uom_code = 'G'`)).rejects.toThrow(FK_VIOLATION);
    // A product with its own conversion.
    await expect(inRollback(async (tx) => {
      await tx.$queryRaw`SELECT public.fn_uom_seed_tenant(${tenantId}::uuid, ARRAY['BOX']::text[])`;
      const productId = await addProduct(tx, 'PC');
      await tx.$executeRaw`INSERT INTO public.org_uom_conv_cf (tenant_org_id, product_id, from_uom_code, to_uom_code, multiply_rate, divide_rate)
        VALUES (${tenantId}::uuid, ${productId}::uuid, 'BOX', 'PC', 4, 0.25)`;
      await tx.$executeRaw`DELETE FROM public.org_product_data_mst WHERE tenant_org_id = ${tenantId}::uuid AND id = ${productId}::uuid`;
    })).rejects.toThrow(FK_VIOLATION);
  });

  dbit('conversion rules: reciprocal rates, one measure, no packs Organization-wide', async () => {
    const pair = (from: string, to: string, multiply: number, divide: number) => inRollback(async (tx) => {
      await tx.$queryRaw`SELECT public.fn_uom_seed_tenant(${tenantId}::uuid, ARRAY['BOX', 'PC', 'KG', 'M']::text[])`;
      await tx.$executeRaw`DELETE FROM public.org_uom_conv_cf WHERE tenant_org_id = ${tenantId}::uuid AND product_id IS NULL
        AND LEAST(from_uom_code, to_uom_code) = LEAST(${from}, ${to}) AND GREATEST(from_uom_code, to_uom_code) = GREATEST(${from}, ${to})`;
      await tx.$executeRaw`INSERT INTO public.org_uom_conv_cf (tenant_org_id, from_uom_code, to_uom_code, multiply_rate, divide_rate)
        VALUES (${tenantId}::uuid, ${from}, ${to}, ${multiply}::numeric, ${divide}::numeric)`;
    });
    await expect(pair('G', 'KG', 12, 1)).rejects.toThrow(CHECK_VIOLATION);
    await expect(pair('KG', 'M', 1, 1)).rejects.toThrow(CHECK_VIOLATION);
    await expect(pair('BOX', 'PC', 12, 0.083333333333)).rejects.toThrow(CHECK_VIOLATION);
  });

  dbit('the database accepts only the billed quantity the rules give', async () => {
    /** One kg line with minimum 3 and step 0.5 on a throwaway order. */
    const line = (measured: number | null, billed: number | null, options: { unitCode?: string; length?: number; width?: number } = {}) =>
      inRollback(async (tx) => {
        const unitCode = options.unitCode ?? 'KG';
        const minimum = unitCode === 'KG' ? 3 : null;
        const step = unitCode === 'KG' ? 0.5 : null;
        await tx.$queryRaw`SELECT public.fn_uom_seed_tenant(${tenantId}::uuid, ARRAY['KG', 'SQM', 'SQFT', 'PC']::text[])`;
        const [customer] = await tx.$queryRaw<Array<{ id: string }>>`
          INSERT INTO public.org_customers_mst (tenant_org_id, customer_code) VALUES (${tenantId}::uuid, ${randomUUID()}) RETURNING id`;
        const [order] = await tx.$queryRaw<Array<{ id: string }>>`
          INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code)
          VALUES (${tenantId}::uuid, ${customer.id}::uuid, ${`UG-${randomUUID()}`}, 'OMR') RETURNING id`;
        await tx.$executeRaw`
          INSERT INTO public.org_order_items_dtl (tenant_org_id, order_id, price_per_unit, total_price, quantity, money_basis,
            service_speed, price_source, list_unit_price, speed_premium_amount, line_disc_amount, order_disc_alloc_amount,
            net_amount, tax_pricing_mode, tax_category_code, tax_rate, taxable_amount, tax_amount, line_total_amount,
            uom_code, min_billable_qty, billing_increment, measured_qty, billed_qty, measure_length, measure_width)
          VALUES (${tenantId}::uuid, ${order.id}::uuid, 1, 1, 1, 'PRICED', 'STANDARD', 'MANUAL', 1, 0, 0, 0,
            1, 'TAX_EXCLUSIVE', 'STANDARD', 0, 1, 0, 1,
            ${unitCode}, ${minimum}::numeric, ${step}::numeric, ${measured}::numeric, ${billed}::numeric,
            ${options.length ?? null}::numeric, ${options.width ?? null}::numeric)`;
        return true;
      });

    await expect(line(1.8, 3)).resolves.toBe(true);
    await expect(line(3.2, 3.5)).resolves.toBe(true);
    await expect(line(1.8, 1.8)).rejects.toThrow(CHECK_VIOLATION); // under the minimum
    await expect(line(3.2, 3.2)).rejects.toThrow(CHECK_VIOLATION); // not on a step
    await expect(line(3.2, 4)).rejects.toThrow(CHECK_VIOLATION); // past the next step
    await expect(line(2, null)).rejects.toThrow(CHECK_VIOLATION); // measured but nothing billed
    await expect(line(1.2345, 3)).rejects.toThrow(CHECK_VIOLATION); // more decimals than kg allows
    await expect(line(6, 6, { unitCode: 'SQM', length: 2, width: 3 })).resolves.toBe(true);
    await expect(line(2, 2, { unitCode: 'PC' })).rejects.toThrow(CHECK_VIOLATION); // a count line is not measured
    await expect(line(80, 80, { unitCode: 'SQFT', length: 8, width: 10 })).resolves.toBe(true); // feet on square feet

    // 0860: any area unit; the area is typed or worked out from a size kept in metres.
    const [catalog] = await prisma.$queryRaw<Array<{ applied: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM public.sys_uom_cd WHERE uom_code = 'HA') AS applied`;
    if (!catalog.applied) { console.warn('SKIPPED 0860 cases (migration 0860 not applied here)'); return; }
    await expect(line(6, 6, { unitCode: 'SQM' })).resolves.toBe(true); // area typed, no size
    await expect(line(64.58, 64.58, { unitCode: 'SQFT', length: 2, width: 3 })).resolves.toBe(true); // 2 m × 3 m in ft²
    await expect(line(6, 6, { unitCode: 'SQM', length: 2 })).rejects.toThrow(CHECK_VIOLATION); // one side only
    await expect(line(6.123, 6.123, { unitCode: 'SQM' })).rejects.toThrow(CHECK_VIOLATION); // more decimals than m² allows
  });

  dbit('the system catalog offers the common area units, each converting to square metres (0860)', async () => {
    const rows = await prisma.$queryRaw<Array<{ uom_code: string; ok: boolean }>>`
      SELECT u.uom_code, (c.multiply_rate * c.divide_rate - 1) BETWEEN -0.000001 AND 0.000001 AS ok
        FROM public.sys_uom_cd u JOIN public.sys_uom_conv_cd c ON c.from_uom_code = u.uom_code AND c.to_uom_code = 'SQM'
       WHERE u.uom_code IN ('SQMM', 'SQCM', 'SQIN', 'SQYD', 'ARE', 'HA', 'ACRE') AND u.uom_dimension = 'AREA' AND NOT u.is_to_seed`;
    if (rows.length === 0) { console.warn('SKIPPED (migration 0860 not applied here)'); return; }
    expect(rows.map((r) => r.uom_code).sort()).toEqual(['ACRE', 'ARE', 'HA', 'SQCM', 'SQIN', 'SQMM', 'SQYD']);
    expect(rows.every((r) => r.ok)).toBe(true);
  });
});
