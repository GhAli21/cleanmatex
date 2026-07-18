/**
 * B01 — Refund Lineage and Reopen-Due: §14 scenario matrix.
 *
 * Covers the 18 binding scenarios of
 * docs/features/Order_Fin/Remediation_Work_Packages/B01_Refund_Lineage_And_Reopen_Due.md §14
 * at the service + classification level (D002 v2 origin-only registry,
 * D003 v2 reopen rules, D010 lineage/idempotency):
 *
 *  1–4   real-payment refunds (full / partial / repeated / record-only card)
 *  5–8   stored-value restorations (wallet / gift card / advance / loyalty→customer credit)
 *  9     goodwill concession (CN destination, mandatory reason)
 *  10    refund-and-rebill (rejected pre-B27; reopen = amount when authorized)
 *  11    manual exception (lineage forbidden, note required, bounded operator reopen)
 *  12    concurrent processors (FOR UPDATE loser fails cleanly)
 *  13–14 idempotent replay / same-key-different-payload conflict
 *  15    over-refund caps (overall, per-payment, per-credit-app)
 *  16    cancellation unwind (reopen 0)
 *  17    legacy NULL-source heuristic (synthetic — no real row can be NULL post-0404)
 *  18    snapshot / reconciliation-preparation expected values (D005 flip-ready)
 *
 * @jest-environment node
 *
 * Node env required: the service builds refund numbers with `Prisma.sql`
 * (fn_next_fin_doc_no), whose tag throws under the jsdom/browser Prisma build.
 */

const mockTransaction = jest.fn();
const mockOrderFindFirstOrThrow = jest.fn();
const mockRefundAggregate = jest.fn();
const mockRefundCreate = jest.fn();
const mockRefundFindFirst = jest.fn();
const mockRefundFindFirstOrThrow = jest.fn();
const mockRefundUpdate = jest.fn();
const mockRefundFindMany = jest.fn();
const mockPaymentFindFirst = jest.fn();
const mockCreditAppFindFirst = jest.fn();
const mockOutboxCreate = jest.fn();
const mockQueryRaw = jest.fn();
const mockRecalculateSnapshot = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

const mockTopUpWalletTx = jest.fn().mockResolvedValue({});
const mockIssueCreditNoteTx = jest.fn().mockResolvedValue({ id: 'cn-tx-1' });
jest.mock('@/lib/services/stored-value.service', () => ({
  topUpWalletTx: (...args: unknown[]) => mockTopUpWalletTx(...args),
  issueCreditNote: jest.fn().mockResolvedValue({ id: 'cn-1' }),
  issueCreditNoteTx: (...args: unknown[]) => mockIssueCreditNoteTx(...args),
}));

jest.mock('@/lib/services/order-financial-write.service', () => ({
  recalculateOrderFinancialSnapshotTx: (...args: unknown[]) => mockRecalculateSnapshot(...args),
}));

import {
  initiateRefund,
  processRefund,
  mapCreditTypeToRefundSource,
  resolveReopensDueAmount,
  RefundValidationError,
} from '@/lib/services/order-refund.service';
import {
  REFUND_CONTEXTS,
  REFUND_ERROR_CODES,
  REFUND_SOURCE_TYPES,
} from '@/lib/constants/order-financial';
import { Decimal } from '@prisma/client/runtime/library';

// Real classifier for the snapshot-preparation assertions (§14 #17/#18) —
// the module is mocked above for the service import, so pull the actual one.
const { classifyRefunds } = jest.requireActual<
  typeof import('@/lib/services/order-financial-write.service')
>('@/lib/services/order-financial-write.service');

const TENANT = 'tenant-b01';
const ORDER = 'order-b01';
const REFUND = 'refund-b01';
const PAYMENT = 'payment-b01';
const CREDIT_APP = 'credit-app-b01';
const REQUESTER = 'staff-b01';
const PROCESSOR = 'manager-b01';

