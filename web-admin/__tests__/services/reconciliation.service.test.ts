/**
 * Tests: reconciliation.service
 *
 * Covers:
 * - runReconciliation -> PASSED when all checks pass
 * - runReconciliation -> FAILED when a blocker check fires
 * - runReconciliation -> PARTIAL when only warnings fire
 * - runReconciliation -> writes issue rows to DB
 * - acknowledgeIssue -> updates issue status
 */

const mockOrderFindMany = jest.fn();
const mockPaymentFindMany = jest.fn();
const mockCreditAggregate = jest.fn();
const mockRefundAggregate = jest.fn();
const mockWalletFindMany = jest.fn();
const mockWalletTxnAggregate = jest.fn();
const mockOutboxCount = jest.fn();
const mockReconRunCount = jest.fn();
const mockReconRunCreate = jest.fn();
const mockReconRunUpdate = jest.fn();
const mockReconIssueCreate = jest.fn();
const mockReconIssueUpdate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: {
      findMany: (...args: unknown[]) => mockOrderFindMany(...args),
    },
    org_order_payments_dtl: {
      findMany: (...args: unknown[]) => mockPaymentFindMany(...args),
    },
    org_order_credit_apps_dtl: {
      aggregate: (...args: unknown[]) => mockCreditAggregate(...args),
    },
    org_order_refunds_dtl: {
      aggregate: (...args: unknown[]) => mockRefundAggregate(...args),
    },
    org_customer_wallets_mst: {
      findMany: (...args: unknown[]) => mockWalletFindMany(...args),
    },
    org_wallet_txn_dtl: {
      aggregate: (...args: unknown[]) => mockWalletTxnAggregate(...args),
    },
    org_domain_events_outbox: {
      count: (...args: unknown[]) => mockOutboxCount(...args),
    },
    org_fin_recon_runs_mst: {
      count: (...args: unknown[]) => mockReconRunCount(...args),
      create: (...args: unknown[]) => mockReconRunCreate(...args),
      update: (...args: unknown[]) => mockReconRunUpdate(...args),
    },
    org_fin_recon_issues_dtl: {
      create: (...args: unknown[]) => mockReconIssueCreate(...args),
      update: (...args: unknown[]) => mockReconIssueUpdate(...args),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

import { Decimal } from '@prisma/client/runtime/library';
import { acknowledgeIssue, runReconciliation } from '@/lib/services/reconciliation.service';

const TENANT = 'tenant-recon-001';

const defaultParams = {
  periodFrom: new Date('2026-05-01'),
  periodTo: new Date('2026-05-31'),
  currencyCode: 'OMR',
  triggeredBy: 'manager-001',
};

function setupPassingChecks() {
  mockOrderFindMany.mockResolvedValue([]);
  mockWalletFindMany.mockResolvedValue([]);
  mockOutboxCount.mockResolvedValue(0);
  mockCreditAggregate.mockResolvedValue({ _sum: { applied_amount: new Decimal('0') } });
  mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });
}

describe('reconciliation.service - runReconciliation', () => {
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
    mockOrderFindMany.mockResolvedValue([
      {
        id: 'order-1',
        order_no: 'ORD-001',
        total: new Decimal('100'),
        total_paid_amount: new Decimal('100'),
        total_credit_applied_amount: new Decimal('0'),
        outstanding_amount: new Decimal('0'),
        payment_status: 'PAID',
        payment_type_code: null,
        pay_on_collection_amount: null,
      },
    ]);
    mockPaymentFindMany.mockResolvedValue([
      { amount: new Decimal('80'), payment_status: 'COMPLETED', gateway_code: null },
    ]);
    mockWalletFindMany.mockResolvedValue([]);
    mockOutboxCount.mockResolvedValue(0);
    mockCreditAggregate.mockResolvedValue({ _sum: { applied_amount: new Decimal('0') } });
    mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });

    await runReconciliation(TENANT, defaultParams);

    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
    expect(mockReconIssueCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ severity: 'BLOCKER' }) })
    );
  });

  it('returns PARTIAL status when only WARNING issues found', async () => {
    mockOrderFindMany.mockResolvedValue([]);
    mockWalletFindMany.mockResolvedValue([]);
    mockOutboxCount.mockResolvedValue(5);
    mockCreditAggregate.mockResolvedValue({ _sum: { applied_amount: new Decimal('0') } });
    mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });

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
    mockReconRunCount.mockResolvedValue(7);

    await runReconciliation(TENANT, defaultParams);

    const createCall = mockReconRunCreate.mock.calls[0][0];
    expect(createCall.data.run_no).toMatch(/RECON-\d{4}-008/);
  });

  it('writes issues for wallet ledger mismatch', async () => {
    mockOrderFindMany.mockResolvedValue([]);
    mockWalletFindMany.mockResolvedValue([
      { id: 'w1', balance: new Decimal('100'), customer_id: 'c1' },
    ]);
    mockWalletTxnAggregate.mockResolvedValue({ _sum: { amount: new Decimal('90') } });
    mockOutboxCount.mockResolvedValue(0);
    mockCreditAggregate.mockResolvedValue({ _sum: { applied_amount: new Decimal('0') } });
    mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });

    await runReconciliation(TENANT, defaultParams);

    expect(mockReconIssueCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          check_name: 'STORED_VALUE_LEDGER',
          severity: 'BLOCKER',
        }),
      })
    );
  });
});

describe('reconciliation.service - acknowledgeIssue', () => {
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
