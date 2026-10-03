/**
 * @jest-environment node
 */
jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('@/lib/services/pos-session.service', () => {
  class PosSessionError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly httpStatus = 422,
      public readonly details?: Record<string, unknown>,
    ) {
      super(message);
    }
  }
  return { PosSessionError };
});

import { PosSessionError } from '@/lib/services/pos-session.service';
import { posSessionFinanceErrorResponse } from '@/lib/api/pos-session-finance-errors';

describe('posSessionFinanceErrorResponse (B1)', () => {
  it('maps POS_SESSION_REQUIRED to a 409 carrying the code and the inline-open payload', async () => {
    const res = posSessionFinanceErrorResponse(
      new PosSessionError('POS_SESSION_REQUIRED', 'An open POS session is required.', 409, { canOpenInline: true }),
    );
    expect(res?.status).toBe(409);
    await expect(res?.json()).resolves.toEqual({
      success: false,
      errorCode: 'POS_SESSION_REQUIRED',
      code: 'POS_SESSION_REQUIRED',
      error: 'An open POS session is required.',
      details: { canOpenInline: true },
    });
  });

  it('omits details when there are none', async () => {
    const res = posSessionFinanceErrorResponse(new PosSessionError('POS_SESSION_MISMATCH', 'Mismatch', 409));
    expect(Object.keys(await (res as Response).json())).not.toContain('details');
  });

  it('leaves every other error to the caller', () => {
    expect(posSessionFinanceErrorResponse(new Error('boom'))).toBeNull();
    expect(posSessionFinanceErrorResponse('POS_SESSION_REQUIRED')).toBeNull();
  });
});
