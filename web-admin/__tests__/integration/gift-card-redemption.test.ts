/// <reference types="jest" />
/**
 * Integration test: concurrent gift-card redemption race prevention
 *
 * Verifies:
 * - Happy path: single redemption debits balance, creates ledger row
 * - Idempotent retry: second call with same idempotencyKey returns without second debit
 * - TOCTOU prevention: SELECT FOR UPDATE ($queryRaw) issued before update
 * - INSUFFICIENT_BALANCE thrown when available_amount < redemption amount
 * - CURRENCY_MISMATCH thrown when invoiceCurrency differs from card currency
 *
 * Uses real service-layer logic with Prisma mocked at the boundary.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGiftCardQueryRaw   = jest.fn();
const mockGiftCardUpdate     = jest.fn();
const mockGiftCardTxnFindFirst = jest.fn();
const mockGiftCardTxnCreate  = jest.fn();
const mockGiftCardFindFirst  = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    org_gift_cards_mst:    {
      findFirst: (...a: unknown[]) => mockGiftCardFindFirst(...a),
      update:    (...a: unknown[]) => mockGiftCardUpdate(...a),
    },
    org_gift_card_txn_dtl: {
      findFirst: (...a: unknown[]) => mockGiftCardTxnFindFirst(...a),
      create:    (...a: unknown[]) => mockGiftCardTxnCreate(...a),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn('tenant-gc-int')
  ),
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-gc-int'),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: jest.fn(() => ({
    getCurrencyConfig: jest.fn().mockResolvedValue({ currencyCode: 'OMR', decimalPlaces: 3 }),
  })),
}));

jest.mock('@/lib/money/format-money', () => ({
  formatMoneyAmountWithCode: jest.fn((v: number) => String(v)),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash:    jest.fn().mockResolvedValue('$2b$12$hash'),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { redeemGiftCardTx } from '@/lib/services/gift-card-service';
import { Decimal }          from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT  = 'tenant-gc-int';
const ORDER   = 'order-gc-int';
const IDEM    = 'idem-gc-int';
const GC_ID   = 'gc-001';

const makeTx = () => ({
  $queryRaw:          (...a: unknown[]) => mockGiftCardQueryRaw(...a),
  org_gift_cards_mst: { update: (...a: unknown[]) => mockGiftCardUpdate(...a) },
  org_gift_card_txn_dtl: {
    findFirst: (...a: unknown[]) => mockGiftCardTxnFindFirst(...a),
    create:    (...a: unknown[]) => mockGiftCardTxnCreate(...a),
  },
});

const makeLockedRow = (available = 100, currency = 'OMR') => [{
  id:               GC_ID,
  available_amount: available,
  original_amount:  100,
  status:           'ACTIVE',
  expiry_date:      null,
  tenant_org_id:    TENANT,
  currency_code:    currency,
  max_redemptions:  null,
  redemption_count: 0,
}];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('gift-card-redemption integration — redeemGiftCardTx', () => {
  beforeEach(() => jest.clearAllMocks());

  it('happy path: debits balance and creates ledger row', async () => {
    mockGiftCardTxnFindFirst.mockResolvedValue(null); // no prior idempotency match
    mockGiftCardQueryRaw.mockResolvedValue(makeLockedRow(100));
    mockGiftCardUpdate.mockResolvedValue({ id: GC_ID, available_amount: new Decimal('70') });
    mockGiftCardTxnCreate.mockResolvedValue({ id: 'gc-txn-1', balance_after: new Decimal('70') });

    const tx = makeTx();
    const result = await redeemGiftCardTx(
      tx as Parameters<typeof redeemGiftCardTx>[0],
      { tenantOrgId: TENANT, giftCardId: GC_ID, amount: 30, orderId: ORDER, idempotencyKey: IDEM }
    );

    expect(mockGiftCardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ available_amount: 70 }) })
    );
    expect(mockGiftCardTxnCreate).toHaveBeenCalled();
    expect(result.newBalance).toBeDefined();
  });

  it('idempotent retry: returns existing balance without second debit', async () => {
    // Idempotency row exists → skips mutation
    mockGiftCardTxnFindFirst.mockResolvedValue({
      id: 'gc-txn-1', balance_after: new Decimal('70'),
    });

    const tx = makeTx();
    const result = await redeemGiftCardTx(
      tx as Parameters<typeof redeemGiftCardTx>[0],
      { tenantOrgId: TENANT, giftCardId: GC_ID, amount: 30, orderId: ORDER, idempotencyKey: IDEM }
    );

    expect(mockGiftCardUpdate).not.toHaveBeenCalled(); // no second debit
    expect(result.skipped).toBe(true);
    expect(result.newBalance).toBe(70);
  });

  it('TOCTOU prevention: $queryRaw called before update', async () => {
    mockGiftCardTxnFindFirst.mockResolvedValue(null);
    mockGiftCardQueryRaw.mockResolvedValue(makeLockedRow(100));
    mockGiftCardUpdate.mockResolvedValue({ id: GC_ID, available_amount: new Decimal('80') });
    mockGiftCardTxnCreate.mockResolvedValue({ id: 'gc-txn-2', balance_after: new Decimal('80') });

    const tx = makeTx();
    await redeemGiftCardTx(
      tx as Parameters<typeof redeemGiftCardTx>[0],
      { tenantOrgId: TENANT, giftCardId: GC_ID, amount: 20, orderId: ORDER, idempotencyKey: 'idem-2' }
    );

    const queryOrder  = mockGiftCardQueryRaw.mock.invocationCallOrder[0];
    const updateOrder = mockGiftCardUpdate.mock.invocationCallOrder[0];
    expect(queryOrder).toBeLessThan(updateOrder);
  });

  it('throws INSUFFICIENT_BALANCE when available_amount < amount', async () => {
    mockGiftCardTxnFindFirst.mockResolvedValue(null);
    mockGiftCardQueryRaw.mockResolvedValue(makeLockedRow(10));

    const tx = makeTx();
    await expect(
      redeemGiftCardTx(
        tx as Parameters<typeof redeemGiftCardTx>[0],
        { tenantOrgId: TENANT, giftCardId: GC_ID, amount: 50, orderId: ORDER, idempotencyKey: IDEM }
      )
    ).rejects.toThrow('INSUFFICIENT_BALANCE');
  });

  it('throws CURRENCY_MISMATCH when invoiceCurrency differs from card currency', async () => {
    mockGiftCardTxnFindFirst.mockResolvedValue(null);
    mockGiftCardQueryRaw.mockResolvedValue(makeLockedRow(100, 'USD'));

    const tx = makeTx();
    await expect(
      redeemGiftCardTx(
        tx as Parameters<typeof redeemGiftCardTx>[0],
        {
          tenantOrgId: TENANT, giftCardId: GC_ID, amount: 30,
          orderId: ORDER, idempotencyKey: IDEM, invoiceCurrency: 'OMR',
        }
      )
    ).rejects.toThrow('CURRENCY_MISMATCH');
  });
});
