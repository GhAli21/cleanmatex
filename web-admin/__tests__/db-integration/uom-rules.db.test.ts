/**
 * Live proof of the UoM rules from migrations 0813/0814/0817: seeded units, conversion, whole-count
 * check, quantity scale and the reserved-code guard. Every case runs in a transaction that is thrown
 * away, so nothing is written. Run with npm run test:db-integration; skips when no DB is reachable.
 */
import { prisma } from '@/lib/db/prisma';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const ROLLBACK = new Error('rollback');

/** Runs fn in a transaction and always rolls back; returns fn's result. */
async function inRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let out!: T;
  await prisma.$transaction(async (tx) => { out = await fn(tx); throw ROLLBACK; }).catch((e) => { if (e !== ROLLBACK) throw e; });
  return out;
}

let dbUp = false;
let tenantId = '';

beforeAll(async () => {
  try {
    const rows = await prisma.$queryRaw<Array<{ tenant_org_id: string }>>`
      SELECT tenant_org_id FROM public.org_uom_cf WHERE uom_code = 'KG' AND is_active GROUP BY tenant_org_id LIMIT 1`;
    tenantId = rows[0]?.tenant_org_id ?? '';
    dbUp = !!tenantId;
  } catch { dbUp = false; }
});
afterAll(async () => { await prisma.$disconnect(); });

// Prisma raw errors carry the SQLSTATE (e.g. 23514 check_violation), not the RAISE text.
const rejects = (p: Promise<unknown>, code: string) => expect(p).rejects.toThrow(code);

describe('UoM database rules', () => {
  it('converts kg to g and kg to kg', async () => {
    if (!dbUp) return;
    const r = await inRollback((tx) => tx.$queryRaw<Array<{ g: string; kg: string }>>`
      SELECT public.fn_uom_convert(${tenantId}::uuid, NULL, 2.5, 'KG', 'G', false)::text AS g,
             public.fn_uom_convert(${tenantId}::uuid, NULL, 1, 'KG', 'KG', false)::text AS kg`);
    expect(Number(r[0].g)).toBe(2500);
    expect(Number(r[0].kg)).toBe(1);
  });

  it('refuses a fractional result into a COUNT unit (whole check or missing conversion)', async () => {
    if (!dbUp) return;
    await rejects(
      inRollback((tx) => tx.$queryRaw`SELECT public.fn_uom_convert(${tenantId}::uuid, NULL, 1, 'KG', 'PC', true)`),
      'UOM_',
    );
  });

  it('refuses decimals on a whole-number unit and accepts them on a measured one', async () => {
    if (!dbUp) return;
    await rejects(
      inRollback((tx) => tx.$executeRaw`SELECT public.fn_uom_assert_qty_scale(${tenantId}::uuid, 'PC', 1.5, 'quantity')`),
      '23514',
    );
    await inRollback((tx) => tx.$executeRaw`SELECT public.fn_uom_assert_qty_scale(${tenantId}::uuid, 'KG', 1.5, 'quantity')`);
  });

  it('refuses a quantity in a unit the Organization does not have', async () => {
    if (!dbUp) return;
    await rejects(
      inRollback((tx) => tx.$executeRaw`SELECT public.fn_uom_assert_qty_scale(${tenantId}::uuid, 'NOPE', 1, 'quantity')`),
      '23503',
    );
  });

  it('refuses a custom unit that reuses a system code', async () => {
    if (!dbUp) return;
    await rejects(
      inRollback((tx) => tx.$executeRaw`
        INSERT INTO public.org_uom_cf (tenant_org_id, uom_code, name, symbol, uom_dimension)
        VALUES (${tenantId}::uuid, 'KG', 'Mine', 'kg', 'MASS')`),
      '23505',
    );
  });
});
