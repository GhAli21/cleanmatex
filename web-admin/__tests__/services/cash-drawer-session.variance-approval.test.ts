/**
 * Tests: approveVarianceTx (B16, CLF-aware) in cash-drawer-session.service.
 *
 * Ported from the retired single-step `approveSessionVariance` suite. Owner policy:
 * no maker-checker — holding `cash_drawer:approve_variance` (enforced by the route) is
 * the only gate, so approver === closer is allowed. Also pins that every currency is
 * judged against its OWN tolerance snapshot when the deferred over/short event fires.
 */

const mockEmitEvent = jest.fn();

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/db/tenant-context', () => ({ withTenantContext: (_t: string, fn: () => unknown) => fn() }));
jest.mock('@/lib/services/outbox.service', () => ({ emitEventTx: (...a: unknown[]) => mockEmitEvent(...a) }));
jest.mock('@/lib/services/cash-control-settings.service', () => ({ getCashControlSettings: jest.fn() }));
jest.mock('@/lib/services/cash-drawer-count.service', () => ({ recordCountTx: jest.fn() }));
jest.mock('@/lib/services/cash-drawer-trx.service', () => ({ postDrawerTrxTx: jest.fn() }));
jest.mock('@/lib/services/cash-drawer-ledger/cash-drawer-lock', () => ({ lockDrawersTx: jest.fn() }));
jest.mock('@/lib/services/cash-drawer-ledger/cash-drawer-balance.service', () => ({
  computeOpeningExpectedTx: jest.fn(),
  computeClosingExpectedTx: jest.fn(),
}));

import { Decimal } from '@prisma/client/runtime/library';
import { approveVarianceTx } from '@/lib/services/cash-drawer-session.service';
import { VarianceApprovalError, VARIANCE_APPROVAL_ERRORS } from '@/lib/services/cash-drawer.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const SESSION = '22222222-2222-2222-2222-222222222222';
const ctx = { tenantOrgId: TENANT, userId: 'supervisor-001' };

type Row = { currency_code: string; closing_variance: Decimal | null; variance_tolerance_snap: Decimal | null };

function makeTx(session: Record<string, unknown> | null, balanceRows: Row[] = []) {
  const update = jest.fn().mockResolvedValue({});
  const tx = {
    org_cash_drawer_sessions_mst: {
      findFirst: jest.fn().mockResolvedValue(session),
      update,
    },
    org_cash_drawer_ses_bal_dtl: { findMany: jest.fn().mockResolvedValue(balanceRows) },
  };
  return { tx: tx as never, update, findSession: tx.org_cash_drawer_sessions_mst.findFirst };
}

const pendingSession = (over: Record<string, unknown> = {}) => ({
  id: SESSION,
  cash_drawer_id: 'drawer-1',
  branch_id: 'branch-1',
  variance_threshold_snapshot: new Decimal('10'),
  variance_approved_by: null,
  ...over,
});

describe('approveVarianceTx (B16)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('approves with a reason and records the approver, tenant-scoped', async () => {
    const { tx, update } = makeTx(pendingSession());

    await approveVarianceTx(tx, ctx, SESSION, { reason: '  Verified physical count with cashier  ' });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_org_id: TENANT, id: SESSION },
        data: expect.objectContaining({
          variance_approved_by: 'supervisor-001',
          variance_approval_reason: 'Verified physical count with cashier',
        }),
      }),
    );
  });

  it('allows self-approval — permission is the only gate (no maker-checker)', async () => {
    const { tx, update } = makeTx(pendingSession({ closed_by: 'supervisor-001' }));

    await expect(approveVarianceTx(tx, ctx, SESSION, { reason: 'ok' })).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('rejects a blank reason before touching the database', async () => {
    const { tx, findSession } = makeTx(pendingSession());

    await expect(approveVarianceTx(tx, ctx, SESSION, { reason: '   ' })).rejects.toMatchObject({
      code: VARIANCE_APPROVAL_ERRORS.REASON_REQUIRED,
    });
    expect(findSession).not.toHaveBeenCalled();
  });

  it('rejects when the session has no pending approval (no threshold snapshot)', async () => {
    const { tx } = makeTx(pendingSession({ variance_threshold_snapshot: null }));

    await expect(approveVarianceTx(tx, ctx, SESSION, { reason: 'ok' })).rejects.toMatchObject({
      code: VARIANCE_APPROVAL_ERRORS.NOT_PENDING_APPROVAL,
    });
  });

  it('rejects a second approval attempt (single-shot) with a typed error', async () => {
    const { tx } = makeTx(pendingSession({ variance_approved_by: 'supervisor-002' }));

    const attempt = approveVarianceTx(tx, ctx, SESSION, { reason: 'ok' });
    await expect(attempt).rejects.toBeInstanceOf(VarianceApprovalError);
    await expect(attempt).rejects.toMatchObject({ code: VARIANCE_APPROVAL_ERRORS.ALREADY_APPROVED });
  });

  it('emits the withheld over/short event only for currencies outside THEIR OWN tolerance', async () => {
    // USD first with no variance, then OMR 0.4 (tolerance 0.5 → inside), then AED 2 (tolerance 1 → outside).
    // A positional bug would judge AED against OMR's tolerance (or USD's), flipping the outcome.
    const { tx } = makeTx(pendingSession(), [
      { currency_code: 'USD', closing_variance: null, variance_tolerance_snap: new Decimal('0') },
      { currency_code: 'OMR', closing_variance: new Decimal('0.4'), variance_tolerance_snap: new Decimal('0.5') },
      { currency_code: 'AED', closing_variance: new Decimal('-2'), variance_tolerance_snap: new Decimal('1') },
    ]);

    await approveVarianceTx(tx, ctx, SESSION, { reason: 'ok' });

    expect(mockEmitEvent).toHaveBeenCalledTimes(1);
    const payload = mockEmitEvent.mock.calls[0][5] as { variances: Array<{ currencyCode: string; varianceAmount: string }> };
    expect(payload.variances).toEqual([{ currencyCode: 'AED', varianceAmount: '-2.0000' }]);
  });

  it('emits nothing when every variance is inside tolerance', async () => {
    const { tx } = makeTx(pendingSession(), [
      { currency_code: 'OMR', closing_variance: new Decimal('0.4'), variance_tolerance_snap: new Decimal('0.5') },
    ]);

    await approveVarianceTx(tx, ctx, SESSION, { reason: 'ok' });

    expect(mockEmitEvent).not.toHaveBeenCalled();
  });
});
