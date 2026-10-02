/**
 * D-09 — finance reconciliation report service unit tests.
 *
 * Covers the transform/rollup logic of the four reconciliation reports with a
 * mocked Prisma client + pass-through tenant context (repo convention — DB-level
 * truth is asserted separately by the F-T5 db-integration suite). The value here
 * is the math: source bucketing + sort (excess), header-vs-detail delta and the
 * reconciled threshold (B2B), posted/orphan split (overpayment), and the
 * recomputed-expected / unlinked-movement exception logic (cash drawer).
 *
 * Runs in the `node` environment so `Prisma.sql`/`Prisma.join` (used by the
 * service to build the raw-SQL fragments handed to the mocked `$queryRaw`)
 * resolve to the Node build — the jsdom default resolves `@prisma/client` to the
 * browser build whose `sqltag` throws.
 *
 * @jest-environment node
 */

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_customer_wallets_mst: { findMany: jest.fn() },
    org_customer_advances_mst: { findMany: jest.fn() },
    org_credit_notes_mst: { findMany: jest.fn() },
    org_cash_drawer_sessions_mst: { findMany: jest.fn() },
    // CLF-6-2: the cash-drawer recon report sums the unified ledger via
    // `sumLedgerTotalsBySession` (cash-drawer-balance.service.ts) instead of
    // the retired `org_cash_drawer_movements_dtl` formula — one `$queryRaw`
    // for the FIN/TRX amount totals, two `groupBy` calls for entry counts.
    org_fin_voucher_trx_lines_dtl: { groupBy: jest.fn() },
    org_cash_drawer_trx_dtl: { groupBy: jest.fn() },
    $queryRaw: jest.fn(),
  },
}));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (_t: string, fn: (t: string) => unknown) => fn(_t),
}));

import { prisma } from '@/lib/db/prisma';
import {
  getExcessLiabilityReport,
  getB2bStatementReconReport,
  getOverpaymentDispositionReconReport,
  getCashDrawerReconReport,
} from '@/lib/services/reports/finance-reconciliation-report.service';

type Fn = jest.Mock;
const mockPrisma = prisma as unknown as {
  org_customer_wallets_mst: { findMany: Fn };
  org_customer_advances_mst: { findMany: Fn };
  org_credit_notes_mst: { findMany: Fn };
  org_cash_drawer_sessions_mst: { findMany: Fn };
  org_fin_voucher_trx_lines_dtl: { groupBy: Fn };
  org_cash_drawer_trx_dtl: { groupBy: Fn };
  $queryRaw: Fn;
};

const TENANT = '11111111-1111-1111-1111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getExcessLiabilityReport', () => {
  it('merges wallet/advance/credit-note balances, sorts desc, and rolls up per source', async () => {
    mockPrisma.org_customer_wallets_mst.findMany.mockResolvedValueOnce([
      {
        customer_id: 'c1',
        balance: 50,
        currency_code: 'OMR',
        last_activity_at: new Date('2026-06-01T00:00:00Z'),
        org_customers_mst: { display_name: 'Acme', name: 'acme-legacy' },
      },
    ]);
    mockPrisma.org_customer_advances_mst.findMany.mockResolvedValueOnce([
      {
        customer_id: 'c2',
        balance: 30,
        currency_code: 'OMR',
        last_activity_at: null,
        org_customers_mst: { display_name: null, name: 'Beta' },
      },
    ]);
    mockPrisma.org_credit_notes_mst.findMany.mockResolvedValueOnce([
      {
        customer_id: 'c3',
        remaining_balance: 20,
        currency_code: 'OMR',
        issued_at: new Date('2026-05-01T00:00:00Z'),
        org_customers_mst: { display_name: 'Gamma', name: null },
      },
    ]);

    const report = await getExcessLiabilityReport({ tenantOrgId: TENANT });

    expect(report.rows.map((r) => r.outstandingAmount)).toEqual([50, 30, 20]); // sorted desc
    expect(report.rows[0]).toMatchObject({ source: 'WALLET', customerName: 'Acme' });
    expect(report.rows[1]).toMatchObject({ source: 'ADVANCE', customerName: 'Beta' }); // name fallback
    expect(report.summary).toEqual({
      totalOutstanding: 100,
      walletTotal: 50,
      advanceTotal: 30,
      creditNoteTotal: 20,
      rowCount: 3,
    });
  });

  it('returns an empty report when no positive balances exist', async () => {
    mockPrisma.org_customer_wallets_mst.findMany.mockResolvedValueOnce([]);
    mockPrisma.org_customer_advances_mst.findMany.mockResolvedValueOnce([]);
    mockPrisma.org_credit_notes_mst.findMany.mockResolvedValueOnce([]);

    const report = await getExcessLiabilityReport({ tenantOrgId: TENANT });
    expect(report.rows).toHaveLength(0);
    expect(report.summary.totalOutstanding).toBe(0);
  });
});

