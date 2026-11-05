jest.mock('@/lib/notifications/event-emitter', () => ({ emitNotificationEvent: jest.fn().mockResolvedValue(undefined) }));
import { emitNotificationEvent } from '@/lib/notifications/event-emitter';
/**
 * Tests: stored-value.service
 *
 * Covers:
 * - getWalletBalance — returns balance or zeros when no wallet
 * - topUpWalletTx    — creates wallet if absent, appends ledger row
 * - redeemWalletTx   — deducts balance, idempotency skip on duplicate orderId
 * - redeemWalletTx   — throws INSUFFICIENT_BALANCE
 * - issueCreditNote  — creates credit note record
 * - credit note numbering (P5) — ENGINE inserts '' and reads SCN back; LEGACY removed (#6); missing number stops the issue
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
const mockCreditNoteFindMany = jest.fn();
const mockExpireCnUpdate = jest.fn();
const mockExpireCnTxnFindFirst = jest.fn();
const mockExpireCnTxnCreate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_customer_wallets_mst: {
      findFirst: (...a: unknown[]) => mockWalletFindFirst(...a),
    },
    org_credit_notes_mst: {
      count:  (...a: unknown[]) => mockCreditNotesCount(...a),
      create: (...a: unknown[]) => mockCreditNoteCreate(...a),
      findMany: (...a: unknown[]) => mockCreditNoteFindMany(...a),
    },
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn({
      $queryRaw: (...a: unknown[]) => mockTxQueryRaw(...a),
      org_credit_notes_mst: { update: (...a: unknown[]) => mockExpireCnUpdate(...a) },
      org_credit_note_txn_dtl: {
        findFirst: (...a: unknown[]) => mockExpireCnTxnFindFirst(...a),
        create: (...a: unknown[]) => mockExpireCnTxnCreate(...a),
      },
    }),
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

jest.mock('@/lib/services/loyalty.service', () => ({
  getLoyaltyAccount: jest.fn().mockResolvedValue(null),
  getLoyaltyConfig: jest.fn().mockResolvedValue(null),
  syncAvailableLoyaltyPoints: jest.fn().mockResolvedValue({
    spendablePoints: 0,
    expiredUnappliedPoints: 0,
    expiredNow: 0,
  }),
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
  issueCreditNoteTx,
  creditNoteNoForInsert,
  assertCreditNoteNoAssigned,
  expireCreditNote,
  expireCreditNotes,
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

  // B15 — non-OMR tenant fixture: the wallet row's currency governs; creation
  // requires an explicit currency; conflicts fail loudly.
  it('creates a new wallet with the supplied non-OMR currency', async () => {
    const newWallet = { id: 'w-bhd', balance: new Decimal('0'), currency_code: 'BHD' };
    mockWalletFindFirstTx.mockResolvedValue(null);
    mockWalletCreate.mockResolvedValue(newWallet);
    mockWalletUpdate.mockResolvedValue({ ...newWallet, balance: new Decimal('25') });
    mockWalletTxnCreate.mockResolvedValue({ id: 'txn-bhd' });

    const tx = makeTx(null);
    await topUpWalletTx(tx as Parameters<typeof topUpWalletTx>[0], {
      tenantId: TENANT, customerId: CUST, amount: 25, currencyCode: 'BHD',
    });

    expect(mockWalletCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currency_code: 'BHD' }) })
    );
  });

  it('throws MISSING_CURRENCY_CODE when creating a wallet without a currency', async () => {
    mockWalletFindFirstTx.mockResolvedValue(null);

    const tx = makeTx(null);
    await expect(
      topUpWalletTx(tx as Parameters<typeof topUpWalletTx>[0], {
        tenantId: TENANT, customerId: CUST, amount: 10,
      })
    ).rejects.toThrow('MISSING_CURRENCY_CODE');
    expect(mockWalletCreate).not.toHaveBeenCalled();
  });

  it('throws CURRENCY_MISMATCH when the supplied currency conflicts with the wallet', async () => {
    const wallet = { id: 'w1', balance: new Decimal('100'), currency_code: 'BHD' };
    mockWalletFindFirstTx.mockResolvedValue(wallet);

    const tx = makeTx(100);
    await expect(
      topUpWalletTx(tx as Parameters<typeof topUpWalletTx>[0], {
        tenantId: TENANT, customerId: CUST, amount: 10, currencyCode: 'SAR',
      })
    ).rejects.toThrow('CURRENCY_MISMATCH');
    expect(mockWalletUpdate).not.toHaveBeenCalled();
    expect(mockWalletTxnCreate).not.toHaveBeenCalled();
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
    mockCreditNoteCreate.mockResolvedValue({ id: 'cn-1', credit_note_no: 'SCN-2026-000001' });

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

describe('stored-value.service — credit note numbering (HFC P5)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ENGINE: inserts an empty number, does not count, returns the DB number', async () => {
    mockCreditNoteCreate.mockResolvedValue({ id: 'cn-1', credit_note_no: 'SCN-2026-000007' });

    const note = await issueCreditNote(TENANT, {
      customerId: CUST, amount: 5, currencyCode: 'OMR', reason: 'Goodwill',
    });

    expect(mockCreditNotesCount).not.toHaveBeenCalled();
    expect(mockCreditNoteCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ credit_note_no: '' }) })
    );
    expect(note.credit_note_no).toBe('SCN-2026-000007');
  });

  it('emits credit_note.issued with credit_note_no variables (mocked sender)', async () => {
    mockCreditNoteCreate.mockResolvedValue({
      id: 'cn-emit-1',
      credit_note_no: 'SCN-2026-000099',
      customer_id: CUST,
      related_order_id: null,
    });
    await issueCreditNote(TENANT, {
      customerId: CUST, amount: 12.5, currencyCode: 'OMR', reason: 'Goodwill', issuedBy: 'user-1',
    });
    expect(jest.mocked(emitNotificationEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'credit_note.issued',
        tenantOrgId: TENANT,
        recipientUserIds: ['user-1'],
        sourceEntityType: 'credit_note',
        sourceEntityId: 'cn-emit-1',
        variables: expect.objectContaining({
          credit_note_no: 'SCN-2026-000099',
          invoice_number: 'SCN-2026-000099',
          amount: '12.50',
          currency: 'OMR',
        }),
      })
    );
  });
  it('ENGINE: issueCreditNoteTx inserts an empty number and writes the ISSUE ledger row', async () => {
    const txCreate = jest.fn().mockResolvedValue({ id: 'cn-2', credit_note_no: 'SCN-2026-000008' });
    const txCount = jest.fn();
    const txnCreate = jest.fn().mockResolvedValue({});
    const tx = {
      org_credit_note_txn_dtl: { findFirst: jest.fn().mockResolvedValue(null), create: txnCreate },
      org_credit_notes_mst: { create: txCreate, count: txCount, findFirst: jest.fn() },
    };

    const note = await issueCreditNoteTx(tx as unknown as Parameters<typeof issueCreditNoteTx>[0], {
      tenantId: TENANT, customerId: CUST, amount: 3, reason: 'Refund', currencyCode: 'OMR', idempotencyKey: 'k-1',
    });

    expect(txCount).not.toHaveBeenCalled();
    expect(txCreate.mock.calls[0][0].data.credit_note_no).toBe('');
    expect(txnCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ credit_note_id: 'cn-2', idempotency_key: 'k-1' }) })
    );
    expect(note.credit_note_no).toBe('SCN-2026-000008');
  });

  it('stops the issue when the DB assigned no number (migration not applied)', async () => {
    const txCreate = jest.fn().mockResolvedValue({ id: 'cn-3', credit_note_no: '' });
    const txnCreate = jest.fn();
    const tx = {
      org_credit_note_txn_dtl: { findFirst: jest.fn().mockResolvedValue(null), create: txnCreate },
      org_credit_notes_mst: { create: txCreate, count: jest.fn() },
    };

    await expect(
      issueCreditNoteTx(tx as unknown as Parameters<typeof issueCreditNoteTx>[0], {
        tenantId: TENANT, customerId: CUST, amount: 3, reason: 'Refund', currencyCode: 'OMR', idempotencyKey: 'k-2',
      })
    ).rejects.toThrow('STORE_CREDIT_NOTE_NO_NOT_ASSIGNED');
    expect(txnCreate).not.toHaveBeenCalled();
  });

  it('creditNoteNoForInsert always returns empty (ENGINE only; LEGACY removed FOLLOWUPS #6)', async () => {
    await expect(creditNoteNoForInsert()).resolves.toBe('');
  });

  it('assertCreditNoteNoAssigned accepts existing CN-/SCN numbers, rejects empty', () => {
    expect(assertCreditNoteNoAssigned('CN-ABCDEF12-00001')).toBe('CN-ABCDEF12-00001');
    expect(assertCreditNoteNoAssigned('SCN-2026-000001')).toBe('SCN-2026-000001');
    expect(() => assertCreditNoteNoAssigned('  ')).toThrow('STORE_CREDIT_NOTE_NO_NOT_ASSIGNED');
    expect(() => assertCreditNoteNoAssigned(undefined)).toThrow('STORE_CREDIT_NOTE_NO_NOT_ASSIGNED');
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

describe('expireCreditNote / expireCreditNotes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes an EXPIRY ledger row and zeros remaining_balance', async () => {
    mockExpireCnTxnFindFirst.mockResolvedValue(null);
    mockTxQueryRaw.mockResolvedValue([{
      id: 'cn-1',
      remaining_balance: 25,
      currency_code: 'OMR',
      status: 'ACTIVE',
      customer_id: CUST,
    }]);
    mockExpireCnUpdate.mockResolvedValue({ id: 'cn-1' });
    mockExpireCnTxnCreate.mockResolvedValue({ id: 'cn-txn-exp' });

    const result = await expireCreditNote('cn-1', TENANT);

    expect(result.success).toBe(true);
    expect(mockExpireCnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'EXPIRED', remaining_balance: 0 }),
      }),
    );
    expect(mockExpireCnTxnCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          txn_type: 'EXPIRY',
          amount: -25,
          balance_before: 25,
          balance_after: 0,
          idempotency_key: 'cn-expiry-cn-1',
        }),
      }),
    );
  });

  it('is a no-op success when the note is already EXPIRED', async () => {
    mockExpireCnTxnFindFirst.mockResolvedValue(null);
    mockTxQueryRaw.mockResolvedValue([{
      id: 'cn-1',
      remaining_balance: 0,
      currency_code: 'OMR',
      status: 'EXPIRED',
      customer_id: CUST,
    }]);

    const result = await expireCreditNote('cn-1', TENANT);
    expect(result.success).toBe(true);
    expect(mockExpireCnTxnCreate).not.toHaveBeenCalled();
  });

  it('loops eligible notes and does not stop on a single failure', async () => {
    mockCreditNoteFindMany.mockResolvedValue([{ id: 'cn-ok' }, { id: 'cn-bad' }]);
    mockExpireCnTxnFindFirst.mockResolvedValue(null);
    mockTxQueryRaw
      .mockResolvedValueOnce([{
        id: 'cn-ok', remaining_balance: 10, currency_code: 'OMR', status: 'ACTIVE', customer_id: CUST,
      }])
      .mockResolvedValueOnce([]);
    mockExpireCnUpdate.mockResolvedValue({ id: 'cn-ok' });
    mockExpireCnTxnCreate.mockResolvedValue({ id: 'cn-txn' });

    const result = await expireCreditNotes(TENANT);
    expect(result.expiredCount).toBe(1);
    expect(result.failedCount).toBe(1);
  });
});
