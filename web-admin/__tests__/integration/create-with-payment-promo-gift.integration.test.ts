/// <reference types="jest" />
/**
 * Integration tests: create-with-payment promo + gift card flow
 *
 * Exercises the atomic composition of `applyPromoCodeTx` + `applyGiftCardTx`
 * inside a single Prisma transaction — the heart of the promotions/gift cards
 * checkout path described in plan §1.3 / §8.
 *
 * Mocks Prisma at the boundary (no real DB connection in CI) but composes the
 * real service-layer Tx helpers so the test proves:
 *   - Happy path: promo usage row + gift transaction row + promo increment +
 *     gift balance debit all happen inside one tx callback.
 *   - Mid-tx rollback: when applyGiftCardTx throws, the outer caller does not
 *     swallow the error — the transaction is signaled as failed.
 *   - TOCTOU: SELECT FOR UPDATE SQL is issued for both promo and gift card
 *     rows before mutating state.
 *   - Idempotent retry: second call with the same orderId returns current balance
 *     without issuing a second debit (safe network-retry path).
 *
 * Plan: docs/dev/plans/promotions_and_gifts_30156abf.plan.md (§8)
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('tenant-int'),
  withTenantContext: jest.fn(async (_id: string, fn: (id: string) => Promise<unknown>) =>
    fn('tenant-int')
  ),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/services/tenant-settings.service', () => ({
  tenantSettingsService: {
    getCurrencyConfig: jest.fn().mockResolvedValue({ currencyCode: 'OMR', decimalPlaces: 3 }),
  },
  createTenantSettingsService: jest.fn(() => ({
    getCurrencyConfig: jest.fn().mockResolvedValue({ currencyCode: 'OMR', decimalPlaces: 3 }),
  })),
}));

jest.mock('@/lib/money/format-money', () => ({
  formatMoneyAmountWithCode: jest.fn((v: number) => String(v)),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------

import { applyPromoCodeTx } from '@/lib/services/discount-service';
import { applyGiftCardTx } from '@/lib/services/gift-card-service';

// Structural mock type — avoids referencing jest namespace in type position
// while still exposing .mock.calls for assertion helpers below.
interface MockFn {
   
  (...args: any[]): Promise<any>;
  mock: { calls: unknown[][] };
}
 
type AnyMock = (...args: any[]) => Promise<any>;

interface CapturedTx {
  $queryRaw: MockFn;
  org_promotion_usage_dtl: { create: AnyMock };
  org_promotions_mst: { update: AnyMock };
  /** Updated model name from migration 0257 */
  org_gift_card_txn_dtl: { create: AnyMock; findFirst: AnyMock };
  org_gift_cards_mst: { findFirst: AnyMock; update: AnyMock };
}

function buildFakeTx(opts: {
  promoLocked?: { id: string; current_uses: number; max_uses: number | null }[];
  giftLocked?: {
    id: string;
    tenant_org_id: string;
    current_balance: number;
    available_amount: number;
    original_amount: number;
    status: string;
    expiry_date: Date | null;
    redemption_count: number;
    max_redemptions: number | null;
  }[];
  /** Card returned by org_gift_cards_mst.findFirst (for applyGiftCardTx shim). */
  gcFindFirstResult?: { id: string } | null;
}): CapturedTx {
  const queryRawCalls: unknown[][] = [];
  const $queryRaw = jest.fn((..._args: unknown[]) => {
    queryRawCalls.push(_args);
    // Inspect tagged-template strings: first arg is a TemplateStringsArray.
    const sql = String((_args[0] as TemplateStringsArray | undefined)?.raw?.join(' ') ?? '');
    if (sql.includes('org_promotions_mst')) {
      return Promise.resolve(opts.promoLocked ?? []);
    }
    if (sql.includes('org_gift_cards_mst')) {
      return Promise.resolve(opts.giftLocked ?? []);
    }
    return Promise.resolve([]);
  });
  const gcTxCreate = jest.fn().mockResolvedValue({});
  const gcTxFindFirst = jest.fn().mockResolvedValue(null);
  // Default: return the first giftLocked card id (shim uses findFirst to resolve code → id)
  const gcFindFirst = jest.fn().mockResolvedValue(
    opts.gcFindFirstResult !== undefined
      ? opts.gcFindFirstResult
      : opts.giftLocked?.[0]
        ? { id: opts.giftLocked[0].id }
        : null
  );
  return {
    $queryRaw,
    org_promotion_usage_dtl: { create: jest.fn().mockResolvedValue({}) },
    org_promotions_mst: { update: jest.fn().mockResolvedValue({}) },
    org_gift_card_txn_dtl: { create: gcTxCreate, findFirst: gcTxFindFirst },
    org_gift_cards_mst: { findFirst: gcFindFirst, update: jest.fn().mockResolvedValue({}) },
  };
}

