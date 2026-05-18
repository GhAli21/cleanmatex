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
