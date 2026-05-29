const mockOrderFindMany = jest.fn();
const mockInvoiceCreate = jest.fn();
const mockInvoiceFindUnique = jest.fn();
const mockTxInvoiceFindUnique = jest.fn();
const mockTransaction = jest.fn();
const mockIdempotencyFindFirst = jest.fn();
const mockIdempotencyUpsert = jest.fn();
const mockOrdersDtlCreateMany = jest.fn();
const mockLinesDtlCreateMany = jest.fn();
const mockHistoryCreate = jest.fn();
const mockLedgerFindFirst = jest.fn();
const mockLedgerCreate = jest.fn();
const mockQueryRaw = jest.fn();
const mockEmitEventTx = jest.fn();
const mockDispatchInvoiceCreated = jest.fn();

// The real @prisma/client ships a browser/node shim whose `Prisma.sql` throws
// when invoked outside a real Prisma client context. The service uses it only
// to build the raw-SQL invoice-number query argument; we substitute a stub
// that returns the template parts so `tx.$queryRaw` mocks can ignore the
// argument shape entirely.
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  },
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    org_invoice_mst: {
      findUnique: (...args: unknown[]) => mockInvoiceFindUnique(...args),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-123'),
  withTenantContext: jest.fn(async (_tenantId: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/services/outbox.service', () => ({
  emitEventTx: (...args: unknown[]) => mockEmitEventTx(...args),
}));

jest.mock('@/lib/services/erp-lite-auto-post.service', () => ({
  ErpLiteAutoPostService: {
    dispatchInvoiceCreatedInTransaction: (...args: unknown[]) => mockDispatchInvoiceCreated(...args),
  },
}));

import {
  AR_INVOICE_STATUSES,
  AR_LEDGER_MOVEMENTS,
} from '@/lib/constants/ar-invoice';
import {
  OUTBOX_EVENT_TYPES,
  SETTLEMENT_TYPE_CODES,
} from '@/lib/constants/order-financial';
import { createArInvoiceFromOrders } from '@/lib/services/ar-invoice.service';

/**
 * Mock Prisma transaction client passed to the producer. Each mock fn returns
 * a default; individual tests can override per scenario.
 */
function buildTxMock() {
  return {
    org_idempotency_keys: {
      findFirst: mockIdempotencyFindFirst,
      upsert: mockIdempotencyUpsert,
    },
    org_orders_mst: {
      findMany: mockOrderFindMany,
    },
    org_invoice_mst: {
      create: mockInvoiceCreate,
      findUnique: mockTxInvoiceFindUnique,
    },
    org_invoice_orders_dtl: {
      createMany: mockOrdersDtlCreateMany,
    },
    org_invoice_lines_dtl: {
      createMany: mockLinesDtlCreateMany,
    },
    org_invoice_status_history_dtl: {
      create: mockHistoryCreate,
    },
    org_customer_ar_ledger_dtl: {
      findFirst: mockLedgerFindFirst,
      create: mockLedgerCreate,
    },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  };
}