const makeOrder = (paid = 100, credits = 0) => ({
  id: ORDER,
  tenant_org_id: TENANT,
  order_no: 'ORD-B01',
  customer_id: 'cust-b01',
  branch_id: null,
  currency_code: 'OMR',
  total_paid_amount: new Decimal(String(paid)),
  total_credit_applied_amount: new Decimal(String(credits)),
});

const makeApprovedRefund = (overrides: Record<string, unknown> = {}) => ({
  id: REFUND,
  tenant_org_id: TENANT,
  order_id: ORDER,
  refund_no: 'REF-B01',
  refund_amount: new Decimal('30'),
  refund_method_code: 'CASH',
  currency_code: 'OMR',
  refund_status: 'APPROVED',
  refund_source_type: REFUND_SOURCE_TYPES.REAL_PAYMENT_REFUND,
  refund_context: REFUND_CONTEXTS.STANDARD,
  original_payment_id: PAYMENT,
  original_credit_app_id: null,
  reopens_due_amount: new Decimal('0'),
  metadata: {},
  ...overrides,
});

const baseParams = {
  orderId: ORDER,
  amount: 30,
  reason: 'QUALITY' as const,
  method: 'CASH' as const,
  refundContext: REFUND_CONTEXTS.STANDARD,
  requestedBy: REQUESTER,
  currencyCode: 'OMR',
  idempotencyKey: 'b01-key-1',
};

/**
 * Aggregate mock router: the service sums PROCESSED refunds three ways —
 * overall (no lineage filter), per-payment, and per-credit-app. Route each
 * call by the where-clause shape so scenarios can vary the prior totals.
 */
function installAggregateSums(sums: {
  overall?: number;
  perPayment?: number;
  perCreditApp?: number;
}) {
  mockRefundAggregate.mockImplementation(async (args: { where?: Record<string, unknown> }) => {
    const where = args?.where ?? {};
    let total = sums.overall ?? 0;
    if (where.original_payment_id) total = sums.perPayment ?? 0;
    if (where.original_credit_app_id) total = sums.perCreditApp ?? 0;
    return { _sum: { refund_amount: new Decimal(String(total)) } };
  });
}

function installTxMock() {
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const txMock = {
      org_orders_mst: { findFirstOrThrow: mockOrderFindFirstOrThrow },
      org_order_refunds_dtl: {
        aggregate: mockRefundAggregate,
        create: mockRefundCreate,
        findFirst: mockRefundFindFirst,
        findFirstOrThrow: mockRefundFindFirstOrThrow,
        update: mockRefundUpdate,
        findMany: mockRefundFindMany,
      },
      org_order_payments_dtl: { findFirst: mockPaymentFindFirst },
      org_order_credit_apps_dtl: { findFirst: mockCreditAppFindFirst },
      org_domain_events_outbox: { create: mockOutboxCreate },
      $queryRaw: mockQueryRaw,
    };
    return fn(txMock);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  installTxMock();
  installAggregateSums({});
  mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder(100));
  mockRefundFindFirst.mockResolvedValue(null);
  mockRefundFindMany.mockResolvedValue([]);
  mockQueryRaw.mockResolvedValue([{ doc_no: 'REF-B01' }]);
  mockRefundCreate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: REFUND,
    ...args.data,
  }));
  mockRefundUpdate.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
    id: REFUND,
    ...args.data,
  }));
  mockRecalculateSnapshot.mockResolvedValue({ paymentStatus: 'PAID', outstandingAmount: 0 });
  mockPaymentFindFirst.mockResolvedValue({
    id: PAYMENT,
    amount: new Decimal('100'),
    payment_status: 'COMPLETED',
  });
  mockCreditAppFindFirst.mockResolvedValue({
    id: CREDIT_APP,
    credit_type: 'WALLET',
    applied_amount: new Decimal('100'),
  });
});

