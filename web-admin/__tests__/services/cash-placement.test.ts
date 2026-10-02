/**
 * Tests: cash-placement — explicit cash placement override (VERIFY / reversal)
 *
 * Covers: empty override, session → drawer derivation, drawer/session mismatch,
 * unknown session, inactive/unknown receiving user, pinned-session enforcement.
 */
jest.mock('server-only', () => ({}));

import {
  assertPinnedSession,
  hasCashPlacement,
  resolveCashPlacementTx,
} from '@/lib/services/cash-drawer-ledger/cash-placement';

const TENANT = '11111111-1111-1111-1111-111111111111';

const makeTx = (opts: { session?: { cash_drawer_id: string } | null; user?: { user_id: string } | null } = {}) => ({
  org_cash_drawer_sessions_mst: { findFirst: jest.fn().mockResolvedValue(opts.session ?? null) },
  org_users_mst: { findFirst: jest.fn().mockResolvedValue(opts.user ?? null) },
});

describe('hasCashPlacement', () => {
  it('is false for empty / nullish overrides', () => {
    expect(hasCashPlacement(undefined)).toBe(false);
    expect(hasCashPlacement(null)).toBe(false);
    expect(hasCashPlacement({})).toBe(false);
    expect(hasCashPlacement({ cashDrawerId: null })).toBe(false);
  });
  it('is true when any field is set', () => {
    expect(hasCashPlacement({ cashDrawerId: 'd' })).toBe(true);
    expect(hasCashPlacement({ receivedByUserId: 'u' })).toBe(true);
  });
});

describe('resolveCashPlacementTx', () => {
  it('returns null and touches nothing for an empty override', async () => {
    const tx = makeTx();
    await expect(resolveCashPlacementTx(tx as never, TENANT, {})).resolves.toBeNull();
    expect(tx.org_cash_drawer_sessions_mst.findFirst).not.toHaveBeenCalled();
  });

  it('passes a drawer-only override through', async () => {
    const tx = makeTx();
    await expect(resolveCashPlacementTx(tx as never, TENANT, { cashDrawerId: 'd1' })).resolves.toEqual({
      drawerId: 'd1',
      sessionId: null,
      recognizedBy: null,
    });
  });

  it('derives the drawer from a session-only override, tenant-scoped', async () => {
    const tx = makeTx({ session: { cash_drawer_id: 'd2' } });
    const r = await resolveCashPlacementTx(tx as never, TENANT, { cashDrawerSessionId: 's1' });
    expect(r).toEqual({ drawerId: 'd2', sessionId: 's1', recognizedBy: null });
    expect(tx.org_cash_drawer_sessions_mst.findFirst).toHaveBeenCalledWith({
      where: { id: 's1', tenant_org_id: TENANT },
      select: { cash_drawer_id: true },
    });
  });

  it('rejects a session that belongs to another drawer', async () => {
    const tx = makeTx({ session: { cash_drawer_id: 'd2' } });
    await expect(
      resolveCashPlacementTx(tx as never, TENANT, { cashDrawerId: 'd1', cashDrawerSessionId: 's1' }),
    ).rejects.toMatchObject({ code: 'DRAWER_SESSION_WRONG_DRAWER' });
  });

  it('rejects an unknown session', async () => {
    const tx = makeTx({ session: null });
    await expect(resolveCashPlacementTx(tx as never, TENANT, { cashDrawerSessionId: 's9' })).rejects.toMatchObject({
      code: 'CASH_DRAWER_SESSION_NOT_OPEN',
    });
  });

  it('resolves an active receiving user and rejects an unknown one', async () => {
    const ok = makeTx({ user: { user_id: 'u1' } });
    await expect(resolveCashPlacementTx(ok as never, TENANT, { receivedByUserId: 'u1' })).resolves.toMatchObject({
      recognizedBy: 'u1',
    });
    expect(ok.org_users_mst.findFirst).toHaveBeenCalledWith({
      where: { tenant_org_id: TENANT, user_id: 'u1', is_active: true },
      select: { user_id: true },
    });

    const bad = makeTx({ user: null });
    await expect(resolveCashPlacementTx(bad as never, TENANT, { receivedByUserId: 'x' })).rejects.toMatchObject({
      code: 'CASH_RECEIVER_INVALID',
    });
  });
});

describe('assertPinnedSession', () => {
  it('passes when nothing is pinned or the session matches', () => {
    expect(() => assertPinnedSession(null, 's1')).not.toThrow();
    expect(() => assertPinnedSession({ drawerId: 'd', sessionId: null, recognizedBy: null }, null)).not.toThrow();
    expect(() => assertPinnedSession({ drawerId: 'd', sessionId: 's1', recognizedBy: null }, 's1')).not.toThrow();
  });
  it('throws when the cash landed elsewhere (or in the next window)', () => {
    const pinned = { drawerId: 'd', sessionId: 's1', recognizedBy: null };
    expect(() => assertPinnedSession(pinned, 's2')).toThrow();
    expect(() => assertPinnedSession(pinned, null)).toThrow();
  });
});
