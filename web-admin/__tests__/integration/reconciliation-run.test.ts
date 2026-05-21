/// <reference types="jest" />

/**
 * Integration test: reconciliation run with known mismatches.
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
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn('tenant-recon-int')
  ),
}));

import { Decimal } from '@prisma/client/runtime/library';
import { acknowledgeIssue, runReconciliation } from '@/lib/services/reconciliation.service';

const TENANT = 'tenant-recon-int';
const RUN = 'run-int-001';

function setupKnownMismatches() {
  mockOrderFindMany.mockResolvedValue([
    {
      id: 'o1',
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
  mockCreditAggregate.mockResolvedValue({ _sum: { applied_amount: new Decimal('0') } });
  mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });

  mockWalletFindMany.mockResolvedValue([
    { id: 'w1', balance: new Decimal('200'), customer_id: 'c1' },
  ]);
  mockWalletTxnAggregate.mockResolvedValue({ _sum: { amount: new Decimal('180') } });

  mockOutboxCount.mockResolvedValue(0);
  mockReconRunCount.mockResolvedValue(0);
  mockReconRunCreate.mockResolvedValue({ id: RUN, run_no: 'RECON-2026-001' });
  mockReconRunUpdate.mockResolvedValue({ id: RUN });
  mockReconIssueCreate.mockResolvedValue({});
}

describe('reconciliation-run integration - known mismatches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupKnownMismatches();
  });

  it('marks run as FAILED when BLOCKER issues exist', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'),
      periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
      triggeredBy: 'manager-1',
    });

    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
  });

  it('writes 3 BLOCKER issue rows when payment, outstanding, and wallet mismatch', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'),
      periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    expect(mockReconIssueCreate).toHaveBeenCalledTimes(3);
    const calls = mockReconIssueCreate.mock.calls.map(
      (call: unknown[]) => (call[0] as { data: { severity: string } }).data.severity
    );
    expect(calls).toEqual(['BLOCKER', 'BLOCKER', 'BLOCKER']);
  });

  it('writes correct check_name for payment issue', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'),
      periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    const paymentIssue = mockReconIssueCreate.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data: { check_name: string } }).data.check_name === 'PAYMENT_TOTAL_MATCH'
    );
    expect(paymentIssue).toBeDefined();
  });

  it('writes correct check_name for wallet ledger issue', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'),
      periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    const walletIssue = mockReconIssueCreate.mock.calls.find(
      (call: unknown[]) =>
        (call[0] as { data: { check_name: string } }).data.check_name === 'STORED_VALUE_LEDGER'
    );
    expect(walletIssue).toBeDefined();
  });

  it('clean run: returns PASSED when no issues found', async () => {
    mockOrderFindMany.mockResolvedValue([]);
    mockWalletFindMany.mockResolvedValue([]);
    mockOutboxCount.mockResolvedValue(0);
    mockCreditAggregate.mockResolvedValue({ _sum: { applied_amount: new Decimal('0') } });
    mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });

    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'),
      periodTo: new Date('2026-05-31'),
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