describe('getB2bStatementReconReport', () => {
  it('flags statements where header paid diverges from detail sum', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        statement_id: 's1', statement_no: 'ST-1', customer_id: 'c1', currency_cd: 'OMR', status_cd: 'PAID',
        total_amount: 100, header_paid: 100, balance_amount: 0, detail_paid: 100, detail_count: 2,
      },
      {
        statement_id: 's2', statement_no: 'ST-2', customer_id: 'c2', currency_cd: 'OMR', status_cd: 'PARTIAL',
        total_amount: 100, header_paid: 100, balance_amount: 0, detail_paid: 90, detail_count: 1,
      },
    ]);

    const report = await getB2bStatementReconReport({ tenantOrgId: TENANT });

    expect(report.rows[0]).toMatchObject({ delta: 0, isReconciled: true });
    expect(report.rows[1]).toMatchObject({ delta: 10, isReconciled: false });
    expect(report.summary).toMatchObject({
      statementCount: 2,
      exceptionCount: 1,
      totalHeaderPaid: 200,
      totalDetailPaid: 190,
      totalDelta: 10,
    });
  });
});

describe('getOverpaymentDispositionReconReport', () => {
  it('passes through posted/orphan groups and rolls up orphan totals', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        resolution_code: 'SAVE_TO_CUSTOMER_WALLET', currency_code: 'OMR',
        cnt: 5, total_amount: 100, posted_count: 4, posted_amount: 80, orphan_count: 1, orphan_amount: 20,
      },
      {
        resolution_code: 'RETURN_CASH_CHANGE', currency_code: 'OMR',
        cnt: 2, total_amount: 30, posted_count: 2, posted_amount: 30, orphan_count: 0, orphan_amount: 0,
      },
    ]);

    const report = await getOverpaymentDispositionReconReport({ tenantOrgId: TENANT });

    expect(report.rows).toHaveLength(2);
    expect(report.summary).toEqual({
      totalCount: 7,
      totalAmount: 130,
      orphanCount: 1,
      orphanAmount: 20,
    });
  });
});

describe('getCashDrawerReconReport', () => {
  it('recomputes expected from the ledger and flags exceptions (delta / difference)', async () => {
    mockPrisma.org_cash_drawer_sessions_mst.findMany.mockResolvedValueOnce([
      {
        id: 'sess-ok', session_no: 'CDS-1', status: 'CLOSED', currency_code: 'OMR',
        opened_at: new Date('2026-06-10T08:00:00Z'), closed_at: new Date('2026-06-10T18:00:00Z'),
        opening_float_amount: 100, expected_cash_amount: 150, counted_cash_amount: 150, difference_amount: 0,
      },
      {
        id: 'sess-bad', session_no: 'CDS-2', status: 'CLOSED', currency_code: 'OMR',
        opened_at: new Date('2026-06-11T08:00:00Z'), closed_at: new Date('2026-06-11T18:00:00Z'),
        opening_float_amount: 100, expected_cash_amount: 150, counted_cash_amount: 140, difference_amount: -10,
      },
    ]);
    // ledger totals: both sessions have a single FIN IN entry of 50 (opening
    // 100 + net 50 = 150, matching both sessions' header expected).
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { session_id: 'sess-ok', domain: 'FIN', direction: 'IN', total: 50 },
      { session_id: 'sess-bad', domain: 'FIN', direction: 'IN', total: 50 },
    ]);
    mockPrisma.org_fin_voucher_trx_lines_dtl.groupBy.mockResolvedValueOnce([
      { cash_drawer_session_id: 'sess-ok', _count: { _all: 1 } },
      { cash_drawer_session_id: 'sess-bad', _count: { _all: 1 } },
    ]);
    mockPrisma.org_cash_drawer_trx_dtl.groupBy.mockResolvedValueOnce([]);

    const report = await getCashDrawerReconReport({ tenantOrgId: TENANT });

    const ok = report.rows.find((r) => r.sessionId === 'sess-ok')!;
    const bad = report.rows.find((r) => r.sessionId === 'sess-bad')!;

    expect(ok).toMatchObject({ computedExpectedAmount: 150, expectedDelta: 0, isReconciled: true });
    // close difference (-10) alone makes this an exception; the expected
    // figure itself still matches the ledger recompute.
    expect(bad).toMatchObject({ differenceAmount: -10, unlinkedMovementCount: 0, isReconciled: false });
    expect(report.summary).toMatchObject({
      sessionCount: 2,
      exceptionCount: 1,
      totalDifference: -10,
      totalUnlinkedMovements: 0,
    });
  });

  it('treats a closed session with no ledger activity as reconciled (predates CLF)', async () => {
    mockPrisma.org_cash_drawer_sessions_mst.findMany.mockResolvedValueOnce([
      {
        id: 'sess-legacy', session_no: 'CDS-0', status: 'CLOSED', currency_code: 'OMR',
        opened_at: new Date('2026-01-01T08:00:00Z'), closed_at: new Date('2026-01-01T18:00:00Z'),
        opening_float_amount: 100, expected_cash_amount: 275, counted_cash_amount: 275, difference_amount: 0,
      },
    ]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);
    mockPrisma.org_fin_voucher_trx_lines_dtl.groupBy.mockResolvedValueOnce([]);
    mockPrisma.org_cash_drawer_trx_dtl.groupBy.mockResolvedValueOnce([]);

    const report = await getCashDrawerReconReport({ tenantOrgId: TENANT });

    expect(report.rows[0]).toMatchObject({ expectedDelta: 0, isReconciled: true });
  });

  it('skips the ledger query when there are no sessions', async () => {
    mockPrisma.org_cash_drawer_sessions_mst.findMany.mockResolvedValueOnce([]);
    const report = await getCashDrawerReconReport({ tenantOrgId: TENANT });
    expect(report.rows).toHaveLength(0);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });
});
