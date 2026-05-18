/**
 * Tests: reconciliation.service
 *
 * Covers:
 * - runReconciliation — PASSED when all checks pass (no issues)
 * - runReconciliation — FAILED when BLOCKER check fires
 * - runReconciliation — PARTIAL when only WARNING fires
 * - runReconciliation — writes issues to DB
 * - acknowledgeIssue — updates issue status
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOrderFindMany     = jest.fn();
const mockPaymentAggregate  = jest.fn();
const mockWalletFindMany    = jest.fn();
const mockWalletTxnAggregate = jest.fn();
const mockOutboxCount       = jest.fn();
const mockReconRunCount     = jest.fn();
const mockReconRunCreate    = jest.fn();
const mockReconRunUpdate    = jest.fn();
const mockReconIssueCreate  = jest.fn();
const mockReconIssueUpdate  = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: {
      findMany: (...a: unknown[]) => mockOrderFindMany(...a),
    },
    org_order_payments_dtl: {
      aggregate: (...a: unknown[]) => mockPaymentAggregate(...a),
    },
    org_customer_wallets_mst: {
      findMany: (...a: unknown[]) => mockWalletFindMany(...a),
    },
    org_wallet_txn_dtl: {
      aggregate: (...a: unknown[]) => mockWalletTxnAggregate(...a),
    },
    org_domain_events_outbox: {
      count: (...a: unknown[]) => mockOutboxCount(...a),
    },
    org_fin_recon_runs_mst: {
      count:  (...a: unknown[]) => mockReconRunCount(...a),
      create: (...a: unknown[]) => mockReconRunCreate(...a),
      update: (...a: unknown[]) => mockReconRunUpdate(...a),
    },
    org_fin_recon_issues_dtl: {
      create: (...a: unknown[]) => mockReconIssueCreate(...a),
      update: (...a: unknown[]) => mockReconIssueUpdate(...a),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { runReconciliation, acknowledgeIssue } from '@/lib/services/reconciliation.service';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = 'tenant-recon-001';

const defaultParams = {
  periodFrom:   new Date('2026-05-01'),
  periodTo:     new Date('2026-05-31'),
  currencyCode: 'OMR',
  triggeredBy:  'manager-001',
};

function setupPassingChecks() {
  mockOrderFindMany.mockResolvedValue([]); // no orders → no payment check
  mockWalletFindMany.mockResolvedValue([]); // no wallets
  mockOutboxCount.mockResolvedValue(0);    // no stuck events
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reconciliation.service — runReconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReconRunCount.mockResolvedValue(0);
    mockReconRunCreate.mockResolvedValue({ id: 'run-1', run_no: 'RECON-2026-001' });
    mockReconRunUpdate.mockResolvedValue({ id: 'run-1' });
    mockReconIssueCreate.mockResolvedValue({});
  });

  it('returns PASSED status when no issues found', async () => {
    setupPassingChecks();

    await runReconciliation(TENANT, defaultParams);
    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PASSED' }) })
    );
    expect(mockReconIssueCreate).not.toHaveBeenCalled();
  });

  it('returns FAILED status when BLOCKER issues found', async () => {
    // One order with payment sum mismatch (BLOCKER)
    mockOrderFindMany.mockResolvedValue([
      { id: 'order-1', order_no: 'ORD-001', total_paid_amount: new Decimal('100') },
    ]);
    mockPaymentAggregate.mockResolvedValue({ _sum: { amount: new Decimal('80') } }); // mismatch
    mockWalletFindMany.mockResolvedValue([]);
    mockOutboxCount.mockResolvedValue(0);

    await runReconciliation(TENANT, defaultParams);
    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
    expect(mockReconIssueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ severity: 'BLOCKER' }) })
    );
  });

  it('returns PARTIAL status when only WARNING issues found', async () => {
    mockOrderFindMany.mockResolvedValue([]); // no payment mismatches
    mockWalletFindMany.mockResolvedValue([]); // no wallet mismatches
    mockOutboxCount.mockResolvedValue(5);    // 5 stuck events → WARNING

    await runReconciliation(TENANT, defaultParams);
    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIAL' }) })
    );
    expect(mockReconIssueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ severity: 'WARNING' }) })
    );
  });

  it('generates sequential run_no', async () => {
    setupPassingChecks();
    mockReconRunCount.mockResolvedValue(7); // 7 existing → next is RECON-2026-008

    await runReconciliation(TENANT, defaultParams);
    const createCall = mockReconRunCreate.mock.calls[0][0];
    expect(createCall.data.run_no).toMatch(/RECON-\d{4}-008/);
  });

  it('writes issues for wallet ledger mismatch', async () => {
    mockOrderFindMany.mockResolvedValue([]);
    mockWalletFindMany.mockResolvedValue([
      { id: 'w1', balance: new Decimal('100'), customer_id: 'c1' },
    ]);
    mockWalletTxnAggregate.mockResolvedValue({ _sum: { amount: new Decimal('90') } }); // mismatch
    mockOutboxCount.mockResolvedValue(0);

    await runReconciliation(TENANT, defaultParams);
    expect(mockReconIssueCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ check_name: 'STORED_VALUE_LEDGER', severity: 'BLOCKER' }),
      })
    );
  });
});

describe('reconciliation.service — acknowledgeIssue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates issue status to ACKNOWLEDGED', async () => {
    mockReconIssueUpdate.mockResolvedValue({ id: 'issue-1', status: 'ACKNOWLEDGED' });

    await acknowledgeIssue(TENANT, 'issue-1', 'ACKNOWLEDGED', 'Reviewed by team', 'manager-1');
    expect(mockReconIssueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACKNOWLEDGED' }),
      })
    );
  });

  it('updates issue status to RESOLVED', async () => {
    mockReconIssueUpdate.mockResolvedValue({ id: 'issue-1', status: 'RESOLVED' });

    await acknowledgeIssue(TENANT, 'issue-1', 'RESOLVED');
    expect(mockReconIssueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RESOLVED' }) })
    );
  });
});