// ── §14 #1–#4 — real-payment refunds ────────────────────────────────────────

describe('B01 §14 — real-payment refunds (scenarios 1–4)', () => {
  it('#1 full cash refund, STANDARD: classified REAL_PAYMENT_REFUND, reopen 0, order stays settled', async () => {
    await initiateRefund(TENANT, { ...baseParams, amount: 100, originalPaymentId: PAYMENT });

    expect(mockRefundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refund_source_type: REFUND_SOURCE_TYPES.REAL_PAYMENT_REFUND,
          refund_context: REFUND_CONTEXTS.STANDARD,
          original_payment_id: PAYMENT,
          original_credit_app_id: null,
        }),
      })
    );

    mockQueryRaw.mockResolvedValue([{ id: REFUND }]); // FOR UPDATE lock
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({ refund_amount: new Decimal('100') })
    );
    await processRefund(TENANT, REFUND, PROCESSOR);

    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refund_status: 'PROCESSED', reopens_due_amount: 0 }),
      })
    );
    expect(mockRecalculateSnapshot).toHaveBeenCalledTimes(1);
  });

  it('#2 partial cash refund, STANDARD: caps hold, reopen 0', async () => {
    await initiateRefund(TENANT, { ...baseParams, amount: 30, originalPaymentId: PAYMENT });
    expect(mockRefundCreate).toHaveBeenCalledTimes(1);

    mockQueryRaw.mockResolvedValue([{ id: REFUND }]);
    mockRefundFindFirstOrThrow.mockResolvedValue(makeApprovedRefund());
    await processRefund(TENANT, REFUND, PROCESSOR);
    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reopens_due_amount: 0 }) })
    );
  });

  it('#3 repeated partial refunds: Σ per payment stays capped at the source amount', async () => {
    // Order paid 200 (overall headroom 120) but 80 of the 100 payment leg is
    // already refunded — the per-payment cap must trip, not the overall one.
    mockOrderFindFirstOrThrow.mockResolvedValue(makeOrder(200));
    installAggregateSums({ overall: 80, perPayment: 80 });

    await expect(
      initiateRefund(TENANT, { ...baseParams, amount: 30, originalPaymentId: PAYMENT })
    ).rejects.toThrow(/exceeds remaining refundable source amount/i);
    expect(mockRefundCreate).not.toHaveBeenCalled();
  });

  it('#4 card refund (record-only): classification + context written; no drawer/gateway/stored-value execution', async () => {
    await initiateRefund(TENANT, {
      ...baseParams,
      method: 'ORIGINAL_METHOD',
      originalPaymentId: PAYMENT,
    });
    expect(mockRefundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refund_source_type: REFUND_SOURCE_TYPES.REAL_PAYMENT_REFUND,
          refund_method_code: 'ORIGINAL_METHOD',
        }),
      })
    );

    mockQueryRaw.mockResolvedValue([{ id: REFUND }]);
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({ refund_method_code: 'ORIGINAL_METHOD' })
    );
    await processRefund(TENANT, REFUND, PROCESSOR);

    expect(mockTopUpWalletTx).not.toHaveBeenCalled();
    expect(mockIssueCreditNoteTx).not.toHaveBeenCalled();
    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ refund_status: 'PROCESSED' }) })
    );
  });
});

// ── §14 #5–#8 — stored-value restorations ───────────────────────────────────

