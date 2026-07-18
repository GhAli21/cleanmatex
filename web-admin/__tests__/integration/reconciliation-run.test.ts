/// <reference types="jest" />

/**
 * Integration test: BVM Phase 4 reconciliation orchestrator with known
 * mismatches across the order, wallet, and outbox surfaces.
 *
 * Verifies the bulk-insert contract (R7 fix): the orchestrator must publish
 * every issue through a single `createMany` call rather than the pre-Phase-4
 * per-row insert loop. Assertions read the array passed to `createMany`.
 */

const mockOrderFindMany = jest.fn();
const mockOrderFindUnique = jest.fn();
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
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn('tenant-recon-int')
  ),
}));

import { Decimal } from '@prisma/client/runtime/library';
import { acknowledgeIssue, runReconciliation } from '@/lib/services/reconciliation.service';

const TENANT = 'tenant-recon-int';
const RUN = 'run-int-001';

function setupBaselineEmpty() {
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
  mockReconRunCount.mockResolvedValue(0);
  mockReconRunCreate.mockResolvedValue({ id: RUN, run_no: 'RECON-2026-001' });
  mockReconRunUpdate.mockResolvedValue({ id: RUN });
  mockReconIssueCreateMany.mockResolvedValue({ count: 0 });
}

function setupKnownMismatches() {
  setupBaselineEmpty();
  // PAYMENT_TOTAL_MATCH + OUTSTANDING_TOTAL_MATCH on this order:
  // header says total_paid=100, but completed payments only sum to 80.
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
  mockOrderFindUnique.mockResolvedValue({ total_charges_amount: new Decimal('0') });
  // STORED_VALUE_LEDGER on wallet w1: balance=200, ledger sum=180.
  mockWalletFindMany.mockResolvedValue([
    { id: 'w1', balance: new Decimal('200') },
  ]);
  mockWalletTxnAggregate.mockResolvedValue({ _sum: { amount: new Decimal('180') } });
}

/** Extract the flat list of issue rows that landed in `createMany`. */
function persistedIssues(): Array<{ check_name: string; severity: string }> {
  return mockReconIssueCreateMany.mock.calls
    .flatMap((call: unknown[]) => (call[0] as { data: Array<{ check_name: string; severity: string }> }).data);
}

describe('reconciliation-run integration - bulk persistence', () => {
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

  it('publishes issues through a single createMany call (R7 fix)', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'),
      periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    expect(mockReconIssueCreateMany).toHaveBeenCalledTimes(1);
    const data = persistedIssues();
    expect(data.length).toBeGreaterThanOrEqual(3); // PAYMENT, OUTSTANDING, STORED_VALUE_LEDGER
    for (const row of data) {
      expect(row.severity).toBe('BLOCKER');
    }
  });

  it('writes PAYMENT_TOTAL_MATCH for the seeded payment mismatch', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'),
      periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    expect(persistedIssues()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ check_name: 'PAYMENT_TOTAL_MATCH' }),
      ])
    );
  });

  it('writes STORED_VALUE_LEDGER for the seeded wallet drift', async () => {
    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'),
      periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    expect(persistedIssues()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ check_name: 'STORED_VALUE_LEDGER' }),
      ])
    );
  });

  it('clean run: returns PASSED and skips createMany when no issues found', async () => {
    setupBaselineEmpty();

    await runReconciliation(TENANT, {
      periodFrom: new Date('2026-05-01'),
      periodTo: new Date('2026-05-31'),
      currencyCode: 'OMR',
    });

    expect(mockReconRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PASSED' }) })
    );
    expect(mockReconIssueCreateMany).not.toHaveBeenCalled();
  });

  it('acknowledgeIssue updates status to ACKNOWLEDGED', async () => {
    mockReconIssueUpdate.mockResolvedValue({ id: 'issue-1', status: 'ACKNOWLEDGED' });

    await acknowledgeIssue(TENANT, 'issue-1', 'ACKNOWLEDGED', 'Reviewed OK', 'manager-1');

    expect(mockReconIssueUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACKNOWLEDGED' }) })
    );
  });
});
