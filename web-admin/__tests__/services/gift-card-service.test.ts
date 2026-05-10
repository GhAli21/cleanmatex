/**
 * Tests: gift-card-service
 *
 * Covers:
 * - redeemGiftCardTx — balance debit, expiry check, INSUFFICIENT_BALANCE, idempotency skip,
 *                      currency mismatch, max_redemptions enforcement
 * - validateGiftCard  — PIN enforcement (hash path + legacy), no DB mutation on expiry check
 * - refundGiftCardTx  — actualRefundAmount surfaced; cap at original_amount, idempotency skip,
 *                       status revert after refund
 * - applyGiftCardTx   — deprecated shim delegates to redeemGiftCardTx
 * - sellGiftCard      — auto-activation, SALE ledger row, purchased_by_cust_id
 * - adminActivateGiftCard — GENERATED → ACTIVE, ACTIVATE ledger row, status guard
 * - adminAdjustGiftCard   — credit cap at original_amount
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('$2b$12$hashedpin'),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    org_gift_cards_mst: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    org_gift_card_txn_dtl: { create: jest.fn() },
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
import bcrypt from 'bcryptjs';
import {
  redeemGiftCardTx,
  refundGiftCardTx,
  validateGiftCard,
  applyGiftCardTx,
  sellGiftCard,
  adminActivateGiftCard,
  adminAdjustGiftCard,
} from '@/lib/services/gift-card-service';

const mockGcFindFirst = prisma.org_gift_cards_mst.findFirst as jest.Mock;
const mockGcUpdate = prisma.org_gift_cards_mst.update as jest.Mock;
const mockPrismaTransaction = prisma.$transaction as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;

describe('gift-card-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // redeemGiftCardTx
  // -------------------------------------------------------------------------

  describe('redeemGiftCardTx', () => {
    const validCard = {
      id: 'gc-1',
      available_amount: 50,
      current_balance: 50,
      original_amount: 100,
      status: 'ACTIVE',
      expiry_date: null,
      tenant_org_id: 'tenant-xyz',
      redemption_count: 0,
      max_redemptions: null,
    };

    const buildTxClient = (locked: object[], existingTxn: object | null = null) => ({
      $queryRaw: jest.fn().mockResolvedValue(locked),
      org_gift_card_txn_dtl: {
        findFirst: jest.fn().mockResolvedValue(existingTxn),
        create: jest.fn().mockResolvedValue({}),
      },
      org_gift_cards_mst: { update: jest.fn().mockResolvedValue({}) },
    });

    it('debits balance and records transaction on success', async () => {
      const tx = buildTxClient([validCard]);
      const result = await redeemGiftCardTx(tx as never, {
        giftCardId: 'gc-1',
        amount: 20,
        tenantOrgId: 'tenant-xyz',
      });
      expect(result.newBalance).toBe(30);
      const txCreate = tx.org_gift_card_txn_dtl.create as jest.Mock;
      expect(txCreate.mock.calls[0][0].data.amount).toBeCloseTo(20, 3);
      expect(txCreate.mock.calls[0][0].data.balance_before).toBeCloseTo(50, 3);
      expect(txCreate.mock.calls[0][0].data.balance_after).toBeCloseTo(30, 3);
    });

    it('throws GIFT_CARD_NOT_FOUND when row lock returns empty', async () => {
      const tx = buildTxClient([]);
      await expect(
        redeemGiftCardTx(tx as never, {
          giftCardId: 'missing-id',
          amount: 10,
          tenantOrgId: 'tenant-xyz',
        })
      ).rejects.toThrow('GIFT_CARD_NOT_FOUND');
    });

    it('throws INSUFFICIENT_BALANCE when amount exceeds available_amount', async () => {
      const tx = buildTxClient([{ ...validCard, available_amount: 5, current_balance: 5 }]);
      await expect(
        redeemGiftCardTx(tx as never, {
          giftCardId: 'gc-1',
          amount: 20,
          tenantOrgId: 'tenant-xyz',
        })
      ).rejects.toThrow('INSUFFICIENT_BALANCE');
    });

    it('throws GIFT_CARD_EXPIRED when expiry date has passed', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tx = buildTxClient([{ ...validCard, expiry_date: yesterday }]);
      await expect(
        redeemGiftCardTx(tx as never, {
          giftCardId: 'gc-exp',
          amount: 5,
          tenantOrgId: 'tenant-xyz',
        })
      ).rejects.toThrow('GIFT_CARD_EXPIRED');
    });

    it('skips and returns skipped:true when idempotency key already exists', async () => {
      const tx = buildTxClient([validCard], { id: 'existing-txn', balance_after: 30 });
      const result = await redeemGiftCardTx(tx as never, {
        giftCardId: 'gc-1',
        amount: 20,
        tenantOrgId: 'tenant-xyz',
        idempotencyKey: 'order-1:redeem',
      });
      expect(result.skipped).toBe(true);
      expect(result.newBalance).toBe(30);
      const txCreate = tx.org_gift_card_txn_dtl.create as jest.Mock;
      expect(txCreate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // validateGiftCard — PIN enforcement, no DB mutation on expiry
  // -------------------------------------------------------------------------

  describe('validateGiftCard', () => {
    const makeCard = (overrides: object = {}) => ({
      id: 'gc-pin',
      gift_card_code: 'CMX-1234-5678-9012',
      is_active: true,
      card_pin: '1234',
      pin_hash: null,
      pin_failed_attempts: 0,
      status: 'ACTIVE',
      expiry_date: null,
      current_balance: 50,
      available_amount: 50,
      tenant_org_id: 'tenant-xyz',
      card_name: 'Test',
      card_name2: null,
      original_amount: 100,
      redeemed_amount: 0,
      bonus_amount: 0,
      bonus_remaining: 0,
      issued_date: new Date(),
      activation_date: null,
      issued_to_customer_id: null,
      purchased_by_cust_id: null,
      batch_id: null,
      is_reloadable: false,
      is_transferable: false,
      max_redemptions: null,
      redemption_count: 0,
      issue_type: 'SOLD',
      gift_card_type: 'FIXED_VALUE',
      currency_code: 'OMR',
      metadata: null,
      rec_notes: null,
      created_at: new Date(),
      created_by: null,
      updated_at: null,
      updated_by: null,
      issued_to_customer: null,
      ...overrides,
    });

    it('rejects when PIN is set but not supplied', async () => {
      mockGcFindFirst.mockResolvedValue(makeCard());
      const result = await validateGiftCard({ gift_card_code: 'CMX-1234-5678-9012' });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PIN');
    });

    it('rejects when wrong PIN is supplied', async () => {
      mockGcFindFirst.mockResolvedValue(makeCard());
      const result = await validateGiftCard({ gift_card_code: 'CMX-1234-5678-9012', card_pin: '9999' });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PIN');
    });

    it('returns valid when correct legacy PIN is supplied', async () => {
      mockGcFindFirst.mockResolvedValue(makeCard());
      const result = await validateGiftCard({ gift_card_code: 'CMX-1234-5678-9012', card_pin: '1234' });
      expect(result.isValid).toBe(true);
    });

    it('returns valid when card has no PIN set', async () => {
      mockGcFindFirst.mockResolvedValue(makeCard({ card_pin: null, pin_hash: null }));
      const result = await validateGiftCard({ gift_card_code: 'CMX-1234-5678-9012' });
      expect(result.isValid).toBe(true);
    });

    it('does NOT mutate DB when expiry check fires in validateGiftCard', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      mockGcFindFirst.mockResolvedValue(
        makeCard({ card_pin: null, pin_hash: null, expiry_date: yesterday })
      );

      const result = await validateGiftCard({ gift_card_code: 'CMX-1234-5678-9012' });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('EXPIRED');
      // validateGiftCard MUST NOT call update — expiry mutation belongs in redeemGiftCardTx
      expect(mockGcUpdate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // refundGiftCardTx — actualRefundAmount surfaced, cap at original_amount
  // -------------------------------------------------------------------------

  describe('refundGiftCardTx', () => {
    const makeLockedCard = (currentBalance: number, originalAmount: number) => ({
      id: 'gc-r',
      tenant_org_id: 'tenant-xyz',
      current_balance: currentBalance,
      available_amount: currentBalance,
      original_amount: originalAmount,
      status: 'ACTIVE',
    });

    const buildRefundTx = (
      currentBalance: number,
      originalAmount: number,
      existingTxn: object | null = null
    ) => ({
      $queryRaw: jest.fn().mockResolvedValue([makeLockedCard(currentBalance, originalAmount)]),
      org_gift_card_txn_dtl: {
        findFirst: jest.fn().mockResolvedValue(existingTxn),
        create: jest.fn().mockResolvedValue({}),
      },
      org_gift_cards_mst: { update: jest.fn().mockResolvedValue({}) },
    });

    it('surfaces actualRefundAmount in the result', async () => {
      const tx = buildRefundTx(30, 50);
      const result = await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-r',
        amount: 15,
        orderId: 'order-1',
        invoiceId: 'inv-1',
        reason: 'Customer return',
        tenantOrgId: 'tenant-xyz',
      });
      expect(result.newBalance).toBeCloseTo(45, 3);
      expect(result.actualRefundAmount).toBeCloseTo(15, 3);
    });

    it('caps refund so balance does not exceed original_amount', async () => {
      // current=30, original=50, refund=30 → cap at 50-30=20
      const tx = buildRefundTx(30, 50);
      const result = await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-r',
        amount: 30,
        orderId: 'order-1',
        invoiceId: 'inv-1',
        reason: 'Large refund',
        tenantOrgId: 'tenant-xyz',
      });
      expect(result.newBalance).toBeCloseTo(50, 3);
      expect(result.actualRefundAmount).toBeCloseTo(20, 3);
    });

    it('skips and returns skipped:true when idempotency key already exists', async () => {
      const existingTxn = { id: 'txn-exists', balance_after: 45 };
      const tx = buildRefundTx(30, 50, existingTxn);
      const result = await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-r',
        amount: 15,
        orderId: 'order-1',
        invoiceId: 'inv-1',
        reason: 'Retry',
        tenantOrgId: 'tenant-xyz',
        idempotencyKey: 'order-1:refund:pay-1',
      });
      expect(result.skipped).toBe(true);
      expect(result.newBalance).toBe(45);
      const txCreate = tx.org_gift_card_txn_dtl.create as jest.Mock;
      expect(txCreate).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // applyGiftCardTx — deprecated shim resolves card by code and delegates
  // -------------------------------------------------------------------------

  describe('applyGiftCardTx (deprecated shim)', () => {
    it('throws GIFT_CARD_NOT_FOUND when card code does not exist', async () => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        org_gift_cards_mst: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
        org_gift_card_txn_dtl: { findFirst: jest.fn(), create: jest.fn() },
      };
      await expect(
        applyGiftCardTx(tx as never, {
          cardNumber: 'UNKNOWN-CODE',
          amount: 10,
          tenantOrgId: 'tenant-xyz',
          currencyCode: 'OMR',
          decimalPlaces: 3,
        })
      ).rejects.toThrow('GIFT_CARD_NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // 8.1 validateGiftCard — PIN hash path
  // -------------------------------------------------------------------------

  describe('validateGiftCard — PIN hash path', () => {
    const makeHashCard = (overrides: object = {}) => ({
      id: 'gc-hash',
      gift_card_code: 'CMX-HASH-CARD-0001',
      is_active: true,
      card_pin: null,
      pin_hash: '$2b$12$storedHash',
      pin_failed_attempts: 0,
      status: 'ACTIVE',
      expiry_date: null,
      current_balance: 50,
      available_amount: 50,
      tenant_org_id: 'tenant-xyz',
      card_name: 'Hash Card',
      card_name2: null,
      original_amount: 100,
      redeemed_amount: 0,
      bonus_amount: 0,
      bonus_remaining: 0,
      issued_date: new Date(),
      activation_date: null,
      issued_to_customer_id: null,
      purchased_by_cust_id: null,
      batch_id: null,
      is_reloadable: false,
      is_transferable: false,
      max_redemptions: null,
      redemption_count: 0,
      issue_type: 'SOLD',
      gift_card_type: 'FIXED_VALUE',
      currency_code: 'OMR',
      metadata: null,
      rec_notes: null,
      created_at: new Date(),
      created_by: null,
      updated_at: null,
      updated_by: null,
      issued_to_customer: null,
      ...overrides,
    });

    it('accepts correct PIN when pin_hash is set (legacy card_pin is null)', async () => {
      mockGcFindFirst.mockResolvedValue(makeHashCard());
      mockBcryptCompare.mockResolvedValue(true);
      const result = await validateGiftCard({ gift_card_code: 'CMX-HASH-CARD-0001', card_pin: 'correct' });
      expect(result.isValid).toBe(true);
      expect(mockBcryptCompare).toHaveBeenCalledWith('correct', '$2b$12$storedHash');
    });

    it('rejects incorrect PIN when pin_hash is set', async () => {
      mockGcFindFirst.mockResolvedValue(makeHashCard());
      mockBcryptCompare.mockResolvedValue(false);
      const result = await validateGiftCard({ gift_card_code: 'CMX-HASH-CARD-0001', card_pin: 'wrong' });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PIN');
    });

    it('accepts correct legacy card_pin when pin_hash is null and triggers migration', async () => {
      // Legacy card: card_pin set, pin_hash null
      mockGcFindFirst.mockResolvedValue(makeHashCard({ card_pin: '1234', pin_hash: null }));
      // bcrypt.compare is not used for legacy path; plain equality is used
      mockGcUpdate.mockResolvedValue({});
      const result = await validateGiftCard({ gift_card_code: 'CMX-HASH-CARD-0001', card_pin: '1234' });
      expect(result.isValid).toBe(true);
      // migratePin fires update asynchronously; allow microtasks to settle
      await Promise.resolve();
      expect(mockGcUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pin_hash: expect.any(String), card_pin: null }),
        })
      );
    });

    it('rejects incorrect legacy card_pin', async () => {
      mockGcFindFirst.mockResolvedValue(makeHashCard({ card_pin: '1234', pin_hash: null }));
      const result = await validateGiftCard({ gift_card_code: 'CMX-HASH-CARD-0001', card_pin: '9999' });
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PIN');
    });

    it('returns INVALID_PIN error code on wrong PIN, not a generic error', async () => {
      mockGcFindFirst.mockResolvedValue(makeHashCard());
      mockBcryptCompare.mockResolvedValue(false);
      const result = await validateGiftCard({ gift_card_code: 'CMX-HASH-CARD-0001', card_pin: 'bad' });
      expect(result.errorCode).toBe('INVALID_PIN');
      expect(result.error).toContain('PIN');
    });
  });

  // -------------------------------------------------------------------------
  // 8.2 refundGiftCardTx — idempotency
  // -------------------------------------------------------------------------

  describe('refundGiftCardTx — idempotency', () => {
    const makeLockedCard = (currentBalance: number, originalAmount: number) => ({
      id: 'gc-idem',
      tenant_org_id: 'tenant-xyz',
      current_balance: currentBalance,
      available_amount: currentBalance,
      original_amount: originalAmount,
      status: 'ACTIVE',
    });

    const buildRefundTx = (
      currentBalance: number,
      originalAmount: number,
      existingTxn: object | null = null
    ) => ({
      $queryRaw: jest.fn().mockResolvedValue([makeLockedCard(currentBalance, originalAmount)]),
      org_gift_card_txn_dtl: {
        findFirst: jest.fn().mockResolvedValue(existingTxn),
        create: jest.fn().mockResolvedValue({}),
      },
      org_gift_cards_mst: { update: jest.fn().mockResolvedValue({}) },
    });

    it('skips the refund and returns skipped:true when same idempotency_key already exists in ledger', async () => {
      const existing = { id: 'txn-dup', balance_after: 45 };
      const tx = buildRefundTx(30, 50, existing);
      const result = await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-idem',
        amount: 15,
        orderId: 'ord-1',
        invoiceId: 'inv-1',
        reason: 'Duplicate retry',
        tenantOrgId: 'tenant-xyz',
        idempotencyKey: 'ord-1:refund:dup',
      });
      expect(result.skipped).toBe(true);
      expect(result.newBalance).toBe(45);
      const txCreate = tx.org_gift_card_txn_dtl.create as jest.Mock;
      expect(txCreate).not.toHaveBeenCalled();
    });

    it('processes the refund when idempotency_key is new', async () => {
      const tx = buildRefundTx(30, 50, null);
      const result = await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-idem',
        amount: 10,
        orderId: 'ord-2',
        invoiceId: 'inv-2',
        reason: 'Valid refund',
        tenantOrgId: 'tenant-xyz',
        idempotencyKey: 'ord-2:refund:new',
      });
      expect(result.skipped).toBeUndefined();
      expect(result.newBalance).toBeCloseTo(40, 3);
      const txCreate = tx.org_gift_card_txn_dtl.create as jest.Mock;
      expect(txCreate).toHaveBeenCalledTimes(1);
    });

    it('processes the refund when idempotency_key is undefined (no key supplied)', async () => {
      const tx = buildRefundTx(30, 50, null);
      const result = await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-idem',
        amount: 10,
        orderId: 'ord-3',
        invoiceId: 'inv-3',
        reason: 'No idem key',
        tenantOrgId: 'tenant-xyz',
        // idempotencyKey deliberately omitted
      });
      // findFirst should NOT have been called for idempotency when key is absent
      const txFindFirst = tx.org_gift_card_txn_dtl.findFirst as jest.Mock;
      expect(txFindFirst).not.toHaveBeenCalled();
      expect(result.skipped).toBeUndefined();
      expect(result.newBalance).toBeCloseTo(40, 3);
    });
  });

  // -------------------------------------------------------------------------
  // 8.3 refundGiftCardTx — status revert after refund
  // -------------------------------------------------------------------------

  describe('refundGiftCardTx — status revert', () => {
    const buildRevertTx = (
      currentBalance: number,
      originalAmount: number,
      status: string
    ) => ({
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'gc-revert',
          tenant_org_id: 'tenant-xyz',
          available_amount: currentBalance,
          original_amount: originalAmount,
          status,
        },
      ]),
      org_gift_card_txn_dtl: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      org_gift_cards_mst: { update: jest.fn().mockResolvedValue({}) },
    });

    it('reverts FULLY_REDEEMED → ACTIVE when refund restores full original_amount', async () => {
      // current=0, original=50, refund=50 → newBalance=50 = original → ACTIVE
      const tx = buildRevertTx(0, 50, 'FULLY_REDEEMED');
      await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-revert',
        amount: 50,
        orderId: 'ord-rv1',
        invoiceId: 'inv-rv1',
        reason: 'Full refund',
        tenantOrgId: 'tenant-xyz',
      });
      const gcUpdate = tx.org_gift_cards_mst.update as jest.Mock;
      expect(gcUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
      );
    });

    it('reverts FULLY_REDEEMED → PARTIALLY_REDEEMED when refund is partial', async () => {
      // current=0, original=50, refund=20 → newBalance=20, 0 < 20 < 50 → PARTIALLY_REDEEMED
      const tx = buildRevertTx(0, 50, 'FULLY_REDEEMED');
      await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-revert',
        amount: 20,
        orderId: 'ord-rv2',
        invoiceId: 'inv-rv2',
        reason: 'Partial refund',
        tenantOrgId: 'tenant-xyz',
      });
      const gcUpdate = tx.org_gift_cards_mst.update as jest.Mock;
      expect(gcUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_REDEEMED' }) })
      );
    });

    it('does NOT revert status when card is VOIDED', async () => {
      // VOIDED is a terminal state — status must stay VOIDED
      const tx = buildRevertTx(0, 50, 'VOIDED');
      await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-revert',
        amount: 25,
        orderId: 'ord-rv3',
        invoiceId: 'inv-rv3',
        reason: 'Voided card refund attempt',
        tenantOrgId: 'tenant-xyz',
      });
      const gcUpdate = tx.org_gift_cards_mst.update as jest.Mock;
      expect(gcUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'VOIDED' }) })
      );
    });

    it('does NOT revert status when card is EXPIRED', async () => {
      const tx = buildRevertTx(0, 50, 'EXPIRED');
      await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-revert',
        amount: 25,
        orderId: 'ord-rv4',
        invoiceId: 'inv-rv4',
        reason: 'Expired card refund attempt',
        tenantOrgId: 'tenant-xyz',
      });
      const gcUpdate = tx.org_gift_cards_mst.update as jest.Mock;
      expect(gcUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED' }) })
      );
    });

    it('reverts PARTIALLY_REDEEMED → ACTIVE when refund restores full amount', async () => {
      // current=20, original=50, refund=30 → newBalance=50 → ACTIVE
      const tx = buildRevertTx(20, 50, 'PARTIALLY_REDEEMED');
      await refundGiftCardTx(tx as never, {
        giftCardId: 'gc-revert',
        amount: 30,
        orderId: 'ord-rv5',
        invoiceId: 'inv-rv5',
        reason: 'Full partial refund',
        tenantOrgId: 'tenant-xyz',
      });
      const gcUpdate = tx.org_gift_cards_mst.update as jest.Mock;
      expect(gcUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
      );
    });
  });

  // -------------------------------------------------------------------------
  // 8.4 redeemGiftCardTx — currency enforcement
  // -------------------------------------------------------------------------

  describe('redeemGiftCardTx — currency enforcement', () => {
    const buildCurrencyTx = (cardCurrency: string, existingTxn: object | null = null) => ({
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'gc-cur',
          available_amount: 50,
          original_amount: 100,
          status: 'ACTIVE',
          expiry_date: null,
          tenant_org_id: 'tenant-xyz',
          currency_code: cardCurrency,
          max_redemptions: null,
          redemption_count: 0,
        },
      ]),
      org_gift_card_txn_dtl: {
        findFirst: jest.fn().mockResolvedValue(existingTxn),
        create: jest.fn().mockResolvedValue({}),
      },
      org_gift_cards_mst: { update: jest.fn().mockResolvedValue({}) },
    });

    it('throws CURRENCY_MISMATCH when gift card currency differs from invoice currency', async () => {
      const tx = buildCurrencyTx('OMR');
      await expect(
        redeemGiftCardTx(tx as never, {
          giftCardId: 'gc-cur',
          amount: 10,
          tenantOrgId: 'tenant-xyz',
          invoiceCurrency: 'USD',
        })
      ).rejects.toThrow('CURRENCY_MISMATCH');
    });

    it('succeeds when currencies match', async () => {
      const tx = buildCurrencyTx('OMR');
      const result = await redeemGiftCardTx(tx as never, {
        giftCardId: 'gc-cur',
        amount: 10,
        tenantOrgId: 'tenant-xyz',
        invoiceCurrency: 'OMR',
      });
      expect(result.newBalance).toBeCloseTo(40, 3);
    });
  });

  // -------------------------------------------------------------------------
  // 8.5 adminAdjustGiftCard — credit cap
  // -------------------------------------------------------------------------

  describe('adminAdjustGiftCard — credit cap', () => {
    const buildAdjustTx = (currentBalance: number, originalAmount: number) => ({
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'gc-adj',
          available_amount: currentBalance,
          original_amount: originalAmount,
          status: 'PARTIALLY_REDEEMED',
          tenant_org_id: 'tenant-xyz',
        },
      ]),
      org_gift_card_txn_dtl: { create: jest.fn().mockResolvedValue({}) },
      org_gift_cards_mst: { update: jest.fn().mockResolvedValue({}) },
    });

    it('caps credit so available_amount does not exceed original_amount', async () => {
      // current=40, original=50, credit=20 → capped to 50
      const fakeTx = buildAdjustTx(40, 50);
      mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(fakeTx)
      );
      const result = await adminAdjustGiftCard('gc-adj', {
        tenantOrgId: 'tenant-xyz',
        adjustmentType: 'credit',
        amount: 20,
        reason: 'Goodwill top-up',
        actorId: 'admin-1',
      });
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(50);
      const gcUpdate = fakeTx.org_gift_cards_mst.update as jest.Mock;
      expect(gcUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ available_amount: 50 }) })
      );
    });

    it('allows exact credit to reach original_amount', async () => {
      // current=30, original=50, credit=20 → exactly 50
      const fakeTx = buildAdjustTx(30, 50);
      mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(fakeTx)
      );
      const result = await adminAdjustGiftCard('gc-adj', {
        tenantOrgId: 'tenant-xyz',
        adjustmentType: 'credit',
        amount: 20,
        reason: 'Exact top-up',
        actorId: 'admin-1',
      });
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // 8.6 redeemGiftCardTx — max_redemptions
  // -------------------------------------------------------------------------

  describe('redeemGiftCardTx — max_redemptions', () => {
    const buildMaxRedTx = (
      maxRedemptions: number | null,
      redemptionCount: number,
      existingTxn: object | null = null
    ) => ({
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'gc-max',
          available_amount: 50,
          original_amount: 100,
          status: 'ACTIVE',
          expiry_date: null,
          tenant_org_id: 'tenant-xyz',
          currency_code: 'OMR',
          max_redemptions: maxRedemptions,
          redemption_count: redemptionCount,
        },
      ]),
      org_gift_card_txn_dtl: {
        findFirst: jest.fn().mockResolvedValue(existingTxn),
        create: jest.fn().mockResolvedValue({}),
      },
      org_gift_cards_mst: { update: jest.fn().mockResolvedValue({}) },
    });

    it('throws MAX_REDEMPTIONS_REACHED when redemption_count >= max_redemptions', async () => {
      const tx = buildMaxRedTx(3, 3);
      await expect(
        redeemGiftCardTx(tx as never, {
          giftCardId: 'gc-max',
          amount: 10,
          tenantOrgId: 'tenant-xyz',
        })
      ).rejects.toThrow('MAX_REDEMPTIONS_REACHED');
    });

    it('succeeds when max_redemptions is null (unlimited)', async () => {
      const tx = buildMaxRedTx(null, 999);
      const result = await redeemGiftCardTx(tx as never, {
        giftCardId: 'gc-max',
        amount: 10,
        tenantOrgId: 'tenant-xyz',
      });
      expect(result.newBalance).toBeCloseTo(40, 3);
    });

    it('succeeds when redemption_count < max_redemptions', async () => {
      const tx = buildMaxRedTx(5, 2);
      const result = await redeemGiftCardTx(tx as never, {
        giftCardId: 'gc-max',
        amount: 10,
        tenantOrgId: 'tenant-xyz',
      });
      expect(result.newBalance).toBeCloseTo(40, 3);
    });
  });

  // -------------------------------------------------------------------------
  // 8.7 sellGiftCard — auto-activation, SALE ledger row, purchased_by_cust_id
  // -------------------------------------------------------------------------

  describe('sellGiftCard', () => {
    const makeCreatedCard = (overrides: object = {}) => ({
      id: 'gc-sold-1',
      tenant_org_id: 'tenant-xyz',
      gift_card_code: 'CMX-AAAA-BBBB-CCCC',
      card_name: 'Sold Card',
      card_name2: null,
      original_amount: { toNumber: () => 100 },
      current_balance: { toNumber: () => 100 },
      available_amount: { toNumber: () => 100 },
      redeemed_amount: { toNumber: () => 0 },
      bonus_amount: { toNumber: () => 0 },
      bonus_remaining: { toNumber: () => 0 },
      status: 'ACTIVE',
      is_active: true,
      is_reloadable: false,
      is_transferable: false,
      max_redemptions: null,
      redemption_count: 0,
      issue_type: 'SOLD',
      gift_card_type: 'FIXED_VALUE',
      currency_code: 'OMR',
      metadata: null,
      rec_notes: null,
      issued_date: new Date(),
      expiry_date: null,
      activation_date: new Date(),
      issued_to_customer_id: null,
      purchased_by_cust_id: 'cust-42',
      batch_id: null,
      created_at: new Date(),
      created_by: 'staff-1',
      updated_at: null,
      updated_by: null,
      issued_to_customer: null,
      ...overrides,
    });

    beforeEach(() => {
      // generateGiftCardCode calls findFirst to check uniqueness — return null so code is accepted
      mockGcFindFirst.mockResolvedValue(null);

      // sellGiftCard uses prisma.$transaction internally
      mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          org_gift_cards_mst: {
            create: jest.fn().mockResolvedValue(makeCreatedCard()),
          },
          org_gift_card_txn_dtl: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(fakeTx);
      });
    });

    it('creates card with status ACTIVE and activation_date set', async () => {
      const result = await sellGiftCard({
        tenantOrgId: 'tenant-xyz',
        cardName: 'Sold Card',
        amount: 100,
        currencyCode: 'OMR',
        purchasedByCustomerId: 'cust-42',
        createdBy: 'staff-1',
      });
      expect(result.status).toBe('ACTIVE');
      expect(result.activation_date).toBeDefined();
    });

    it('inserts a SALE ledger row', async () => {
      let capturedTxnCreate: jest.Mock | null = null;
      mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          org_gift_cards_mst: {
            create: jest.fn().mockResolvedValue(makeCreatedCard()),
          },
          org_gift_card_txn_dtl: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        capturedTxnCreate = fakeTx.org_gift_card_txn_dtl.create as jest.Mock;
        return fn(fakeTx);
      });

      await sellGiftCard({
        tenantOrgId: 'tenant-xyz',
        cardName: 'Sold Card',
        amount: 100,
        currencyCode: 'OMR',
      });

      expect(capturedTxnCreate).not.toBeNull();
      expect(capturedTxnCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ transaction_type: 'SALE' }),
        })
      );
    });

    it('sets purchased_by_cust_id from params', async () => {
      let capturedCardCreate: jest.Mock | null = null;
      mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          org_gift_cards_mst: {
            create: jest.fn().mockResolvedValue(makeCreatedCard()),
          },
          org_gift_card_txn_dtl: { create: jest.fn().mockResolvedValue({}) },
        };
        capturedCardCreate = fakeTx.org_gift_cards_mst.create as jest.Mock;
        return fn(fakeTx);
      });

      await sellGiftCard({
        tenantOrgId: 'tenant-xyz',
        cardName: 'Sold Card',
        amount: 100,
        currencyCode: 'OMR',
        purchasedByCustomerId: 'cust-42',
      });

      expect(capturedCardCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ purchased_by_cust_id: 'cust-42' }),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // 8.8 adminActivateGiftCard — GENERATED → ACTIVE, ACTIVATE ledger row, status guard
  // -------------------------------------------------------------------------

  describe('adminActivateGiftCard', () => {
    const generatedCard = {
      id: 'gc-gen-1',
      status: 'GENERATED',
      tenant_org_id: 'tenant-xyz',
    };

    const fullyActivatedCard = {
      id: 'gc-gen-1',
      tenant_org_id: 'tenant-xyz',
      gift_card_code: 'CMX-GEN1-GEN1-GEN1',
      card_name: 'Generated Card',
      card_name2: null,
      original_amount: { toNumber: () => 75 },
      current_balance: { toNumber: () => 75 },
      available_amount: { toNumber: () => 75 },
      redeemed_amount: { toNumber: () => 0 },
      bonus_amount: { toNumber: () => 0 },
      bonus_remaining: { toNumber: () => 0 },
      status: 'ACTIVE',
      is_active: true,
      is_reloadable: false,
      is_transferable: false,
      max_redemptions: null,
      redemption_count: 0,
      issue_type: 'PROMOTIONAL',
      gift_card_type: 'FIXED_VALUE',
      currency_code: 'OMR',
      metadata: null,
      rec_notes: null,
      issued_date: new Date(),
      expiry_date: null,
      activation_date: new Date(),
      issued_to_customer_id: null,
      purchased_by_cust_id: null,
      batch_id: null,
      created_at: new Date(),
      created_by: 'admin-1',
      updated_at: new Date(),
      updated_by: 'admin-1',
      issued_to_customer: null,
    };

    /**
     * Set up findFirstOrThrow on the mocked prisma object before each test.
     * adminActivateGiftCard uses findFirst (pre-check) then findFirstOrThrow (post-fetch).
     * Both must be mocked per-test to avoid cross-test mock state leakage.
     */
    beforeEach(() => {
      (prisma.org_gift_cards_mst as unknown as Record<string, jest.Mock>).findFirstOrThrow =
        jest.fn();
    });

    it('transitions GENERATED → ACTIVE and sets activation_date', async () => {
      mockGcFindFirst.mockResolvedValueOnce(generatedCard);
      (prisma.org_gift_cards_mst as unknown as Record<string, jest.Mock>).findFirstOrThrow
        .mockResolvedValue(fullyActivatedCard);

      mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          org_gift_cards_mst: { update: jest.fn().mockResolvedValue({}) },
          org_gift_card_txn_dtl: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(fakeTx);
      });

      const result = await adminActivateGiftCard('gc-gen-1', 'tenant-xyz', 'admin-1');
      expect(result.status).toBe('ACTIVE');
      expect(result.activation_date).toBeDefined();
    });

    it('inserts an ACTIVATE ledger row', async () => {
      mockGcFindFirst.mockResolvedValueOnce(generatedCard);
      (prisma.org_gift_cards_mst as unknown as Record<string, jest.Mock>).findFirstOrThrow
        .mockResolvedValue(fullyActivatedCard);

      let capturedTxnCreate: jest.Mock | null = null;
      mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const fakeTx = {
          org_gift_cards_mst: { update: jest.fn().mockResolvedValue({}) },
          org_gift_card_txn_dtl: { create: jest.fn().mockResolvedValue({}) },
        };
        capturedTxnCreate = fakeTx.org_gift_card_txn_dtl.create as jest.Mock;
        return fn(fakeTx);
      });

      await adminActivateGiftCard('gc-gen-1', 'tenant-xyz', 'admin-1');

      expect(capturedTxnCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ transaction_type: 'ACTIVATE' }),
        })
      );
    });

    it('throws when card is not in GENERATED status', async () => {
      // Card is already ACTIVE — pre-check throws before findFirstOrThrow is reached
      mockGcFindFirst.mockResolvedValueOnce({ ...generatedCard, status: 'ACTIVE' });
      // findFirstOrThrow will not be called, but guard it anyway
      (prisma.org_gift_cards_mst as unknown as Record<string, jest.Mock>).findFirstOrThrow
        .mockResolvedValue(fullyActivatedCard);

      await expect(
        adminActivateGiftCard('gc-gen-1', 'tenant-xyz', 'admin-1')
      ).rejects.toThrow(/Cannot activate card in status/);
    });
  });
});