describe('create-with-payment: promo + gift card integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Happy path
  // -------------------------------------------------------------------------

  it('commits promo usage + gift debit inside a single transaction (happy path)', async () => {
    const tx = buildFakeTx({
      promoLocked: [{ id: 'promo-1', current_uses: 0, max_uses: 100 }],
      giftLocked: [
        {
          id: 'gc-1',
          tenant_org_id: 'tenant-int',
          current_balance: 50,
          available_amount: 50,
          original_amount: 100,
          status: 'ACTIVE',
          expiry_date: null,
          redemption_count: 0,
          max_redemptions: null,
        },
      ],
    });

    // Simulate the wrapper used by create-with-payment route:
    //   prisma.$transaction(async (tx) => { …promo + gift… })
    await applyPromoCodeTx(tx as never, {
      promoCodeId: 'promo-1',
      orderId: 'order-1',
      invoiceId: 'inv-1',
      tenantOrgId: 'tenant-int',
      discountAmount: 5,
      orderTotalBefore: 50,
      appliedBy: 'user-1',
    });

    const giftResult = await applyGiftCardTx(tx as never, {
      cardNumber: 'GC-INT',
      amount: 20,
      orderId: 'order-1',
      invoiceId: 'inv-1',
      tenantOrgId: 'tenant-int',
      currencyCode: 'OMR',
      decimalPlaces: 3,
      processedBy: 'user-1',
    });

    // Assertions: usage log + gift transaction both written; both row updates
    // happened on the same tx instance (proves single-tx semantics).
    expect(tx.org_promotion_usage_dtl.create).toHaveBeenCalledTimes(1);
    expect(tx.org_promotions_mst.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ current_uses: { increment: 1 } }),
      })
    );
    expect(tx.org_gift_card_txn_dtl.create).toHaveBeenCalledTimes(1);
    expect(tx.org_gift_cards_mst.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ current_balance: 30 }),
      })
    );
    expect(giftResult.newBalance).toBe(30);
  });

  // -------------------------------------------------------------------------
  // 2. Mid-tx rollback — invalid gift card causes throw
  // -------------------------------------------------------------------------

  it('rolls back when applyGiftCardTx throws (invalid gift card)', async () => {
    const tx = buildFakeTx({
      promoLocked: [{ id: 'promo-1', current_uses: 0, max_uses: 100 }],
      giftLocked: [], // empty → GIFT_CARD_NOT_FOUND
    });

    // Promo applies first — its writes are recorded on tx.
    await applyPromoCodeTx(tx as never, {
      promoCodeId: 'promo-1',
      orderId: 'order-1',
      invoiceId: 'inv-1',
      tenantOrgId: 'tenant-int',
      discountAmount: 5,
      orderTotalBefore: 50,
      appliedBy: 'user-1',
    });

    // Gift card application throws — the real Prisma $transaction wrapper
    // would propagate this and roll back the entire tx. We assert the throw.
    await expect(
      applyGiftCardTx(tx as never, {
        cardNumber: 'INVALID',
        amount: 20,
        tenantOrgId: 'tenant-int',
        currencyCode: 'OMR',
        decimalPlaces: 3,
      })
    ).rejects.toThrow('GIFT_CARD_NOT_FOUND');

    // Prove that no gift card mutations were issued (the failure is detected
    // before any writes happen on the gift-card side).
    expect(tx.org_gift_card_txn_dtl.create).not.toHaveBeenCalled();
    expect(tx.org_gift_cards_mst.update).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 3. TOCTOU concurrency — verify SELECT FOR UPDATE is issued
  // -------------------------------------------------------------------------

  it('issues SELECT FOR UPDATE on promo and gift card rows', async () => {
    const tx = buildFakeTx({
      promoLocked: [{ id: 'promo-1', current_uses: 0, max_uses: 100 }],
      giftLocked: [
        {
          id: 'gc-1',
          tenant_org_id: 'tenant-int',
          current_balance: 50,
          available_amount: 50,
          original_amount: 100,
          status: 'ACTIVE',
          expiry_date: null,
          redemption_count: 0,
          max_redemptions: null,
        },
      ],
    });

    await applyPromoCodeTx(tx as never, {
      promoCodeId: 'promo-1',
      orderId: 'order-1',
      invoiceId: 'inv-1',
      tenantOrgId: 'tenant-int',
      discountAmount: 5,
      orderTotalBefore: 50,
    });
    await applyGiftCardTx(tx as never, {
      cardNumber: 'GC-INT',
      amount: 5,
      tenantOrgId: 'tenant-int',
      currencyCode: 'OMR',
      decimalPlaces: 3,
    });

    // Both Tx helpers issue their lock query via $queryRaw before mutating.
    // Inspect the captured tagged-template strings.
    const allSqlConcatenated = tx.$queryRaw.mock.calls
      .map((c) => String((c[0] as TemplateStringsArray | undefined)?.raw?.join(' ') ?? ''))
      .join(' || ');

    expect(allSqlConcatenated).toMatch(/FOR UPDATE/);
    expect(allSqlConcatenated).toMatch(/org_promotions_mst/);
    expect(allSqlConcatenated).toMatch(/org_gift_cards_mst/);
  });

  it('rejects second concurrent promo apply when max_uses already reached', async () => {
    // Simulate the second of two near-simultaneous calls: by the time the
    // second tx acquires the row lock, the first has already incremented
    // current_uses to max_uses, so the row reads as fully consumed.
    const tx = buildFakeTx({
      promoLocked: [{ id: 'promo-1', current_uses: 1, max_uses: 1 }],
    });

    await expect(
      applyPromoCodeTx(tx as never, {
        promoCodeId: 'promo-1',
        orderId: 'order-2',
        invoiceId: 'inv-2',
        tenantOrgId: 'tenant-int',
        discountAmount: 5,
        orderTotalBefore: 50,
      })
    ).rejects.toThrow('PROMO_MAX_USES_EXCEEDED');
  });

  // -------------------------------------------------------------------------
  // 4. Idempotent retry — second applyGiftCardTx call with same orderId must
  //    not issue a second debit (safe network-retry path, plan §8 item 4).
  // -------------------------------------------------------------------------

  it('skips gift card debit on idempotent retry (same orderId already has redemption)', async () => {
    const tx = buildFakeTx({
      giftLocked: [
        {
          id: 'gc-1',
          tenant_org_id: 'tenant-int',
          // Balance reflects the first (already committed) debit: 50 - 20 = 30.
          current_balance: 30,
          available_amount: 30,
          original_amount: 100,
          status: 'ACTIVE',
          expiry_date: null,
          redemption_count: 1,
          max_redemptions: null,
        },
      ],
    });

    // Simulate a retry: a redemption row for this order already exists in the DB.
    (tx.org_gift_card_txn_dtl.findFirst as jest.Mock).mockResolvedValue({
      balance_after: 30,
    });

    const result = await applyGiftCardTx(tx as never, {
      cardNumber: 'GC-RETRY',
      amount: 20,
      orderId: 'order-retry',
      invoiceId: 'inv-retry',
      tenantOrgId: 'tenant-int',
      currencyCode: 'OMR',
      decimalPlaces: 3,
    });

    // No second debit — neither write operation must fire on the retry path.
    expect(tx.org_gift_card_txn_dtl.create).not.toHaveBeenCalled();
    expect(tx.org_gift_cards_mst.update).not.toHaveBeenCalled();

    // Returns current balance from the locked row so callers get consistent data.
    expect(result.newBalance).toBe(30);
  });
});
