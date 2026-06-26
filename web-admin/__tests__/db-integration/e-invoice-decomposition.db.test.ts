/**
 * F-05 completion — resolveOrderTaxDecomposition live wiring (DB-level).
 *
 * Proves the real decomposition reads the per-category base columns the financial
 * recalc maintains on `org_orders_mst` (taxable / exempt / zero_rated / out_of_scope)
 * and is gated by the tenant e-invoice activation window:
 *   - ENABLED + order on/after start  → active, faithful mixed-category buckets that reconcile
 *   - DISABLED tenant                 → not active, zeroed buckets (flat-VAT flow unchanged)
 *
 * All writes (tenant-flag flip + order seed) run inside a rolled-back tx — nothing
 * persists. Skips when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import { resolveOrderTaxDecomposition } from '@/lib/services/e-invoice.service';
import { TAX_CATEGORY } from '@/lib/constants/e-invoice';
import { randomUUID } from 'node:crypto';

let dbUp = false;
let tenantA = '';

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
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

const ROLLBACK = Symbol('einv-decomp-rollback');
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
async function runRollback(fn: (tx: TxClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx as TxClient);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
}
function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[e-invoice-decomposition] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

async function seedOrderWithBases(
  tx: TxClient,
  bases: { taxable: number; exempt: number; zeroRated: number; outOfScope: number },
): Promise<string> {
  const cust = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${tenantA}::uuid) RETURNING id`;
  const order = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst
      (tenant_org_id, customer_id, order_no, currency_code,
       taxable_amount, exempt_amount, zero_rated_amount, out_of_scope_amount)
    VALUES (${tenantA}::uuid, ${cust[0].id}::uuid, ${`EINV-${randomUUID()}`}, 'OMR',
       ${bases.taxable}, ${bases.exempt}, ${bases.zeroRated}, ${bases.outOfScope})
    RETURNING id`;
  return order[0].id;
}

describe('resolveOrderTaxDecomposition (DB-level)', () => {
  dbit('ENABLED tenant + mixed-category order → active, faithful buckets that reconcile', async () => {
    let result: Awaited<ReturnType<typeof resolveOrderTaxDecomposition>> | null = null;
    await runRollback(async (tx) => {
      await tx.$executeRaw`
        UPDATE public.org_tenants_mst
        SET is_e_invoice_enabled = true, e_invoice_enabled_start_date = DATE '2020-01-01'
        WHERE id = ${tenantA}::uuid`;
      const orderId = await seedOrderWithBases(tx, { taxable: 100, exempt: 20, zeroRated: 30, outOfScope: 5 });
      result = await resolveOrderTaxDecomposition(tx, tenantA, orderId);
    });
    expect(result).not.toBeNull();
    const r = result!;
    expect(r.active).toBe(true);
    expect(r.decomposition[TAX_CATEGORY.STANDARD]).toBeCloseTo(100, 5);
    expect(r.decomposition[TAX_CATEGORY.EXEMPT]).toBeCloseTo(20, 5);
    expect(r.decomposition[TAX_CATEGORY.ZERO_RATED]).toBeCloseTo(30, 5);
    expect(r.decomposition[TAX_CATEGORY.OUT_OF_SCOPE]).toBeCloseTo(5, 5);
    expect(r.reconciliation.ok).toBe(true);
  });

  dbit('DISABLED tenant → not active, zeroed decomposition (flat-VAT flow unchanged)', async () => {
    let result: Awaited<ReturnType<typeof resolveOrderTaxDecomposition>> | null = null;
    await runRollback(async (tx) => {
      await tx.$executeRaw`
        UPDATE public.org_tenants_mst
        SET is_e_invoice_enabled = false, e_invoice_enabled_start_date = NULL
        WHERE id = ${tenantA}::uuid`;
      const orderId = await seedOrderWithBases(tx, { taxable: 100, exempt: 20, zeroRated: 30, outOfScope: 5 });
      result = await resolveOrderTaxDecomposition(tx, tenantA, orderId);
    });
    const r = result!;
    expect(r.active).toBe(false);
    expect(r.decomposition[TAX_CATEGORY.STANDARD]).toBe(0);
    expect(r.decomposition[TAX_CATEGORY.EXEMPT]).toBe(0);
  });
});