describe('B01 §14 — stored-value restorations (scenarios 5–8)', () => {
  const restoreCases: Array<{ scenario: string; creditType: string; expected: string }> = [
    { scenario: '#5 wallet application', creditType: 'WALLET', expected: REFUND_SOURCE_TYPES.WALLET_RESTORE },
    { scenario: '#6 gift-card application', creditType: 'GIFT_CARD', expected: REFUND_SOURCE_TYPES.GIFT_CARD_RESTORE },
    { scenario: '#7 advance application', creditType: 'ADVANCE', expected: REFUND_SOURCE_TYPES.CUSTOMER_ADVANCE_RESTORE },
    { scenario: '#8 loyalty application', creditType: 'LOYALTY_POINTS', expected: REFUND_SOURCE_TYPES.CUSTOMER_CREDIT_RESTORE },
  ];

  restoreCases.forEach(({ scenario, creditType, expected }) => {
    it(`${scenario} derives ${expected} from the credit application lineage`, async () => {
      mockCreditAppFindFirst.mockResolvedValue({
        id: CREDIT_APP,
        credit_type: creditType,
        applied_amount: new Decimal('100'),
      });

      await initiateRefund(TENANT, {
        ...baseParams,
        method: 'WALLET',
        originalCreditAppId: CREDIT_APP,
      });

      expect(mockRefundCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            refund_source_type: expected,
            original_credit_app_id: CREDIT_APP,
            original_payment_id: null,
          }),
        })
      );
    });
  });

  it('#5 wallet destination executes exactly one keyed wallet ledger credit, reopen 0', async () => {
    mockQueryRaw.mockResolvedValue([{ id: REFUND }]);
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({
        refund_method_code: 'WALLET',
        refund_source_type: REFUND_SOURCE_TYPES.WALLET_RESTORE,
        original_payment_id: null,
        original_credit_app_id: CREDIT_APP,
      })
    );

    await processRefund(TENANT, REFUND, PROCESSOR);

    expect(mockTopUpWalletTx).toHaveBeenCalledTimes(1);
    expect(mockTopUpWalletTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: `refund-${REFUND}-wallet` })
    );
    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reopens_due_amount: 0 }) })
    );
  });
});

// ── §14 #9 — goodwill concession ────────────────────────────────────────────

describe('B01 §14 — goodwill concession (scenario 9)', () => {
  it('derives GOODWILL_CONCESSION for a no-lineage refund with a mandatory reason', async () => {
    await initiateRefund(TENANT, {
      ...baseParams,
      method: 'CREDIT_NOTE',
      notes: 'price concession for damaged garment',
    });

    expect(mockRefundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refund_source_type: REFUND_SOURCE_TYPES.GOODWILL_CONCESSION,
          refund_method_code: 'CREDIT_NOTE',
          original_payment_id: null,
          original_credit_app_id: null,
        }),
      })
    );
  });

  it('rejects a no-lineage refund without a reason note', async () => {
    await expect(
      initiateRefund(TENANT, { ...baseParams, method: 'CREDIT_NOTE' })
    ).rejects.toMatchObject({ code: REFUND_ERROR_CODES.REFUND_CONTEXT_INVALID });
    expect(mockRefundCreate).not.toHaveBeenCalled();
  });

  it('processes the CN destination once (keyed) with reopen 0 — order stays settled', async () => {
    mockQueryRaw.mockResolvedValue([{ id: REFUND }]);
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({
        refund_method_code: 'CREDIT_NOTE',
        refund_source_type: REFUND_SOURCE_TYPES.GOODWILL_CONCESSION,
        original_payment_id: null,
      })
    );

    await processRefund(TENANT, REFUND, PROCESSOR);

    expect(mockIssueCreditNoteTx).toHaveBeenCalledTimes(1);
    expect(mockIssueCreditNoteTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idempotencyKey: `refund-${REFUND}-cn` })
    );
    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reopens_due_amount: 0 }) })
    );
  });
});

// ── §14 #10 — refund-and-rebill ─────────────────────────────────────────────

