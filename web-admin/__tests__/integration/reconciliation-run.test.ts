/// <reference types="jest" />
/**
 * Integration test: reconciliation run with known mismatches
 *
 * Scenario:
 * - One order with payment_sum mismatch (BLOCKER issue expected)
 * - One wallet with ledger mismatch (BLOCKER issue expected)
 * - No stuck outbox events
 *
 * Verifies:
 * - Run status = FAILED (has BLOCKER issues)
 * - Correct number of issue rows written to DB
 * - Issue severity and check_name are correct
 * - acknowledgeIssue updates to ACKNOWLEDGED
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOrderFindMany       = jest.fn();
const mockPaymentAggregate    = jest.fn();
const mockWalletFindMany      = jest.fn();
const mockWalletTxnAggregate  = jest.fn();
const mockOutboxCount         = jest.fn();
const mockReconRunCount       = jest.fn();
const mockReconRunCreate      = jest.fn();
const mockReconRunUpdate      = jest.fn();
const mockReconIssueCreate    = jest.fn();
const mockReconIssueUpdate    = jest.fn();

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
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn('tenant-recon-int')
  ),
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
// Test data setup
// ---------------------------------------------------------------------------

const TENANT = 'tenant-recon-int';
const RUN    = 'run-int-001';

function setupKnownMismatches() {
  // Payment total mismatch: order says 100 paid but payments sum to 80
  mockOrderFindMany.mockResolvedValue([
    { id: 'o1', order_no: 'ORD-001', total_paid_amount: new Decimal('100') },
  ]);
  mockPaymentAggregate.mockResolvedValue({ _sum: { amount: new Decimal('80') } });

  // Wallet ledger mismatch: balance=200 but txn sum=180
  mockWalletFindMany.mockResolvedValue([
    { id: 'w1', balance: new Decimal('200'), customer_id: 'c1' },
  ]);
  mockWalletTxnAggregate.mockResolvedValue({ _sum: { amount: new Decimal('180') } });

  // No stuck outbox
  mockOutboxCount.mockResolvedValue(0);

  // Recon infra
  mockReconRunCount.mockResolvedValue(0);
  mockReconRunCreate.mockResolvedValue({ id: RUN, run_no: 'RECON-2026-001' });
  mockReconRunUpdate.mockResolvedValue({ id: RUN });
  mockReconIssueCreate.mockResolvedValue({});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('reconciliation-run integration — known mismatches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupKnownMismatches();
  });

  it('marks run as FAILED when BLOCKER issues exist', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'), periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR', triggeredBy: 'manager-1',
    });

    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
  });

  it('writes 2 BLOCKER issue rows (payment + wallet mismatch)', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'), periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    // Both checks create issues
    expect(mockReconIssueCreate).toHaveBeenCalledTimes(2);
    const calls = mockReconIssueCreate.mock.calls.map((c: unknown[]) => (c[0] as { data: { severity: string } }).data.severity);
    expect(calls).toEqual(['BLOCKER', 'BLOCKER']);
  });

  it('writes correct check_name for payment issue', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'), periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    const paymentIssue = mockReconIssueCreate.mock.calls.find(
      (c: unknown[]) => (c[0] as { data: { check_name: string } }).data.check_name === 'PAYMENT_TOTAL_MATCH'
    );
    expect(paymentIssue).toBeDefined();
  });

  it('writes correct check_name for wallet ledger issue', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'), periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    const walletIssue = mockReconIssueCreate.mock.calls.find(
      (c: unknown[]) => (c[0] as { data: { check_name: string } }).data.check_name === 'STORED_VALUE_LEDGER'
    );
    expect(walletIssue).toBeDefined();
  });

  it('clean run: returns PASSED when no issues found', async () => {
    mockOrderFindMany.mockResolvedValue([]);
    mockWalletFindMany.mockResolvedValue([]);
    mockOutboxCount.mockResolvedValue(0);

    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'), periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PASSED' }) })
    );
    expect(mockReconIssueCreate).not.toHaveBeenCalled();
  });

  it('acknowledgeIssue updates status to ACKNOWLEDGED', async () => {
    mockReconIssueUpdate.mockResolvedValue({ id: 'issue-1', status: 'ACKNOWLEDGED' });

    await acknowledgeIssue(TENANT, 'issue-1', 'ACKNOWLEDGED', 'Reviewed OK', 'manager-1');

    expect(mockReconIssueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACKNOWLEDGED' }) })
    );
  });
});