describe('ar-invoice.service createArInvoiceFromOrders', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(buildTxMock())
    );

    mockIdempotencyFindFirst.mockResolvedValue(null);
    mockIdempotencyUpsert.mockResolvedValue(null);

    // Default invoice-number raw query returns a stable doc number.
    mockQueryRaw.mockResolvedValue([{ doc_no: 'AR-INV-0001' }]);

    // Default ERP-lite dispatcher returns a benign "no policy configured"
    // shape so the assert gate is satisfied for tests that don't customise it.
    mockDispatchInvoiceCreated.mockResolvedValue({
      status: 'skipped',
      policy: null,
      skip_reason: 'no_policy_configured',
      execute_result: null,
    });

    // Default ledger findFirst returns no prior row so running_balance starts at 0.
    mockLedgerFindFirst.mockResolvedValue(null);

    // Default getArInvoiceDetail returns a stub-ish shape used as a return value.
    // The producer only reads `created.id` etc from the createInvoice mock —
    // getArInvoiceDetail is called once at the end for the resourceId/data result.
    mockInvoiceFindUnique.mockImplementation(async (args: { where: { id_tenant_org_id: { id: string } } }) => ({
      id: args.where.id_tenant_org_id.id,
      tenant_org_id: 'tenant-123',
      invoice_no: 'AR-INV-0001',
      customer_id: 'customer-1',
      order_id: 'order-1',
      branch_id: 'branch-1',
      currency_code: 'OMR',
      currency_ex_rate: 1,
      subtotal: 50,
      discount: 0,
      tax: 0,
      total: 50,
      paid_amount: 0,
      outstanding_amount: 50,
      due_date: null,
      status: AR_INVOICE_STATUSES.OPEN,
      invoice_type_cd: 'ORDER_CREDIT',
      invoice_date: new Date('2026-05-29'),
      issued_at: new Date('2026-05-29'),
      issued_by: 'user-123',
      created_at: new Date('2026-05-29'),
      updated_at: null,
      metadata: null,
      org_customers_mst: { name: 'Acme', name2: null },
      org_orders_mst: { order_no: 'ORD-1001' },
      org_invoice_lines_dtl: [],
      org_invoice_orders_dtl: [],
      org_invoice_payments_dtl: [],
      org_invoice_adjustments_dtl: [],
      org_invoice_status_history_dtl: [],
      org_customer_ar_ledger_dtl: [],
    }));

    mockTxInvoiceFindUnique.mockImplementation(async (args: { where: { id_tenant_org_id: { id: string } } }) => ({
      id: args.where.id_tenant_org_id.id,
      tenant_org_id: 'tenant-123',
      invoice_no: 'AR-INV-0001',
      customer_id: 'customer-1',
      order_id: 'order-1',
      branch_id: 'branch-1',
      currency_code: 'OMR',
      currency_ex_rate: 1,
      subtotal: 50,
      discount: 0,
      tax: 0,
      total: 50,
      paid_amount: 0,
      outstanding_amount: 50,
      due_date: null,
      status: AR_INVOICE_STATUSES.OPEN,
      invoice_type_cd: 'ORDER_CREDIT',
      invoice_date: new Date('2026-05-29'),
      issued_at: new Date('2026-05-29'),
      issued_by: 'user-123',
      created_at: new Date('2026-05-29'),
      updated_at: null,
      metadata: null,
      org_customers_mst: { name: 'Acme', name2: null },
      org_orders_mst: { order_no: 'ORD-1001' },
      org_invoice_lines_dtl: [],
      org_invoice_orders_dtl: [],
      org_invoice_payments_dtl: [],
      org_invoice_adjustments_dtl: [],
      org_invoice_status_history_dtl: [],
      org_customer_ar_ledger_dtl: [],
    }));
  });

  /**
   * Default CREDIT_INVOICE order shape used by happy-path tests.
   */
  function defaultOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: 'order-1',
      order_no: 'ORD-1001',
      customer_id: 'customer-1',
      branch_id: 'branch-1',
      total: 50,
      paid_amount: 0,
      outstanding_amount: 50,
      currency_code: 'OMR',
      currency_ex_rate: 1,
      payment_type_code: SETTLEMENT_TYPE_CODES.CREDIT_INVOICE,
      payment_due_date: null,
      payment_terms: 'Net 30',
      b2b_contract_id: null,
      cost_center_code: null,
      po_number: null,
      gift_card_id: null,
      ...overrides,
    };
  }

  /**
   * Default invoice-mst create return shape. `status` overridable so tests can
   * assert OPEN vs DRAFT behavior under issueImmediately on/off.
   */
  function setupInvoiceCreate(status: string = AR_INVOICE_STATUSES.OPEN) {
    mockInvoiceCreate.mockResolvedValue({
      id: 'invoice-1',
      tenant_org_id: 'tenant-123',
      invoice_no: 'AR-INV-0001',
      customer_id: 'customer-1',
      order_id: 'order-1',
      branch_id: 'branch-1',
      currency_code: 'OMR',
      currency_ex_rate: 1,
      subtotal: 50,
      discount: 0,
      tax: 0,
      vat_amount: 0,
      total: 50,
      paid_amount: 0,
      outstanding_amount: 50,
      status,
      invoice_date: new Date('2026-05-29'),
      due_date: new Date('2026-05-29'),
    });
  }

  it('rejects PAY_ON_COLLECTION orders before AR invoice creation starts', async () => {
    mockOrderFindMany.mockResolvedValue([
      {
        id: 'order-1',
        order_no: 'ORD-1001',
        customer_id: 'customer-1',
        branch_id: 'branch-1',
        total: 22,
        paid_amount: 0,
        outstanding_amount: 22,
        currency_code: 'OMR',
        currency_ex_rate: 1,
        payment_type_code: SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION,
        payment_due_date: new Date('2026-05-22T00:00:00.000Z'),
        payment_terms: 'Due on collection',
        b2b_contract_id: null,
        cost_center_code: null,
        po_number: null,
      },
    ]);

    await expect(
      createArInvoiceFromOrders(
        {
          order_ids: ['11111111-1111-1111-1111-111111111111'],
          idempotency_key: 'from-orders-1',
        },
        { tenantId: 'tenant-123', userId: 'user-123' }
      )
    ).rejects.toThrow('PAY_ON_COLLECTION orders cannot generate an AR invoice.');

    expect(mockInvoiceCreate).not.toHaveBeenCalled();
    expect(mockIdempotencyUpsert).not.toHaveBeenCalled();
  });

  // ─── Phase 3 (BVM Wiring) — issueImmediately + ERP-lite + gift_card_applied_amount ───

  it('Phase 3: issueImmediately:true → status OPEN, AR ledger DEBIT INVOICE_ISSUED, AR_INVOICE_ISSUED outbox', async () => {
    mockOrderFindMany.mockResolvedValue([defaultOrder()]);
    setupInvoiceCreate(AR_INVOICE_STATUSES.OPEN);

    // due_date 30 days out — keeps deriveArInvoiceStatus(OPEN) from flipping to
    // OVERDUE under millisecond drift when the producer's `dueDate` falls back
    // to today via the invoiceDate default.
    const futureDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await createArInvoiceFromOrders(
      {
        order_ids: ['11111111-1111-1111-1111-111111111111'],
        idempotency_key: 'order-1_ar',
        issueImmediately: true,
        allocation_policy: 'REMAINING_ONLY',
        due_date: futureDueDate,
      },
      { tenantId: 'tenant-123', userId: 'user-123' }
    );

    // Invoice header born OPEN (deriveArInvoiceStatus with currentStatus=OPEN,
    // no past due_date → stays OPEN), issued_at and issued_by populated atomically.
    expect(mockInvoiceCreate).toHaveBeenCalledTimes(1);
    const createPayload = mockInvoiceCreate.mock.calls[0][0].data as {
      status: string;
      issued_at: Date | null;
      issued_by: string | null;
    };
    expect(createPayload.status).toBe(AR_INVOICE_STATUSES.OPEN);
    expect(createPayload.issued_at).toBeInstanceOf(Date);
    expect(createPayload.issued_by).toBe('user-123');

    // AR ledger debit appended for the receivable; movement_cd = INVOICE_ISSUED.
    expect(mockLedgerCreate).toHaveBeenCalledTimes(1);
    const ledgerPayload = mockLedgerCreate.mock.calls[0][0].data as {
      movement_cd: string;
      entry_side: string;
      amount: number;
    };
    expect(ledgerPayload.movement_cd).toBe(AR_LEDGER_MOVEMENTS.INVOICE_ISSUED);
    expect(ledgerPayload.entry_side).toBe('DEBIT');
    expect(ledgerPayload.amount).toBe(50);

    // AR_INVOICE_ISSUED outbox event emitted.
    const emittedTypes = mockEmitEventTx.mock.calls.map((c) => c[2]);
    expect(emittedTypes).toContain(OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED);

    // ERP-lite auto-post dispatcher invoked (preserves legacy createInvoice parity).
    expect(mockDispatchInvoiceCreated).toHaveBeenCalledTimes(1);

    // Status history records the immediate-issue action.
    const historyActionCd = (
      mockHistoryCreate.mock.calls[0][0].data as { action_cd: string }
    ).action_cd;
    expect(historyActionCd).toBe('CREATE_FROM_ORDERS_ISSUED');
  });

  it('Phase 3: default (issueImmediately omitted) → status DRAFT, NO ledger debit, NO AR_INVOICE_ISSUED outbox', async () => {
    mockOrderFindMany.mockResolvedValue([defaultOrder()]);
    setupInvoiceCreate(AR_INVOICE_STATUSES.DRAFT);

    await createArInvoiceFromOrders(
      {
        order_ids: ['11111111-1111-1111-1111-111111111111'],
        idempotency_key: 'from-orders-default',
      },
      { tenantId: 'tenant-123', userId: 'user-123' }
    );

    const createPayload = mockInvoiceCreate.mock.calls[0][0].data as {
      status: string;
      issued_at: Date | null;
      issued_by: string | null;
    };
    expect(createPayload.status).toBe(AR_INVOICE_STATUSES.DRAFT);
    expect(createPayload.issued_at).toBeNull();
    expect(createPayload.issued_by).toBeNull();

    // No AR ledger debit when the invoice is still DRAFT.
    expect(mockLedgerCreate).not.toHaveBeenCalled();

    // No AR_INVOICE_ISSUED outbox event.
    const emittedTypes = mockEmitEventTx.mock.calls.map((c) => c[2]);
    expect(emittedTypes).not.toContain(OUTBOX_EVENT_TYPES.AR_INVOICE_ISSUED);

    // ERP-lite dispatcher STILL fires on creation (parity with legacy createInvoice).
    expect(mockDispatchInvoiceCreated).toHaveBeenCalledTimes(1);

    const historyActionCd = (
      mockHistoryCreate.mock.calls[0][0].data as { action_cd: string }
    ).action_cd;
    expect(historyActionCd).toBe('CREATE_FROM_ORDERS');
  });

  it('Phase 3: gift_card_applied_amount input mirrors onto invoice header for reporting parity', async () => {
    mockOrderFindMany.mockResolvedValue([
      defaultOrder({ gift_card_id: '99999999-9999-9999-9999-999999999999' }),
    ]);
    setupInvoiceCreate(AR_INVOICE_STATUSES.OPEN);

    const futureDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await createArInvoiceFromOrders(
      {
        order_ids: ['11111111-1111-1111-1111-111111111111'],
        idempotency_key: 'order-1_ar',
        issueImmediately: true,
        gift_card_applied_amount: 12.5,
        due_date: futureDueDate,
      },
      { tenantId: 'tenant-123', userId: 'user-123' }
    );

    const createPayload = mockInvoiceCreate.mock.calls[0][0].data as {
      gift_card_id: string | null;
      gift_card_applied_amount: number | null;
    };
    // Gift-card id stamped from the source order; amount stamped from input.
    expect(createPayload.gift_card_id).toBe('99999999-9999-9999-9999-999999999999');
    expect(createPayload.gift_card_applied_amount).toBe(12.5);
  });

  it('Phase 3: ERP-lite BLOCKING policy with failed dispatch → throws and aborts invoice creation', async () => {
    mockOrderFindMany.mockResolvedValue([defaultOrder()]);
    setupInvoiceCreate(AR_INVOICE_STATUSES.OPEN);

    // Simulate a BLOCKING policy that failed to execute — assertBlocking should
    // throw the error message back up so the outer tx rolls back.
    mockDispatchInvoiceCreated.mockResolvedValueOnce({
      status: 'executed',
      policy: { blocking_mode: 'BLOCKING', required_success: true },
      execute_result: { success: false, error_message: 'ERP-Lite COA missing' },
    });

    await expect(
      createArInvoiceFromOrders(
        {
          order_ids: ['11111111-1111-1111-1111-111111111111'],
          idempotency_key: 'order-1_ar',
          issueImmediately: true,
        },
        { tenantId: 'tenant-123', userId: 'user-123' }
      )
    ).rejects.toThrow('ERP-Lite COA missing');
  });

  it('Phase 3 Round 3: expected_total_amount sizes invoice to the post-discount receivable (cash + non-gift credits only)', async () => {
    // Submit-order scenario:
    //  - subtotal 2.000 + VAT 0.100 + tax 0.040 = 2.140 (gross)
    //  - gift-card pricing discount 0.100 → finalTotal 2.040 (post-discount)
    //  - cash 1.000
    //  - outstanding = finalTotal - cash = 1.040
    //
    // Round 3 fix: gift-card is a pricing discount (already in finalTotal),
    // NOT a settlement credit-app. The orchestrator computes
    // `correctedOutstanding = finalTotal - realPayment - settlementCreditApplied`
    // (where settlementCreditApplied excludes gift-card) and passes it
    // through as `expected_total_amount`. This test pins that the writer
    // honors whatever the orchestrator computed.
    mockOrderFindMany.mockResolvedValue([
      defaultOrder({ total: 2.04, outstanding_amount: 2.04 }),
    ]);
    setupInvoiceCreate(AR_INVOICE_STATUSES.OPEN);

    const futureDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await createArInvoiceFromOrders(
      {
        order_ids: ['11111111-1111-1111-1111-111111111111'],
        idempotency_key: 'order-1_ar',
        issueImmediately: true,
        expected_total_amount: 1.04, // corrected: NOT 0.94 (gift-card not subtracted twice)
        due_date: futureDueDate,
      },
      { tenantId: 'tenant-123', userId: 'user-123' }
    );

    // Invoice header reflects the actual receivable.
    const createPayload = mockInvoiceCreate.mock.calls[0][0].data as {
      subtotal: number;
      total: number;
      outstanding_amount: number;
    };
    expect(createPayload.subtotal).toBe(1.04);
    expect(createPayload.total).toBe(1.04);
    expect(createPayload.outstanding_amount).toBe(1.04);

    // Per-order link mirrors the same amount (single-order path).
    const orderLinkPayload = mockOrdersDtlCreateMany.mock.calls[0][0].data as Array<{
      invoiced_amount: number;
      outstanding_amount: number;
      order_total_amount: number;
    }>;
    expect(orderLinkPayload[0].invoiced_amount).toBe(1.04);
    expect(orderLinkPayload[0].outstanding_amount).toBe(1.04);
    // order_total_amount stays at the full sale for audit visibility.
    expect(orderLinkPayload[0].order_total_amount).toBe(2.04);

    // Line summary uses the same amount.
    const linePayload = mockLinesDtlCreateMany.mock.calls[0][0].data as Array<{
      unit_price: number;
      total_amount: number;
    }>;
    expect(linePayload[0].unit_price).toBe(1.04);
    expect(linePayload[0].total_amount).toBe(1.04);

    // AR ledger debit fires only for the receivable (no over-debit).
    expect(mockLedgerCreate).toHaveBeenCalledTimes(1);
    const ledgerPayload = mockLedgerCreate.mock.calls[0][0].data as { amount: number };
    expect(ledgerPayload.amount).toBe(1.04);
  });

  it('Phase 3 Round 2: when expected_total_amount is omitted, legacy full-sale sizing is preserved', async () => {
    // API-route flow (POST /api/v1/ar/invoices/from-orders) does NOT pass
    // expected_total_amount, so the writer must fall back to summing
    // order.outstanding_amount across orders. This pins that contract.
    mockOrderFindMany.mockResolvedValue([
      defaultOrder({ total: 2.04, outstanding_amount: 2.04 }),
    ]);
    setupInvoiceCreate(AR_INVOICE_STATUSES.DRAFT);

    await createArInvoiceFromOrders(
      {
        order_ids: ['11111111-1111-1111-1111-111111111111'],
        idempotency_key: 'from-orders-legacy',
        // no expected_total_amount, no issueImmediately
      },
      { tenantId: 'tenant-123', userId: 'user-123' }
    );

    const createPayload = mockInvoiceCreate.mock.calls[0][0].data as {
      subtotal: number;
      total: number;
    };
    expect(createPayload.subtotal).toBe(2.04);
    expect(createPayload.total).toBe(2.04);
  });

  it('Phase 3: caller-supplied tx skips outer prisma.$transaction wrapper (atomic with order tx)', async () => {
    mockOrderFindMany.mockResolvedValue([defaultOrder()]);
    setupInvoiceCreate(AR_INVOICE_STATUSES.OPEN);

    const callerTx = buildTxMock();

    await createArInvoiceFromOrders(
      {
        order_ids: ['11111111-1111-1111-1111-111111111111'],
        idempotency_key: 'order-1_ar',
        issueImmediately: true,
      },
      { tenantId: 'tenant-123', userId: 'user-123' },
      callerTx as unknown as Parameters<typeof createArInvoiceFromOrders>[2]
    );

    // The outer prisma.$transaction MUST NOT have been opened — the producer
    // joined the caller's tx directly. This guarantees order+voucher+AR
    // atomicity in the submit-order orchestrator.
    expect(mockTransaction).not.toHaveBeenCalled();
    // The producer still wrote through to the caller-supplied tx mocks.
    expect(mockInvoiceCreate).toHaveBeenCalledTimes(1);
  });

  it('Phase 3: caller-supplied tx hydrates the created invoice through the same tx reader', async () => {
    mockOrderFindMany.mockResolvedValue([defaultOrder()]);
    setupInvoiceCreate(AR_INVOICE_STATUSES.OPEN);
    mockInvoiceFindUnique.mockResolvedValueOnce(null);

    const callerTx = buildTxMock();

    await expect(
      createArInvoiceFromOrders(
        {
          order_ids: ['11111111-1111-1111-1111-111111111111'],
          idempotency_key: 'order-1_ar',
          issueImmediately: true,
        },
        { tenantId: 'tenant-123', userId: 'user-123' },
        callerTx as unknown as Parameters<typeof createArInvoiceFromOrders>[2]
      )
    ).resolves.toMatchObject({
      invoice: {
        id: 'invoice-1',
      },
    });

    expect(mockTxInvoiceFindUnique).toHaveBeenCalledTimes(1);
    expect(mockInvoiceFindUnique).not.toHaveBeenCalled();
  });
});