describe('B01 §14 — refund-and-rebill (scenario 10)', () => {
  it('rejects REFUND_AND_REBILL explicitly until the B27 permission code ships', async () => {
    await expect(
      initiateRefund(TENANT, {
        ...baseParams,
        refundContext: REFUND_CONTEXTS.REFUND_AND_REBILL,
        originalPaymentId: PAYMENT,
        notes: 'rebill after mischarge',
      })
    ).rejects.toMatchObject({
      code: REFUND_ERROR_CODES.REFUND_AND_REBILL_NOT_AVAILABLE,
      httpStatus: 403,
    });
    expect(mockRefundCreate).not.toHaveBeenCalled();
  });

  it('with authorization + reason: creates the row and reopens the full amount at process', async () => {
    await initiateRefund(TENANT, {
      ...baseParams,
      refundContext: REFUND_CONTEXTS.REFUND_AND_REBILL,
      originalPaymentId: PAYMENT,
      notes: 'rebill after mischarge',
      rebillAuthorized: true,
    });
    expect(mockRefundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refund_context: REFUND_CONTEXTS.REFUND_AND_REBILL }),
      })
    );

    mockQueryRaw.mockResolvedValue([{ id: REFUND }]);
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({ refund_context: REFUND_CONTEXTS.REFUND_AND_REBILL })
    );
    await processRefund(TENANT, REFUND, PROCESSOR);

    // D003 v2: the explicit rebill is the ONLY commercial path that reopens due.
    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reopens_due_amount: 30 }) })
    );
  });

  it('requires the original payment lineage (restore sources reopen via the credits term, never rebill)', async () => {
    await expect(
      initiateRefund(TENANT, {
        ...baseParams,
        refundContext: REFUND_CONTEXTS.REFUND_AND_REBILL,
        notes: 'rebill attempt without lineage',
        rebillAuthorized: true,
      })
    ).rejects.toMatchObject({ code: REFUND_ERROR_CODES.REFUND_SOURCE_LINEAGE_MISMATCH });
  });
});

// ── §14 #11 — manual exception ──────────────────────────────────────────────

describe('B01 §14 — manual exception (scenario 11)', () => {
  const manualParams = {
    ...baseParams,
    refundContext: REFUND_CONTEXTS.MANUAL_EXCEPTION,
    refundScope: 'MANUAL_EXCEPTION' as const,
    notes: 'operator exception with documented cause',
  };

  it('forbids lineage on manual exceptions', async () => {
    await expect(
      initiateRefund(TENANT, { ...manualParams, originalPaymentId: PAYMENT })
    ).rejects.toMatchObject({ code: REFUND_ERROR_CODES.REFUND_SOURCE_LINEAGE_MISMATCH });
  });

  it('requires a non-empty reason note', async () => {
    await expect(
      initiateRefund(TENANT, { ...manualParams, notes: '   ' })
    ).rejects.toThrow(/non-empty reason note/i);
  });

  it('rejects an operator reopen outside 0..refund_amount', async () => {
    await expect(
      initiateRefund(TENANT, { ...manualParams, reopensDueAmount: 40 })
    ).rejects.toMatchObject({ code: REFUND_ERROR_CODES.REFUND_REOPEN_INVALID });
  });

  it('rejects an operator reopen on non-manual contexts', async () => {
    await expect(
      initiateRefund(TENANT, {
        ...baseParams,
        notes: 'standard with reopen override',
        reopensDueAmount: 5,
      })
    ).rejects.toMatchObject({ code: REFUND_ERROR_CODES.REFUND_REOPEN_INVALID });
  });

  it('honors a bounded operator reopen at process time', async () => {
    await initiateRefund(TENANT, { ...manualParams, reopensDueAmount: 10 });
    expect(mockRefundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refund_source_type: REFUND_SOURCE_TYPES.MANUAL_EXCEPTION,
          metadata: expect.objectContaining({ requested_reopen_amount: 10 }),
        }),
      })
    );

    mockQueryRaw.mockResolvedValue([{ id: REFUND }]);
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({
        refund_context: REFUND_CONTEXTS.MANUAL_EXCEPTION,
        refund_source_type: REFUND_SOURCE_TYPES.MANUAL_EXCEPTION,
        original_payment_id: null,
        metadata: { requested_reopen_amount: 10 },
      })
    );
    await processRefund(TENANT, REFUND, PROCESSOR);

    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reopens_due_amount: 10 }) })
    );
  });
});

