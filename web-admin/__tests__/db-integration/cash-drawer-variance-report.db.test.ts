/**
 * C4 — real-DB proof of the cash variance by cashier report: exact per-cashier, per-currency
 * figures over real closed drawer sessions (count, shortage / overage split, total, mean and
 * absolute variance), the close-date window, the cashier filter and the branch scope.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { getVarianceByCashierReport } from '@/lib/services/cash-drawer-variance-report.service';
import { businessDateForTimezone } from '@/lib/utils/business-date';
import {
  cleanupTestDrawers,
  closeTestSession,
  createTestDrawer,
  openTestSession,
  resolveTestScope,
  stampTestCashLine,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

let scope: DbTestScope | null = null;
let today = '';

beforeAll(async () => {
  scope = await resolveTestScope();
  if (!scope) return;
  const [tenant] = await prisma.$queryRaw<Array<{ timezone: string }>>`
    SELECT timezone FROM public.org_tenants_mst WHERE id = ${scope.tenantId}::uuid`;
  today = businessDateForTimezone(tenant.timezone);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(
    name,
    async () => {
      if (!scope) {
        console.warn(`[cash-drawer-variance-report] DB unavailable — skipping: ${name}`);
        return;
      }
      await fn();
    },
    180_000,
  );
}

/** One closed drawer session opened by `cashier`: expected cash from `cashIn`, counted as given. */
async function closedSession(cashier: string, cashIn: string | null, counted: number): Promise<string> {
  const drawerId = await createTestDrawer(scope!, { codePrefix: 'C4-TEST', name: 'C4 variance report' });
  const { sessionId } = await openTestSession(scope!, cashier, drawerId);
  if (cashIn) await stampTestCashLine(scope!, { drawerId, amount: cashIn, mode: 'INTERACTIVE', direction: 'IN' });
  await closeTestSession(scope!, cashier, drawerId, sessionId, { countedAmount: counted });
  return drawerId;
}

describe('cash variance by cashier (C4)', () => {
  dbit('aggregates exact figures per cashier and currency, with the shortage skew and filters', async () => {
    const sara = randomUUID();
    const omar = randomUUID();
    const drawers: string[] = [];
    try {
      drawers.push(await closedSession(sara, '10.000', 7)); // short 3
      drawers.push(await closedSession(sara, null, 2)); // over 2
      drawers.push(await closedSession(sara, '5.000', 5)); // balanced
      drawers.push(await closedSession(sara, '8.000', 5)); // short 3
      drawers.push(await closedSession(omar, '4.000', 4)); // balanced

      const window = { dateFrom: today, dateTo: today };
      const report = await getVarianceByCashierReport(scope!.tenantId, window, [scope!.branchId]);
      const saraRow = report.rows.find((r) => r.cashierId === sara && r.currencyCode === 'OMR');
      const omarRow = report.rows.find((r) => r.cashierId === omar && r.currencyCode === 'OMR');

      expect(saraRow).toMatchObject({
        sessionCount: 4,
        balancedCount: 1,
        shortageCount: 2,
        overageCount: 1,
        totalVariance: '-4.0000', // -3 + 2 + 0 - 3
        meanVariance: '-1.0000',
        absoluteVariance: '8.0000',
        shortageTotal: '-6.0000',
        overageTotal: '2.0000',
        largestShortage: '-3.0000',
        largestOverage: '2.0000',
      });
      expect(saraRow!.shortageShare).toBeCloseTo(2 / 3, 6);
      expect(omarRow).toMatchObject({ sessionCount: 1, balancedCount: 1, totalVariance: '0.0000', shortageShare: null });

      // Worst cashier first (largest absolute net variance).
      expect(report.rows.findIndex((r) => r.cashierId === sara)).toBeLessThan(
        report.rows.findIndex((r) => r.cashierId === omar),
      );

      // Cashier filter.
      const onlyOmar = await getVarianceByCashierReport(scope!.tenantId, { ...window, cashierId: omar }, [scope!.branchId]);
      expect(onlyOmar.rows.map((r) => r.cashierId)).toEqual([omar]);

      // Date window: a past-only range excludes everything created today.
      const past = await getVarianceByCashierReport(
        scope!.tenantId,
        { dateFrom: '2000-01-01', dateTo: '2000-01-31', cashierId: sara },
        [scope!.branchId],
      );
      expect(past.rows).toHaveLength(0);

      // Branch scope: another branch, or none at all, sees nothing.
      expect((await getVarianceByCashierReport(scope!.tenantId, { ...window, cashierId: sara }, [randomUUID()])).rows).toHaveLength(0);
      expect((await getVarianceByCashierReport(scope!.tenantId, { ...window, cashierId: sara }, [])).rows).toHaveLength(0);
    } finally {
      await cleanupTestDrawers(scope!, drawers);
    }
  });
});
