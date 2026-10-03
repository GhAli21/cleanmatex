/**
 * CLF-9 (plan §4B.14 "API") — the shared cash-drawer route error mapper pins the §4B.11 contract:
 * one `{ success: false, error, code }` envelope, the documented HTTP status per code, and no
 * raw internal message ever reaching the client.
 *
 * @jest-environment node
 */
import { mapCashDrawerError } from '@/lib/api/cash-drawer-route-errors';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { CashDrawerSessionError, VarianceApprovalError } from '@/lib/services/cash-drawer.service';
import { CASH_LEDGER_ERRORS, type CashLedgerErrorCode } from '@/lib/constants/cash-drawer';

jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() } }));

/** §4B.11 — every ledger code and its documented HTTP status. */
const EXPECTED_STATUS: Record<CashLedgerErrorCode, number> = {
  CASH_DRAWER_REQUIRED: 422,
  CASH_DRAWER_INACTIVE: 422,
  CASH_DRAWER_BRANCH_MISMATCH: 422,
  CASH_DRAWER_TYPE_NOT_ALLOWED: 422,
  CASH_CURRENCY_REQUIRED: 422,
  CASH_CURRENCY_MISMATCH: 422,
  CASH_DRAWER_SESSION_NOT_OPEN: 409,
  DRAWER_SESSION_CLOSING: 409,
  DRAWER_SESSION_NOT_CLOSING: 409,
  DRAWER_SESSION_WRONG_DRAWER: 422,
  CASH_DISPOSITION_DEST_REQUIRED: 422,
  CASH_DISPOSITION_AMOUNT_INVALID: 422,
  CASH_DISPOSITION_NOTES_REQUIRED: 422,
  CASH_COUNT_REQUIRED: 422,
  CASH_COUNT_TOTAL_MISMATCH: 422,
  CASH_TRX_UNBALANCED: 422,
  CASH_TRX_SAME_DRAWER: 422,
  CASH_TRX_CROSS_BRANCH: 422,
  CASH_LINE_IMMUTABLE: 409,
  CASH_LEG_MUST_REVERSE: 409,
  POST_CLOSE_SESSION_NOT_CLOSED: 409,
  CASH_DRAWER_CURRENCY_NOT_CONFIGURED: 422,
  CASH_RECEIVER_INVALID: 422,
  DRAWER_NOT_ASSIGNED_TO_USER: 403,
  DRAWER_BRANCH_FORBIDDEN: 403,
  CASH_TRANSIT_NOT_FOUND: 404,
  CASH_TRANSIT_NOT_OPEN: 409,
  CASH_TRANSIT_REASON_REQUIRED: 400,
  CASH_TRANSIT_USE_CANCEL: 409,
  CASH_DENOMINATION_DISABLED: 422,
  CASH_COUNT_MODE_NOT_ALLOWED: 422,
};

async function body(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

describe('mapCashDrawerError', () => {
  it('has an expectation for every ledger error code (a new code must be classified here)', () => {
    expect(Object.keys(EXPECTED_STATUS).sort()).toEqual(Object.values(CASH_LEDGER_ERRORS).sort());
  });

  it.each(Object.entries(EXPECTED_STATUS))('%s → HTTP %i with the { success, error, code } envelope', async (code, status) => {
    const res = mapCashDrawerError(new CashDrawerLedgerError(code as CashLedgerErrorCode, 'internal detail that must not leak'));
    expect(res.status).toBe(status);
    expect(await body(res)).toEqual({ success: false, error: code, code });
  });

  it('maps session and variance-approval errors to 409 / 400 with their own stable codes', async () => {
    const already = mapCashDrawerError(new CashDrawerSessionError('DRAWER_SESSION_ALREADY_OPEN'));
    expect(already.status).toBe(409);
    expect(await body(already)).toMatchObject({ success: false, code: 'DRAWER_SESSION_ALREADY_OPEN' });

    const reason = mapCashDrawerError(new VarianceApprovalError('VARIANCE_REASON_REQUIRED'));
    expect(reason.status).toBe(400);
    const notPending = mapCashDrawerError(new VarianceApprovalError('VARIANCE_NOT_PENDING_APPROVAL'));
    expect(notPending.status).toBe(409);
  });

  it('never sends an unexpected error\'s raw message to the client — only the route\'s fallback text', async () => {
    const res = mapCashDrawerError(
      new Error('Invalid `prisma.org_cash_drawers_mst.findMany()` invocation: column "ledger_seq" of relation does not exist'),
      'Failed to load drawers',
    );
    expect(res.status).toBe(500);
    const payload = await body(res);
    expect(payload).toEqual({ success: false, error: 'Failed to load drawers' });
    expect(JSON.stringify(payload)).not.toMatch(/prisma|ledger_seq|relation/i);
  });

  it('handles a non-Error throw without crashing', async () => {
    const res = mapCashDrawerError('boom', 'Request failed');
    expect(res.status).toBe(500);
    expect(await body(res)).toEqual({ success: false, error: 'Request failed' });
  });
});