// ── §14 #12–#14 — concurrency and idempotency ───────────────────────────────

describe('B01 §14 — concurrency and idempotency (scenarios 12–14)', () => {
  it('#12 concurrent processors: the loser fails cleanly with no double ledger credit', async () => {
    mockQueryRaw.mockResolvedValue([]); // lock lost — row already PROCESSED

    await expect(processRefund(TENANT, REFUND, PROCESSOR)).rejects.toThrow(
      /not awaiting processing/i
    );
    expect(mockTopUpWalletTx).not.toHaveBeenCalled();
    expect(mockIssueCreditNoteTx).not.toHaveBeenCalled();
    expect(mockRefundUpdate).not.toHaveBeenCalled();
  });

  it('#13 duplicate retry (same key, same payload): returns the original row, zero new effects', async () => {
    const existing = makeApprovedRefund({
      refund_amount: new Decimal('30'),
      idempotency_key: baseParams.idempotencyKey,
      original_payment_id: PAYMENT,
    });
    mockRefundFindFirst.mockResolvedValue(existing);

    const result = await initiateRefund(TENANT, { ...baseParams, originalPaymentId: PAYMENT });

    expect(result).toBe(existing);
    expect(mockRefundCreate).not.toHaveBeenCalled();
    expect(mockOutboxCreate).not.toHaveBeenCalled();
  });

  it('#14 same key + different payload: explicit conflict error, no silent replay', async () => {
    mockRefundFindFirst.mockResolvedValue(
      makeApprovedRefund({
        refund_amount: new Decimal('99'), // differs from the retried amount
        idempotency_key: baseParams.idempotencyKey,
        original_payment_id: PAYMENT,
      })
    );

    await expect(
      initiateRefund(TENANT, { ...baseParams, originalPaymentId: PAYMENT })
    ).rejects.toMatchObject({
      code: REFUND_ERROR_CODES.REFUND_IDEMPOTENCY_CONFLICT,
      httpStatus: 409,
    });
    expect(mockRefundCreate).not.toHaveBeenCalled();
  });
});

// ── §14 #15 — over-refund caps ──────────────────────────────────────────────

describe('B01 §14 — over-refund caps (scenario 15)', () => {
  it('rejects above the overall refundable balance', async () => {
    installAggregateSums({ overall: 90 }); // 90 of the 100 already refunded

    await expect(
      initiateRefund(TENANT, { ...baseParams, amount: 20, originalPaymentId: PAYMENT })
    ).rejects.toThrow(/exceeds refundable balance/i);
  });

  it('rejects above the per-credit-app remaining amount (indexed column cap)', async () => {
    installAggregateSums({ perCreditApp: 95 }); // 95 of the 100 applied already restored

    await expect(
      initiateRefund(TENANT, {
        ...baseParams,
        amount: 10,
        method: 'WALLET',
        originalCreditAppId: CREDIT_APP,
      })
    ).rejects.toThrow(/exceeds remaining refundable credit amount/i);
  });

  it('re-checks the per-payment cap at process time (concurrent partials serialize)', async () => {
    mockQueryRaw.mockResolvedValue([{ id: REFUND }]);
    installAggregateSums({ perPayment: 90 }); // another partial processed after approval
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({ refund_amount: new Decimal('30') })
    );

    await expect(processRefund(TENANT, REFUND, PROCESSOR)).rejects.toThrow(
      /exceeds remaining refundable source amount/i
    );
    expect(mockRefundUpdate).not.toHaveBeenCalled();
  });
});

// ── §14 #16 — cancellation unwind ───────────────────────────────────────────

