/**
 * Tests: reconciliation.service (BVM Phase 4 — orchestrator rewrite).
 *
 * Covers:
 * - runReconciliation -> PASSED when all checks pass
 * - runReconciliation -> FAILED when a blocker check fires
 * - runReconciliation -> PARTIAL when only warnings fire
 * - runReconciliation -> bulk-persists issues via createMany (R7 fix)
 * - runReconciliation -> total_checked = RECONCILIATION_TOTAL_CHECKS (dynamic, not 8)
 * - acknowledgeIssue -> updates issue status
 */

const mockOrderFindMany = jest.fn();
const mockOrderFindUnique = jest.fn();
const mockOrderFindFirstOrThrow = jest.fn();
const mockPaymentFindMany = jest.fn();
const mockCreditAggregate = jest.fn();
const mockCreditFindMany = jest.fn();
const mockRefundAggregate = jest.fn();
const mockRefundFindMany = jest.fn();
const mockChargesAggregate = jest.fn();
const mockChargesFindMany = jest.fn();
const mockOrderItemsFindMany = jest.fn();
const mockOrderPiecesFindMany = jest.fn();
const mockOrderPreferencesFindMany = jest.fn();
const mockOrderDiscountsFindMany = jest.fn();
const mockOrderTaxesFindMany = jest.fn();
const mockWalletFindMany = jest.fn();
const mockWalletTxnAggregate = jest.fn();
const mockWalletTxnFindMany = jest.fn();
const mockAdvanceTxnFindMany = jest.fn();
const mockGiftCardTxnFindMany = jest.fn();
const mockCreditNoteTxnFindMany = jest.fn();
const mockLoyaltyTxnFindMany = jest.fn();
const mockInvoicePaymentsFindMany = jest.fn();
const mockVoucherFindMany = jest.fn();
const mockVoucherTrxLinesFindMany = jest.fn();
const mockCashMovementsFindMany = jest.fn();
const mockOutboxCount = jest.fn();
const mockReconRunCount = jest.fn();
const mockReconRunCreate = jest.fn();
const mockReconRunUpdate = jest.fn();
const mockReconIssueCreateMany = jest.fn();
const mockReconIssueUpdate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_orders_mst: {
      findMany: (...args: unknown[]) => mockOrderFindMany(...args),
      findUnique: (...args: unknown[]) => mockOrderFindUnique(...args),
      findFirstOrThrow: (...args: unknown[]) => mockOrderFindFirstOrThrow(...args),
    },
    org_order_payments_dtl: {
      findMany: (...args: unknown[]) => mockPaymentFindMany(...args),
    },
    org_order_credit_apps_dtl: {
      aggregate: (...args: unknown[]) => mockCreditAggregate(...args),
      findMany: (...args: unknown[]) => mockCreditFindMany(...args),
    },
    org_order_refunds_dtl: {
      aggregate: (...args: unknown[]) => mockRefundAggregate(...args),
      findMany: (...args: unknown[]) => mockRefundFindMany(...args),
    },
    org_order_charges_dtl: {
      aggregate: (...args: unknown[]) => mockChargesAggregate(...args),
      findMany: (...args: unknown[]) => mockChargesFindMany(...args),
    },
    org_order_items_dtl: {
      findMany: (...args: unknown[]) => mockOrderItemsFindMany(...args),
    },
    org_order_item_pieces_dtl: {
      findMany: (...args: unknown[]) => mockOrderPiecesFindMany(...args),
    },
    org_order_preferences_dtl: {
      findMany: (...args: unknown[]) => mockOrderPreferencesFindMany(...args),
    },
    org_order_discounts_dtl: {
      findMany: (...args: unknown[]) => mockOrderDiscountsFindMany(...args),
    },
    org_order_taxes_dtl: {
      findMany: (...args: unknown[]) => mockOrderTaxesFindMany(...args),
    },
    org_customer_wallets_mst: {
      findMany: (...args: unknown[]) => mockWalletFindMany(...args),
    },
    org_wallet_txn_dtl: {
      aggregate: (...args: unknown[]) => mockWalletTxnAggregate(...args),
      findMany: (...args: unknown[]) => mockWalletTxnFindMany(...args),
    },
    org_advance_txn_dtl: {
      findMany: (...args: unknown[]) => mockAdvanceTxnFindMany(...args),
    },
    org_gift_card_txn_dtl: {
      findMany: (...args: unknown[]) => mockGiftCardTxnFindMany(...args),
    },
    org_credit_note_txn_dtl: {
      findMany: (...args: unknown[]) => mockCreditNoteTxnFindMany(...args),
    },
    org_loyalty_txn_dtl: {
      findMany: (...args: unknown[]) => mockLoyaltyTxnFindMany(...args),
    },
    org_invoice_payments_dtl: {
      findMany: (...args: unknown[]) => mockInvoicePaymentsFindMany(...args),
    },
    org_fin_vouchers_mst: {
      findMany: (...args: unknown[]) => mockVoucherFindMany(...args),
    },
    org_fin_voucher_trx_lines_dtl: {
      findMany: (...args: unknown[]) => mockVoucherTrxLinesFindMany(...args),
    },
    org_cash_drawer_movements_dtl: {
      findMany: (...args: unknown[]) => mockCashMovementsFindMany(...args),
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
      createMany: (...args: unknown[]) => mockReconIssueCreateMany(...args),
      update: (...args: unknown[]) => mockReconIssueUpdate(...args),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

import { Decimal } from '@prisma/client/runtime/library';
import {
  acknowledgeIssue,
  runReconciliation,
  RECONCILIATION_TOTAL_CHECKS,
} from '@/lib/services/reconciliation.service';

const TENANT = 'tenant-recon-001';

const defaultParams = {
  periodFrom: new Date('2026-05-01'),
  periodTo: new Date('2026-05-31'),
  currencyCode: 'OMR',
  triggeredBy: 'manager-001',
};

/** Set every mocked source to "no rows / zero" so the run is clean by default. */
function setupPassingChecks() {
  mockOrderFindMany.mockResolvedValue([]);
  mockOrderFindUnique.mockResolvedValue(null);
  mockPaymentFindMany.mockResolvedValue([]);
  mockCreditAggregate.mockResolvedValue({ _sum: { applied_amount: new Decimal('0') } });
  mockCreditFindMany.mockResolvedValue([]);
  mockRefundAggregate.mockResolvedValue({ _sum: { refund_amount: new Decimal('0') } });
  mockRefundFindMany.mockResolvedValue([]);
  mockChargesAggregate.mockResolvedValue({ _sum: { amount: new Decimal('0') } });
  mockChargesFindMany.mockResolvedValue([]);
  mockOrderItemsFindMany.mockResolvedValue([]);
  mockOrderPiecesFindMany.mockResolvedValue([]);
  mockOrderPreferencesFindMany.mockResolvedValue([]);
  mockOrderDiscountsFindMany.mockResolvedValue([]);
  mockOrderTaxesFindMany.mockResolvedValue([]);
  mockWalletFindMany.mockResolvedValue([]);
  mockWalletTxnAggregate.mockResolvedValue({ _sum: { amount: new Decimal('0') } });
  mockWalletTxnFindMany.mockResolvedValue([]);
  mockAdvanceTxnFindMany.mockResolvedValue([]);
  mockGiftCardTxnFindMany.mockResolvedValue([]);
  mockCreditNoteTxnFindMany.mockResolvedValue([]);
  mockLoyaltyTxnFindMany.mockResolvedValue([]);
  mockInvoicePaymentsFindMany.mockResolvedValue([]);
  mockVoucherFindMany.mockResolvedValue([]);
  mockVoucherTrxLinesFindMany.mockResolvedValue([]);
  mockCashMovementsFindMany.mockResolvedValue([]);
  mockOutboxCount.mockResolvedValue(0);
}

describe('reconciliation.service - runReconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupPassingChecks();
    mockReconRunCount.mockResolvedValue(0);
    mockReconRunCreate.mockResolvedValue({ id: 'run-1', run_no: 'RECON-2026-001' });
    mockReconRunUpdate.mockResolvedValue({ id: 'run-1' });
    mockReconIssueCreateMany.mockResolvedValue({ count: 0 });
  });

  it('returns PASSED status when no issues found', async () => {
    await runReconciliation(TENANT, defaultParams);

    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PASSED',
          total_checked: RECONCILIATION_TOTAL_CHECKS,
        }),
      })
    );
    // Bulk-insert helper short-circuits on empty list (no DB round-trip).
    expect(mockReconIssueCreateMany).not.toHaveBeenCalled();
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

    await runReconciliation(TENANT, defaultParams);

    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
    expect(mockReconIssueCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ severity: 'BLOCKER' }),
        ]),
      })
    );
  });

  it('returns PARTIAL status when only WARNING issues found', async () => {
    mockOutboxCount.mockResolvedValue(5);

    await runReconciliation(TENANT, defaultParams);

    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIAL' }) })
    );
    expect(mockReconIssueCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ severity: 'WARNING', check_name: 'OUTBOX_PROCESSED' }),
        ]),
      })
    );
  });

  it('generates sequential run_no', async () => {
    mockReconRunCount.mockResolvedValue(7);

    await runReconciliation(TENANT, defaultParams);

    const createCall = mockReconRunCreate.mock.calls[0][0];
    expect(createCall.data.run_no).toMatch(/RECON-\d{4}-008/);
  });

  it('writes wallet ledger BLOCKER via bulk createMany', async () => {
    mockWalletFindMany.mockResolvedValue([
      { id: 'w1', balance: new Decimal('100') },
    ]);
    mockWalletTxnAggregate.mockResolvedValue({ _sum: { amount: new Decimal('90') } });

    await runReconciliation(TENANT, defaultParams);

    expect(mockReconIssueCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            check_name: 'STORED_VALUE_LEDGER',
            severity: 'BLOCKER',
          }),
        ]),
      })
    );
  });

  it('persists total_checked dynamically (not the magic-8 from pre-Phase-4)', async () => {
    await runReconciliation(TENANT, defaultParams);

    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          total_checked: RECONCILIATION_TOTAL_CHECKS,
        }),
      })
    );
    expect(RECONCILIATION_TOTAL_CHECKS).toBeGreaterThan(8);
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
