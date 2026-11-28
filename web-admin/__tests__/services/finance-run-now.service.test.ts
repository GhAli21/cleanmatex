/** @jest-environment node */

/**
 * Background Jobs 6g: "run now" for one Organization. Checks that every read is filtered to the
 * caller's Organization and that the counts mean what the screen says.
 */

const m = {
  queryRaw: jest.fn(),
  giftItem: jest.fn(),
  loyaltyItem: jest.fn(),
  retry: jest.fn(),
};

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/prisma', () => ({
  prisma: { $queryRaw: (...a: unknown[]) => m.queryRaw(...a) },
}));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (_t: string, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/utils/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/services/finance-expiry-jobs.service', () => ({
  EXPIRY_SWEEP_PAGE: 100,
  runGiftCardExpiryItem: (...a: unknown[]) => m.giftItem(...a),
  runLoyaltyExpiryItem: (...a: unknown[]) => m.loyaltyItem(...a),
}));
jest.mock('@/lib/services/erp-lite-exceptions.service', () => ({
  ErpLiteExceptionsService: { retryException: (...a: unknown[]) => m.retry(...a) },
}));

import {
  expireDueCreditNotesNow,
  expireDueGiftCardsNow,
  retryErpSystemErrorsNow,
} from '@/lib/services/finance-run-now.service';

const TENANT = '11111111-1111-4111-8111-111111111111';

/** Values bound into a Prisma tagged-template call. */
const boundValues = (call: unknown[]) => call.slice(1);

beforeEach(() => jest.clearAllMocks());

describe('finance run now (6g)', () => {
  it('gift cards: reads due cards for the caller only and counts expired, skipped and failed', async () => {
    m.queryRaw.mockResolvedValueOnce([{ gift_card_id: 'a' }, { gift_card_id: 'b' }, { gift_card_id: 'c' }]);
    m.giftItem
      .mockResolvedValueOnce({ outcome: 'EXPIRED' })
      .mockResolvedValueOnce({ outcome: 'SKIPPED_ORPHAN' })
      .mockRejectedValueOnce(new Error('lock timeout'));

    const r = await expireDueGiftCardsNow(TENANT);

    expect(boundValues(m.queryRaw.mock.calls[0])).toEqual([100, TENANT]);
    expect(m.giftItem).toHaveBeenCalledWith(TENANT, 'a');
    expect(r).toEqual({ done: 1, failed: 1, more: false });
  });

  it('gift cards: a full page says more are waiting', async () => {
    m.queryRaw.mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => ({ gift_card_id: `g${i}` })));
    m.giftItem.mockResolvedValue({ outcome: 'EXPIRED' });

    expect(await expireDueGiftCardsNow(TENANT)).toEqual({ done: 100, failed: 0, more: true });
  });

  it('credit notes: runs the database function for the caller only', async () => {
    m.queryRaw.mockResolvedValueOnce([{ r: { expired: 2, skipped: 1, failed: 0, zone_missing: 0 } }]);

    const r = await expireDueCreditNotesNow(TENANT);

    expect(boundValues(m.queryRaw.mock.calls[0])).toEqual([TENANT]);
    expect(r).toEqual({ done: 2, failed: 0, more: false });
  });

  it('ERP: retries only the caller\'s SYSTEM_ERROR exceptions and counts a failed retry as failed', async () => {
    m.queryRaw.mockResolvedValueOnce([
      { exception_id: 'e1', posting_log_id: 'l1' },
      { exception_id: 'e2', posting_log_id: 'l2' },
    ]);
    m.retry.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false, error: 'x' });

    const r = await retryErpSystemErrorsNow(TENANT);

    expect(boundValues(m.queryRaw.mock.calls[0])).toEqual([TENANT, 'SYSTEM_ERROR', 50]);
    expect(m.retry).toHaveBeenCalledWith('e1', 'l1');
    expect(m.retry).toHaveBeenCalledWith('e2', 'l2');
    expect(r).toEqual({ done: 1, failed: 1, more: false });
  });
});