describe('B01 §14 — cancellation unwind (scenario 16)', () => {
  it('CANCELLATION_UNWIND refunds classify normally and never reopen due', async () => {
    await initiateRefund(TENANT, {
      ...baseParams,
      refundContext: REFUND_CONTEXTS.CANCELLATION_UNWIND,
      method: 'ORIGINAL_METHOD',
      originalPaymentId: PAYMENT,
      notes: 'Order cancelled: customer request',
    });
    expect(mockRefundCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refund_context: REFUND_CONTEXTS.CANCELLATION_UNWIND,
          refund_source_type: REFUND_SOURCE_TYPES.REAL_PAYMENT_REFUND,
        }),
      })
    );

    mockQueryRaw.mockResolvedValue([{ id: REFUND }]);
    mockRefundFindFirstOrThrow.mockResolvedValue(
      makeApprovedRefund({
        refund_context: REFUND_CONTEXTS.CANCELLATION_UNWIND,
        refund_method_code: 'ORIGINAL_METHOD',
      })
    );
    await processRefund(TENANT, REFUND, PROCESSOR);

    expect(mockRefundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reopens_due_amount: 0 }) })
    );
  });
});

// ── §14 #17–#18 — legacy heuristic + snapshot/recon preparation ─────────────

describe('B01 §14 — legacy fallback and snapshot preparation (scenarios 17–18)', () => {
  type RefundFactRow = Parameters<typeof classifyRefunds>[0][number];

  function row(
    overrides: Partial<RefundFactRow> & { refund_amount: number; reopens_due_amount?: number }
  ): RefundFactRow {
    return {
      refund_amount: new Decimal(overrides.refund_amount),
      refund_status: overrides.refund_status ?? 'PROCESSED',
      refund_method_code: overrides.refund_method_code ?? null,
      original_payment_id: overrides.original_payment_id ?? null,
      refund_source_type: overrides.refund_source_type ?? null,
      reopens_due_amount: new Decimal(overrides.reopens_due_amount ?? 0),
      metadata: overrides.metadata ?? {},
    };
  }

  it('#17 a synthetic NULL-source row still classifies via the heuristic and unknown methods warn', () => {
    const result = classifyRefunds([
      row({ refund_amount: 60, refund_method_code: 'CASH' }),
      row({ refund_amount: 5, refund_method_code: 'UNKNOWN_LEGACY' }),
    ]);
    expect(result.realPaymentRefundedAmount).toBe(60);
    expect(result.hasUnclassifiedRefundSource).toBe(true);
  });

  it('#18 snapshot expected values: commercial refunds leave outstanding at 0; only explicit reopen rows raise it (D005 flip-ready)', () => {
    const totalAmount = 100;
    const totalPaid = 100;
    const totalCredits = 0;

    // Commercial STANDARD refund of a real payment — order stays settled.
    const commercial = classifyRefunds([
      row({
        refund_amount: 40,
        refund_source_type: REFUND_SOURCE_TYPES.REAL_PAYMENT_REFUND,
        refund_method_code: 'CASH',
        original_payment_id: PAYMENT,
      }),
    ]);
    expect(commercial.refundedAmount).toBe(40);
    expect(commercial.realPaymentRefundedAmount).toBe(40); // net collected drops by 40
    expect(commercial.refundReopensDueAmount).toBe(0);
    const outstandingCommercial = Math.max(
      0,
      totalAmount - totalPaid - totalCredits + commercial.refundReopensDueAmount
    );
    expect(outstandingCommercial).toBe(0); // §7: outstanding unchanged by commercial refunds

    // Explicit rebill row — the ONLY commercial path that reopens due.
    const rebill = classifyRefunds([
      row({
        refund_amount: 40,
        refund_source_type: REFUND_SOURCE_TYPES.REAL_PAYMENT_REFUND,
        refund_method_code: 'CASH',
        original_payment_id: PAYMENT,
        reopens_due_amount: 40,
      }),
    ]);
    const outstandingRebill = Math.max(
      0,
      totalAmount - totalPaid - totalCredits + rebill.refundReopensDueAmount
    );
    expect(outstandingRebill).toBe(40); // order reopens exactly the rebilled amount

    // Stored-value restoration — reopen 0 on the refund row (invariant 4:
    // outstanding moves only via the paired credit-application reversal).
    const restore = classifyRefunds([
      row({
        refund_amount: 25,
        refund_source_type: REFUND_SOURCE_TYPES.WALLET_RESTORE,
        refund_method_code: 'WALLET',
      }),
    ]);
    expect(restore.storedValueRestoredAmount).toBe(25);
    expect(restore.realPaymentRefundedAmount).toBe(0); // net collected untouched
    expect(restore.refundReopensDueAmount).toBe(0);
  });
});

