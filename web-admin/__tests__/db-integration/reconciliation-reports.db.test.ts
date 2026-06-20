/**
 * D-09 — reconciliation report DB-integration smoke (F-T5 harness).
 *
 * Exercises the four reconciliation report service functions against the REAL
 * local Supabase DB (raw `$queryRaw` for B2B/overpayment can only be validated
 * live — a mocked Prisma never compiles or runs the SQL). Asserts two things the
 * unit tests cannot:
 *
 *   1. Each query is syntactically valid against the applied schema and returns
 *      the documented shape (no throw, summary present, rows is an array).
 *   2. Tenant isolation: for a random non-existent tenant every report is empty
 *      — the explicit `tenant_org_id` WHERE filter is the isolation boundary for
 *      the raw-SQL reports that bypass Prisma's tenant middleware.
 *
 * Gating: skips cleanly when no local DB is reachable (dev without the stack / CI
 * without a DB). Read-only — nothing is written.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import { randomUUID } from 'node:crypto';
import {
  getExcessLiabilityReport,
  getB2bStatementReconReport,
  getOverpaymentDispositionReconReport,
  getCashDrawerReconReport,
} from '@/lib/services/reports/finance-reconciliation-report.service';

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

/** `it` that skips (not fails) when no DB is reachable. */
function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[D-09] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('D-09 reconciliation reports — shape against the live schema', () => {
  dbit('excess liability report runs and returns a well-formed shape', async () => {
    const r = await getExcessLiabilityReport({ tenantOrgId: tenantA });
    expect(Array.isArray(r.rows)).toBe(true);
    expect(r.summary).toEqual(
      expect.objectContaining({
        totalOutstanding: expect.any(Number),
        walletTotal: expect.any(Number),
        advanceTotal: expect.any(Number),
        creditNoteTotal: expect.any(Number),
        rowCount: expect.any(Number),
      }),
    );
    expect(r.summary.rowCount).toBe(r.rows.length);
  });

  dbit('B2B statement reconciliation report runs (raw SQL valid)', async () => {
    const r = await getB2bStatementReconReport({ tenantOrgId: tenantA });
    expect(Array.isArray(r.rows)).toBe(true);
    expect(r.summary.statementCount).toBe(r.rows.length);
    // delta math holds for every returned row
    for (const row of r.rows) {
      expect(row.delta).toBeCloseTo(row.headerPaidAmount - row.detailPaidAmount, 6);
    }
  });

  dbit('overpayment disposition reconciliation report runs (raw SQL valid)', async () => {
    const r = await getOverpaymentDispositionReconReport({ tenantOrgId: tenantA });
    expect(Array.isArray(r.rows)).toBe(true);
    // orphan never exceeds total within a group
    for (const row of r.rows) {
      expect(row.orphanCount).toBeLessThanOrEqual(row.count);
    }
  });

  dbit('cash drawer reconciliation report runs and recomputes expected', async () => {
    const r = await getCashDrawerReconReport({ tenantOrgId: tenantA });
    expect(Array.isArray(r.rows)).toBe(true);
    expect(r.summary.sessionCount).toBe(r.rows.length);
    for (const row of r.rows) {
      expect(row.computedExpectedAmount).toBeCloseTo(row.openingFloatAmount + row.netMovementAmount, 6);
    }
  });
});

describe('D-09 reconciliation reports — tenant isolation', () => {
  const ghost = randomUUID();

  dbit('every report is empty for a non-existent tenant', async () => {
    const [excess, b2b, overpay, cash] = await Promise.all([
      getExcessLiabilityReport({ tenantOrgId: ghost }),
      getB2bStatementReconReport({ tenantOrgId: ghost }),
      getOverpaymentDispositionReconReport({ tenantOrgId: ghost }),
      getCashDrawerReconReport({ tenantOrgId: ghost }),
    ]);

    expect(excess.rows).toHaveLength(0);
    expect(b2b.rows).toHaveLength(0);
    expect(overpay.rows).toHaveLength(0);
    expect(cash.rows).toHaveLength(0);
  });
});
