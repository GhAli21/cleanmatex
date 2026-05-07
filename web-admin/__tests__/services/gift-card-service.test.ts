/**
 * Tests: gift-card-service
 *
 * Covers:
 * - applyGiftCardTx — balance debit, expiry mutation, INSUFFICIENT_BALANCE
 * - validateGiftCard — PIN enforcement, NO mutation on expiry
 * - refundToGiftCard — actualRefundAmount is surfaced; cap at original_amount
 */

// ---------------------------------------------------------------------------
// Mocks — defined inside factory functions to avoid TDZ hoisting issues
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    org_gift_cards_mst: { findFirst: jest.fn(), update: jest.fn() },
    org_orders_mst: { findUnique: jest.fn() },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-xyz'),
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn('tenant-xyz')
  ),
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

// ---------------------------------------------------------------------------

import { prisma } from '@/lib/db/prisma';
import { applyGiftCardTx, validateGiftCard, refundToGiftCard } from '@/lib/services/gift-card-service';

const mockGcFindFirst = prisma.org_gift_cards_mst.findFirst as jest.Mock;
const mockGcUpdate = prisma.org_gift_cards_mst.update as jest.Mock;
const mockPrismaTransaction = prisma.$transaction as jest.Mock;

describe('gift-card-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // applyGiftCardTx
  // -------------------------------------------------------------------------

  describe('applyGiftCardTx', () => {
    const validCard = {
      id: 'gc-1',
      current_balance: 50,
      status: 'active',
      card_pin: null,
      expiry_date: null,
      tenant_org_id: 'tenant-xyz',
    };

    const buildTxClient = (locked: object[]) => ({
      $queryRaw: jest.fn().mockResolvedValue(locked),
      org_gift_card_transactions: { create: jest.fn().mockResolvedValue({}) },
      org_gift_cards_mst: { update: jest.fn().mockResolvedValue({}) },
    });

    it('debits balance and records transaction on success', async () => {
      const tx = buildTxClient([validCard]);
      const result = await applyGiftCardTx(tx as never, {
        cardNumber: 'GC123',
        amount: 20,
        tenantOrgId: 'tenant-xyz',
        currencyCode: 'OMR',
        decimalPlaces: 3,
      });
      expect(result.newBalance).toBe(30);
      const txCreate = tx.org_gift_card_transactions.create as jest.Mock;
      expect(txCreate.mock.calls[0][0].data.amount).toBe(20);
      expect(txCreate.mock.calls[0][0].data.balance_before).toBe(50);
      expect(txCreate.mock.calls[0][0].data.balance_after).toBe(30);
    });

    it('throws GIFT_CARD_NOT_FOUND when row lock returns empty', async () => {
      const tx = buildTxClient([]);
      await expect(
        applyGiftCardTx(tx as never, {
          cardNumber: 'MISSING',
          amount: 10,
          tenantOrgId: 'tenant-xyz',
          currencyCode: 'OMR',
          decimalPlaces: 3,
        })
      ).rejects.toThrow('GIFT_CARD_NOT_FOUND');
    });

    it('throws INSUFFICIENT_BALANCE when amount exceeds balance', async () => {
      const tx = buildTxClient([{ ...validCard, current_balance: 5 }]);
      await expect(
        applyGiftCardTx(tx as never, {
          cardNumber: 'GC123',
          amount: 20,
          tenantOrgId: 'tenant-xyz',
          currencyCode: 'OMR',
          decimalPlaces: 3,
        })
      ).rejects.toThrow('INSUFFICIENT_BALANCE');
    });

    it('throws GIFT_CARD_EXPIRED and marks card expired when expiry passed', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tx = buildTxClient([{ ...validCard, expiry_date: yesterday }]);
      await expect(
        applyGiftCardTx(tx as never, {
          cardNumber: 'GC-EXP',
          amount: 5,
          tenantOrgId: 'tenant-xyz',
          currencyCode: 'OMR',
          decimalPlaces: 3,
        })
      ).rejects.toThrow('GIFT_CARD_EXPIRED');
      const gcUpdate = tx.org_gift_cards_mst.update as jest.Mock;
      expect(gcUpdate.mock.calls[0][0].data.status).toBe('expired');
    });

    it('sets status to used when balance reaches zero', async () => {
      const tx = buildTxClient([{ ...validCard, current_balance: 20 }]);
      await applyGiftCardTx(tx as never, {
        cardNumber: 'GC123',
        amount: 20,
        tenantOrgId: 'tenant-xyz',
        currencyCode: 'OMR',
        decimalPlaces: 3,
      });
      const gcUpdate = tx.org_gift_cards_mst.update as jest.Mock;
      expect(gcUpdate.mock.calls[0][0].data.status).toBe('used');
    });
  });

  // -------------------------------------------------------------------------
  // validateGiftCard — PIN enforcement and no mutation on expiry
  // -------------------------------------------------------------------------

  describe('validateGiftCard', () => {
    const makeCard = (overrides: object = {}) => ({
      id: 'gc-pin',
      card_number: 'GCPIN',
      is_active: true,
      card_pin: '1234',
      status: 'active',
      expiry_date: null,
      current_balance: 50,
      tenant_org_id: 'tenant-xyz',
      card_name: 'Test',
      card_name2: null,
      original_amount: 100,
      issued_date: new Date(),
      issued_to_customer_id: null,
      rec_notes: null,
      metadata: null,
      created_at: new Date(),
      created_by: null,
      updated_at: null,
      updated_by: null,
      ...overrides,
    });

    it('rejects when PIN is set but not supplied', async () => {
      mockGcFindFirst.mockResolvedValue(makeCard());
      const result = await validateGiftCard({ card_number: 'GCPIN' });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PIN');
    });

    it('rejects when wrong PIN is supplied', async () => {
      mockGcFindFirst.mockResolvedValue(makeCard());
      const result = await validateGiftCard({ card_number: 'GCPIN', card_pin: '9999' });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PIN');
    });

    it('returns valid when correct PIN is supplied', async () => {
      mockGcFindFirst.mockResolvedValue(makeCard());
      const result = await validateGiftCard({ card_number: 'GCPIN', card_pin: '1234' });
      expect(result.isValid).toBe(true);
    });

    it('accepts the PIN code as the entry value when card number is not provided', async () => {
      mockGcFindFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeCard());
      const result = await validateGiftCard({ card_number: '1234' });
      expect(result.isValid).toBe(true);
    });

    it('does NOT mutate DB when expiry check fires in validateGiftCard', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      mockGcFindFirst.mockResolvedValue(makeCard({ card_pin: null, expiry_date: yesterday }));

      const result = await validateGiftCard({ card_number: 'GCPIN' });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('EXPIRED');
      // validateGiftCard MUST NOT call update — that's applyGiftCardTx's responsibility
      expect(mockGcUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // refundToGiftCard — actualRefundAmount surfaced
  // -------------------------------------------------------------------------

  describe('refundToGiftCard', () => {
    const makeRefundCard = (currentBalance: number, originalAmount: number) => ({
      id: 'gc-r',
      card_number: 'GCREFUND',
      is_active: true,
      card_pin: null,
      status: 'active',
      current_balance: currentBalance,
      original_amount: originalAmount,
      tenant_org_id: 'tenant-xyz',
      card_name: 'Refund Card',
      card_name2: null,
      expiry_date: null,
      issued_date: new Date(),
      issued_to_customer_id: null,
      rec_notes: null,
      metadata: null,
      created_at: new Date(),
      created_by: null,
      updated_at: null,
      updated_by: null,
    });

    const setupTx = (currentBalance: number, originalAmount: number) => {
      const card = makeRefundCard(currentBalance, originalAmount);
      mockPrismaTransaction.mockImplementation(async (fn: (tx: object) => Promise<unknown>) => {
        const fakeTx = {
          // refundToGiftCardTx uses SELECT FOR UPDATE via $queryRaw
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: card.id,
              tenant_org_id: card.tenant_org_id,
              current_balance: card.current_balance,
              original_amount: card.original_amount,
            },
          ]),
          org_gift_cards_mst: {
            findFirst: jest.fn().mockResolvedValue(card),
            update: jest.fn().mockResolvedValue({}),
          },
          org_gift_card_transactions: { create: jest.fn().mockResolvedValue({}) },
          org_orders_mst: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return fn(fakeTx);
      });
    };

    it('surfaces actualRefundAmount in the result', async () => {
      setupTx(30, 50);
      const result = await refundToGiftCard('GCREFUND', 15, 'order-1', 'inv-1', 'Reason', 'user-1');
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(45);
      expect(result.actualRefundAmount).toBe(15);
    });

    it('caps refund so balance does not exceed original_amount', async () => {
      setupTx(30, 50); // current=30, original=50, refund=30 → cap at 50-30=20
      const result = await refundToGiftCard('GCREFUND', 30, 'order-1', 'inv-1', 'Large', 'user-1');
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(50);
      expect(result.actualRefundAmount).toBe(20);
    });
  });
});