// ── Helper units — D002 v2 mapping + D003 v2 reopen rule ────────────────────

describe('B01 helpers — mapCreditTypeToRefundSource / resolveReopensDueAmount', () => {
  it('maps every credit application type to its origin-only source (D002 v2)', () => {
    expect(mapCreditTypeToRefundSource('GIFT_CARD')).toBe(REFUND_SOURCE_TYPES.GIFT_CARD_RESTORE);
    expect(mapCreditTypeToRefundSource('WALLET')).toBe(REFUND_SOURCE_TYPES.WALLET_RESTORE);
    expect(mapCreditTypeToRefundSource('ADVANCE')).toBe(REFUND_SOURCE_TYPES.CUSTOMER_ADVANCE_RESTORE);
    expect(mapCreditTypeToRefundSource('CUSTOMER_ADVANCE')).toBe(REFUND_SOURCE_TYPES.CUSTOMER_ADVANCE_RESTORE);
    expect(mapCreditTypeToRefundSource('CREDIT_NOTE')).toBe(REFUND_SOURCE_TYPES.CUSTOMER_CREDIT_RESTORE);
    expect(mapCreditTypeToRefundSource('CUSTOMER_CREDIT')).toBe(REFUND_SOURCE_TYPES.CUSTOMER_CREDIT_RESTORE);
    expect(mapCreditTypeToRefundSource('LOYALTY_POINTS')).toBe(REFUND_SOURCE_TYPES.CUSTOMER_CREDIT_RESTORE);
    expect(mapCreditTypeToRefundSource('LOYALTY_CREDIT')).toBe(REFUND_SOURCE_TYPES.CUSTOMER_CREDIT_RESTORE);
    expect(mapCreditTypeToRefundSource('SOMETHING_ELSE')).toBeNull();
    expect(mapCreditTypeToRefundSource(null)).toBeNull();
  });

  it('applies the D003 v2 reopen table', () => {
    expect(resolveReopensDueAmount(REFUND_CONTEXTS.STANDARD, 50)).toBe(0);
    expect(resolveReopensDueAmount(REFUND_CONTEXTS.PRICE_ADJUSTMENT_GOODWILL, 50)).toBe(0);
    expect(resolveReopensDueAmount(REFUND_CONTEXTS.CANCELLATION_UNWIND, 50)).toBe(0);
    expect(resolveReopensDueAmount(REFUND_CONTEXTS.REFUND_AND_REBILL, 50)).toBe(50);
    expect(resolveReopensDueAmount(REFUND_CONTEXTS.MANUAL_EXCEPTION, 50, 20)).toBe(20);
    expect(resolveReopensDueAmount(REFUND_CONTEXTS.MANUAL_EXCEPTION, 50, null)).toBe(0);
    expect(() => resolveReopensDueAmount(REFUND_CONTEXTS.MANUAL_EXCEPTION, 50, 60)).toThrow(
      RefundValidationError
    );
    expect(() => resolveReopensDueAmount(REFUND_CONTEXTS.MANUAL_EXCEPTION, 50, -1)).toThrow(
      RefundValidationError
    );
  });
});
