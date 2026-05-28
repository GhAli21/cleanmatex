/**
 * Tests: stored-value.service
 *
 * Covers:
 * - getWalletBalance — returns balance or zeros when no wallet
 * - topUpWalletTx    — creates wallet if absent, appends ledger row
 * - redeemWalletTx   — deducts balance, idempotency skip on duplicate orderId
 * - redeemWalletTx   — throws INSUFFICIENT_BALANCE
 * - issueCreditNote  — creates credit note record
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockWalletFindFirst    = jest.fn();
const mockWalletFindFirstTx  = jest.fn();
const mockWalletCreate       = jest.fn();
const mockWalletUpdate       = jest.fn();
const mockWalletTxnCreate    = jest.fn();
const mockCreditNoteCreate   = jest.fn();
const mockWalletTxnFindFirst = jest.fn();
const mockTxQueryRaw         = jest.fn();

const mockCreditNotesCount = jest.fn().mockResolvedValue(0);

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_customer_wallets_mst: {
      findFirst: (...a: unknown[]) => mockWalletFindFirst(...a),
    },
    org_credit_notes_mst: {
      count:  (...a: unknown[]) => mockCreditNotesCount(...a),
      create: (...a: unknown[]) => mockCreditNoteCreate(...a),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import {
  getWalletBalance,
  topUpWalletTx,
  redeemWalletTx,
  redeemAdvanceTx,
  redeemCreditNoteTx,
  issueCreditNote,
} from '@/lib/services/stored-value.service';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = 'tenant-sv-001';
const CUST   = 'cust-sv-001';
const ORDER  = 'order-sv-001';

const makeTx = (walletBalance: number | null = 100) => ({
  $queryRaw: (...a: unknown[]) => mockTxQueryRaw(...a),
  org_customer_wallets_mst: {
    findFirst: (...a: unknown[]) => mockWalletFindFirstTx(...a),
    create:    (...a: unknown[]) => mockWalletCreate(...a),
    update:    (...a: unknown[]) => mockWalletUpdate(...a),
  },
  org_wallet_txn_dtl: {
    findFirst: (...a: unknown[]) => mockWalletTxnFindFirst(...a),
    create:    (...a: unknown[]) => mockWalletTxnCreate(...a),
  },
  org_advance_txn_dtl: { findFirst: jest.fn(), create: jest.fn() },
  org_customer_advances_mst: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  org_credit_notes_mst: { create: (...a: unknown[]) => mockCreditNoteCreate(...a) },
  walletBalance,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stored-value.service — getWalletBalance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns balance when wallet exists', async () => {
    mockWalletFindFirst.mockResolvedValue({
      id: 'w1', balance: new Decimal('150.5000'), currency_code: 'OMR',
    });

    const result = await getWalletBalance(TENANT, CUST);
    expect(result.balance).toBe(150.5);
    expect(result.currencyCode).toBe('OMR');
    expect(result.walletId).toBe('w1');
  });

  it('returns zero balance when no wallet found', async () => {
    mockWalletFindFirst.mockResolvedValue(null);

    const result = await getWalletBalance(TENANT, CUST);
    expect(result.balance).toBe(0);
    expect(result.walletId).toBeNull();
    expect(result.currencyCode).toBeNull();
  });
});

describe('stored-value.service — topUpWalletTx', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates wallet when absent and appends TOP_UP ledger row', async () => {
    const newWallet = { id: 'w-new', balance: new Decimal('0'), currency_code: 'OMR' };
    mockWalletFindFirstTx.mockResolvedValue(null);
    mockWalletCreate.mockResolvedValue(newWallet);
    mockWalletUpdate.mockResolvedValue({ ...newWallet, balance: new Decimal('50') });
    mockWalletTxnCreate.mockResolvedValue({ id: 'txn-1' });

    const tx = makeTx(null);
    await topUpWalletTx(tx as Parameters<typeof topUpWalletTx>[0], {
      tenantId: TENANT, customerId: CUST, amount: 50, currencyCode: 'OMR',
    });

    expect(mockWalletCreate).toHaveBeenCalled();
    expect(mockWalletTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ txn_type: 'TOP_UP', amount: 50 }) })
    );
  });

  it('increments existing wallet balance', async () => {
    const wallet = { id: 'w1', balance: new Decimal('100'), currency_code: 'OMR' };
    mockWalletFindFirstTx.mockResolvedValue(wallet);
    mockWalletUpdate.mockResolvedValue({ ...wallet, balance: new Decimal('150') });
    mockWalletTxnCreate.mockResolvedValue({ id: 'txn-2' });

    const tx = makeTx(100);
    await topUpWalletTx(tx as Parameters<typeof topUpWalletTx>[0], {
      tenantId: TENANT, customerId: CUST, amount: 50,
    });

    expect(mockWalletCreate).not.toHaveBeenCalled();
    expect(mockWalletUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ balance: { increment: 50 } }) })
    );
  });
});

describe('stored-value.service — redeemWalletTx', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deducts balance and writes REDEEM ledger row', async () => {
    mockTxQueryRaw.mockResolvedValue([{ id: 'w1', balance: 100, currency_code: 'OMR' }]);
    mockWalletTxnFindFirst.mockResolvedValue(null); // no duplicate
    mockWalletUpdate.mockResolvedValue({ id: 'w1', balance: new Decimal('80') });
    mockWalletTxnCreate.mockResolvedValue({ id: 'txn-3' });

    const tx = makeTx(100);
    await redeemWalletTx(tx as Parameters<typeof redeemWalletTx>[0], {
      tenantId: TENANT, customerId: CUST, amount: 20, orderId: ORDER,
    });

    expect(mockWalletTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ txn_type: 'REDEMPTION' }) })
    );
  });

  it('throws INSUFFICIENT_BALANCE when balance too low', async () => {
    mockTxQueryRaw.mockResolvedValue([{ id: 'w1', balance: 5, currency_code: 'OMR' }]);
    mockWalletTxnFindFirst.mockResolvedValue(null);

    const tx = makeTx(5);
    await expect(
      redeemWalletTx(tx as Parameters<typeof redeemWalletTx>[0], {
        tenantId: TENANT, customerId: CUST, amount: 50, orderId: ORDER,
      })
    ).rejects.toThrow(/insufficient/i);
  });

  it('throws when no wallet found (empty queryRaw)', async () => {
    mockTxQueryRaw.mockResolvedValue([]);

    const tx = makeTx(null);
    await expect(
      redeemWalletTx(tx as Parameters<typeof redeemWalletTx>[0], {
        tenantId: TENANT, customerId: CUST, amount: 10, orderId: ORDER,
      })
    ).rejects.toThrow();
  });
});

describe('stored-value.service — issueCreditNote', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a credit note record', async () => {
    mockCreditNoteCreate.mockResolvedValue({ id: 'cn-1' });

    await issueCreditNote(TENANT, {
      customerId:   CUST,
      amount:       25,
      currencyCode: 'OMR',
      reason:       'Service quality issue',
      issuedBy:     'staff-1',
    });

    expect(mockCreditNoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_org_id:     TENANT,
          customer_id:       CUST,
          original_amount:   25,
          remaining_balance: 25,
          status:            'ACTIVE',
        }),
      })
    );
  });
});

// ============================================================================
// Phase 2 BVM Wiring — standardised redeem*Tx contract
//
// Every redeem*Tx must:
//   (a) skip on existing idempotency_key (return cached row, no balance debit),
//   (b) persist fin_voucher_id + fin_voucher_trx_line_id on the ledger row
//       insert when the caller supplies voucherId/voucherLineId.
// ============================================================================

describe('Phase 2 — redeemWalletTx idempotency-skip + voucher backlink', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the cached ledger row without debiting when idempotency_key already exists', async () => {
    const cachedRow = { id: 'wallet-txn-existing', amount: -20 };
    mockWalletTxnFindFirst.mockResolvedValueOnce(cachedRow);

    const tx = makeTx(100);
    const result = await redeemWalletTx(tx as Parameters<typeof redeemWalletTx>[0], {
      tenantId:       TENANT,
      customerId:     CUST,
      amount:         20,
      orderId:        ORDER,
      idempotencyKey: 'order-1_sv_w_0',
    });

    expect(result).toBe(cachedRow);
    // No FOR UPDATE lookup, no update, no insert — Phase 2 contract.
    expect(mockTxQueryRaw).not.toHaveBeenCalled();
    expect(mockWalletUpdate).not.toHaveBeenCalled();
    expect(mockWalletTxnCreate).not.toHaveBeenCalled();
  });

  it('writes fin_voucher_id + fin_voucher_trx_line_id when voucher backlinks are provided', async () => {
    mockWalletTxnFindFirst.mockResolvedValueOnce(null);
    mockTxQueryRaw.mockResolvedValue([{ id: 'w1', balance: 100, currency_code: 'OMR' }]);
    mockWalletUpdate.mockResolvedValue({ id: 'w1', balance: new Decimal('80') });
    mockWalletTxnCreate.mockResolvedValue({ id: 'wallet-txn-new' });

    const tx = makeTx(100);
    await redeemWalletTx(tx as Parameters<typeof redeemWalletTx>[0], {
      tenantId:       TENANT,
      customerId:     CUST,
      amount:         20,
      orderId:        ORDER,
      idempotencyKey: 'order-1_sv_w_0',
      voucherId:      'vch-1',
      voucherLineId:  'vch-line-1',
    });

    expect(mockWalletTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotency_key:         'order-1_sv_w_0',
          fin_voucher_id:          'vch-1',
          fin_voucher_trx_line_id: 'vch-line-1',
        }),
      }),
    );
  });
});

describe('Phase 2 — redeemAdvanceTx idempotency-skip + voucher backlink', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockAdvanceTxnFindFirst = jest.fn();
  const mockAdvanceTxnCreate    = jest.fn();
  const mockAdvanceUpdate       = jest.fn();

  const makeAdvanceTx = () => ({
    $queryRaw: (...a: unknown[]) => mockTxQueryRaw(...a),
    org_customer_advances_mst: {
      findFirst: jest.fn(),
      create:    jest.fn(),
      update:    (...a: unknown[]) => mockAdvanceUpdate(...a),
    },
    org_advance_txn_dtl: {
      findFirst: (...a: unknown[]) => mockAdvanceTxnFindFirst(...a),
      create:    (...a: unknown[]) => mockAdvanceTxnCreate(...a),
    },
  });

  it('skips on existing idempotency_key without taking SELECT FOR UPDATE', async () => {
    const cached = { id: 'adv-txn-existing' };
    mockAdvanceTxnFindFirst.mockResolvedValueOnce(cached);

    const tx = makeAdvanceTx();
    const result = await redeemAdvanceTx(tx as Parameters<typeof redeemAdvanceTx>[0], {
      tenantId:       TENANT,
      customerId:     CUST,
      amount:         10,
      orderId:        ORDER,
      idempotencyKey: 'order-1_sv_a_0',
    });

    expect(result).toBe(cached);
    expect(mockTxQueryRaw).not.toHaveBeenCalled();
    expect(mockAdvanceUpdate).not.toHaveBeenCalled();
    expect(mockAdvanceTxnCreate).not.toHaveBeenCalled();
  });

  it('persists fin_voucher_id + fin_voucher_trx_line_id on the new ledger row', async () => {
    mockAdvanceTxnFindFirst.mockResolvedValueOnce(null);
    mockTxQueryRaw.mockResolvedValue([{ id: 'adv-1', balance: 50, currency_code: 'OMR' }]);
    mockAdvanceUpdate.mockResolvedValue({ id: 'adv-1' });
    mockAdvanceTxnCreate.mockResolvedValue({ id: 'adv-txn-new' });

    const tx = makeAdvanceTx();
    await redeemAdvanceTx(tx as Parameters<typeof redeemAdvanceTx>[0], {
      tenantId:       TENANT,
      customerId:     CUST,
      amount:         15,
      orderId:        ORDER,
      idempotencyKey: 'order-1_sv_a_0',
      voucherId:      'vch-2',
      voucherLineId:  'vch-line-2',
    });

    expect(mockAdvanceTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotency_key:         'order-1_sv_a_0',
          fin_voucher_id:          'vch-2',
          fin_voucher_trx_line_id: 'vch-line-2',
        }),
      }),
    );
  });
});

describe('Phase 2 — redeemCreditNoteTx idempotency-skip + voucher backlink', () => {
  beforeEach(() => jest.clearAllMocks());

  const mockCnTxnFindFirst = jest.fn();
  const mockCnTxnCreate    = jest.fn();
  const mockCnMstUpdate    = jest.fn();

  const makeCnTx = () => ({
    $queryRaw: (...a: unknown[]) => mockTxQueryRaw(...a),
    org_credit_notes_mst: { update: (...a: unknown[]) => mockCnMstUpdate(...a) },
    org_credit_note_txn_dtl: {
      findFirst: (...a: unknown[]) => mockCnTxnFindFirst(...a),
      create:    (...a: unknown[]) => mockCnTxnCreate(...a),
    },
  });

  it('skips on existing idempotency_key', async () => {
    const cached = { id: 'cn-txn-existing' };
    mockCnTxnFindFirst.mockResolvedValueOnce(cached);

    const tx = makeCnTx();
    const result = await redeemCreditNoteTx(tx as Parameters<typeof redeemCreditNoteTx>[0], {
      tenantId:       TENANT,
      customerId:     CUST,
      creditNoteId:   'cn-1',
      amount:         5,
      orderId:        ORDER,
      idempotencyKey: 'order-1_sv_cn_0',
    });

    expect(result).toBe(cached);
    expect(mockTxQueryRaw).not.toHaveBeenCalled();
    expect(mockCnMstUpdate).not.toHaveBeenCalled();
    expect(mockCnTxnCreate).not.toHaveBeenCalled();
  });

  it('persists fin_voucher_id + fin_voucher_trx_line_id on the ledger row', async () => {
    mockCnTxnFindFirst.mockResolvedValueOnce(null);
    mockTxQueryRaw.mockResolvedValue([{ id: 'cn-1', remaining_balance: 30, currency_code: 'OMR' }]);
    mockCnMstUpdate.mockResolvedValue({ id: 'cn-1' });
    mockCnTxnCreate.mockResolvedValue({ id: 'cn-txn-new' });

    const tx = makeCnTx();
    await redeemCreditNoteTx(tx as Parameters<typeof redeemCreditNoteTx>[0], {
      tenantId:       TENANT,
      customerId:     CUST,
      creditNoteId:   'cn-1',
      amount:         12,
      orderId:        ORDER,
      idempotencyKey: 'order-1_sv_cn_0',
      voucherId:      'vch-3',
      voucherLineId:  'vch-line-3',
    });

    expect(mockCnTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotency_key:         'order-1_sv_cn_0',
          fin_voucher_id:          'vch-3',
          fin_voucher_trx_line_id: 'vch-line-3',
        }),
      }),
    );
  });
});
