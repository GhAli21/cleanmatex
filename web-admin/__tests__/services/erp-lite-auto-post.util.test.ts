/**
 * B6 — erp-lite-auto-post.util.ts unit tests.
 *
 * Covers `logAutoPostOutcome`, the shared non-throwing outcome logger used
 * by every NON_BLOCKING B6 call site (payment/refund/gift-card/wallet/
 * advance). Deliberately verifies it never throws regardless of outcome.
 */

const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    info: (...a: unknown[]) => mockLoggerInfo(...a),
    warn: (...a: unknown[]) => mockLoggerWarn(...a),
    error: (...a: unknown[]) => mockLoggerError(...a),
  },
}));

import { logAutoPostOutcome, safeDispatchAutoPost } from '@/lib/services/erp-lite-auto-post.util';
import type { ErpLiteAutoPostDispatchResult } from '@/lib/types/erp-lite-auto-post';

beforeEach(() => jest.clearAllMocks());

describe('logAutoPostOutcome', () => {
  it('logs at info level for a skipped dispatch (routine — feature/policy not enabled)', () => {
    const result: ErpLiteAutoPostDispatchResult = {
      status: 'skipped',
      txn_event_code: 'PAYMENT_RECEIVED',
      request: {} as ErpLiteAutoPostDispatchResult['request'],
      skip_reason: 'FEATURE_NOT_ENABLED',
    };

    expect(() => logAutoPostOutcome('payment_received', result)).not.toThrow();
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });

  it('logs at warn level (never throws) when execution failed', () => {
    const result: ErpLiteAutoPostDispatchResult = {
      status: 'executed',
      txn_event_code: 'REFUND_ISSUED',
      request: {} as ErpLiteAutoPostDispatchResult['request'],
      execute_result: { success: false, error_message: 'ACCOUNT_NOT_FOUND' } as ErpLiteAutoPostDispatchResult['execute_result'],
    };

    expect(() => logAutoPostOutcome('refund_issued', result)).not.toThrow();
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it('logs nothing for a successful execution', () => {
    const result: ErpLiteAutoPostDispatchResult = {
      status: 'executed',
      txn_event_code: 'GIFT_CARD_SOLD',
      request: {} as ErpLiteAutoPostDispatchResult['request'],
      execute_result: { success: true } as ErpLiteAutoPostDispatchResult['execute_result'],
    };

    logAutoPostOutcome('gift_card_sold', result);
    expect(mockLoggerInfo).not.toHaveBeenCalled();
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});

describe('safeDispatchAutoPost', () => {
  it('logs the outcome and resolves normally when the dispatch succeeds', async () => {
    const result: ErpLiteAutoPostDispatchResult = {
      status: 'executed',
      txn_event_code: 'PAYMENT_RECEIVED',
      request: {} as ErpLiteAutoPostDispatchResult['request'],
      execute_result: { success: true } as ErpLiteAutoPostDispatchResult['execute_result'],
    };

    await expect(safeDispatchAutoPost('payment_received', async () => result)).resolves.toBeUndefined();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('never throws — catches and logs when the dispatch call itself throws (e.g. unmocked test env / DB hiccup)', async () => {
    await expect(
      safeDispatchAutoPost('payment_received', async () => {
        throw new Error('tx.$queryRaw is not a function');
      }),
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockLoggerError.mock.calls[0][0]).toContain('payment_received');
  });

  it('never throws for a non-Error rejection either', async () => {
    await expect(
      safeDispatchAutoPost('refund_issued', async () => {
        throw 'a string rejection';
      }),
    ).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledTimes(1);
  });
});
